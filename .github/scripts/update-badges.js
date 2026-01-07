#!/usr/bin/env node

/**
 * GitHub Actions script to automatically update contributor badges
 * 
 * This script:
 * 1. Fetches PRs, reviews, and comments from GitHub API
 * 2. Calculates badge eligibility based on activity
 * 3. Updates contributors.json with new badges
 * 
 * Badge Rules:
 * - Achievement Badges: Based on thresholds (Contributor-5/10/25, Reviewer-10/25, etc.)
 * - Activity Badges: Based on recent activity (Active-Last-30d, Active-Last-90d, New-Joiner)
 * - Early-Contributor: First contribution date
 */

const fs = require('fs');
const path = require('path');

// GitHub API configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || 'security-alliance/frameworks';
const [owner, repo] = GITHUB_REPOSITORY.split('/');

const CONTRIBUTORS_FILE = path.join(__dirname, '../../docs/pages/config/contributors.json');
const API_BASE = 'https://api.github.com';

// Badge thresholds
const BADGE_THRESHOLDS = {
  CONTRIBUTOR: [5, 10, 25],
  REVIEWER: [10, 25],
};

// Date helpers
function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function formatDate(dateString) {
  if (!dateString) return '';
  try {
    return new Date(dateString).toISOString().split('T')[0];
  } catch {
    return dateString;
  }
}

function isWithinDays(dateString, days) {
  if (!dateString) return false;
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= days;
  } catch {
    return false;
  }
}

// GitHub API helpers
async function fetchWithPagination(url, token) {
  const allData = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`${url}?page=${page}&per_page=100`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'badge-updater'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (Array.isArray(data)) {
      if (data.length === 0) {
        hasMore = false;
      } else {
        allData.push(...data);
        page++;
        // GitHub API returns max 100 items per page
        if (data.length < 100) {
          hasMore = false;
        }
      }
    } else {
      return data;
    }
  }

  return allData;
}

async function fetchMergedPRs(token) {
  console.log('📥 Fetching merged pull requests...');
  const url = `${API_BASE}/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc`;
  const prs = await fetchWithPagination(url, token);
  
  // Filter only merged PRs
  const mergedPRs = prs.filter(pr => pr.merged_at !== null);
  console.log(`✅ Found ${mergedPRs.length} merged PRs`);
  return mergedPRs;
}

async function fetchPRReviews(token) {
  console.log('📥 Fetching PR reviews...');
  // We'll fetch reviews for each PR (this might be rate-limited, so we'll optimize)
  const mergedPRs = await fetchMergedPRs(token);
  const reviews = [];
  
  // Limit to last 100 PRs to avoid rate limits
  const recentPRs = mergedPRs.slice(0, 100);
  
  for (const pr of recentPRs) {
    try {
      const url = `${API_BASE}/repos/${owner}/${repo}/pulls/${pr.number}/reviews`;
      const prReviews = await fetchWithPagination(url, token);
      reviews.push(...prReviews.map(review => ({
        ...review,
        pr_number: pr.number,
        pr_merged_at: pr.merged_at
      })));
    } catch (error) {
      console.warn(`⚠️  Could not fetch reviews for PR #${pr.number}: ${error.message}`);
    }
  }
  
  console.log(`✅ Found ${reviews.length} PR reviews`);
  return reviews;
}

async function fetchPRComments(token) {
  console.log('📥 Fetching PR comments...');
  const mergedPRs = await fetchMergedPRs(token);
  const comments = [];
  
  // Limit to last 100 PRs
  const recentPRs = mergedPRs.slice(0, 100);
  
  for (const pr of recentPRs) {
    try {
      const url = `${API_BASE}/repos/${owner}/${repo}/pulls/${pr.number}/comments`;
      const prComments = await fetchWithPagination(url, token);
      comments.push(...prComments.map(comment => ({
        ...comment,
        pr_number: pr.number,
        pr_merged_at: pr.merged_at
      })));
    } catch (error) {
      console.warn(`⚠️  Could not fetch comments for PR #${pr.number}: ${error.message}`);
    }
  }
  
  console.log(`✅ Found ${comments.length} PR comments`);
  return comments;
}

// Badge calculation logic
function calculateBadges(contributor, activity) {
  const badges = contributor.badges || [];
  const existingBadgeNames = new Set(badges.map(b => b.name).filter(Boolean));
  const newBadges = [];
  const today = new Date().toISOString().split('T')[0];

  // Get contributor's GitHub username from slug or github URL
  const githubUsername = contributor.slug || 
    (contributor.github ? contributor.github.split('/').pop() : null);
  
  if (!githubUsername) {
    return badges; // Can't calculate badges without GitHub username
  }

  const contributorActivity = activity[githubUsername.toLowerCase()] || {
    mergedPRs: [],
    reviews: [],
    comments: [],
    firstContribution: null
  };

  // Achievement Badges: Contributor milestones
  const mergedPRCount = contributorActivity.mergedPRs.length;
  for (const threshold of BADGE_THRESHOLDS.CONTRIBUTOR) {
    const badgeName = `Contributor-${threshold}`;
    if (mergedPRCount >= threshold && !existingBadgeNames.has(badgeName)) {
      // Find the PR that crossed the threshold
      const thresholdPR = contributorActivity.mergedPRs
        .sort((a, b) => new Date(a.merged_at) - new Date(b.merged_at))[threshold - 1];
      newBadges.push({
        name: badgeName,
        assigned: thresholdPR ? formatDate(thresholdPR.merged_at) : today
      });
      existingBadgeNames.add(badgeName);
    }
  }

  // Achievement Badges: Reviewer milestones
  const reviewCount = contributorActivity.reviews.length;
  for (const threshold of BADGE_THRESHOLDS.REVIEWER) {
    const badgeName = `Reviewer-${threshold}`;
    if (reviewCount >= threshold && !existingBadgeNames.has(badgeName)) {
      // Find the review that crossed the threshold
      const thresholdReview = contributorActivity.reviews
        .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at))[threshold - 1];
      newBadges.push({
        name: badgeName,
        assigned: thresholdReview ? formatDate(thresholdReview.submitted_at) : today
      });
      existingBadgeNames.add(badgeName);
    }
  }

  // Top-Reviewer badge (top 10% of reviewers)
  if (reviewCount >= 25 && !existingBadgeNames.has('Top-Reviewer')) {
    newBadges.push({
      name: 'Top-Reviewer',
      assigned: today
    });
    existingBadgeNames.add('Top-Reviewer');
  }

  // Early-Contributor badge
  if (contributorActivity.firstContribution) {
    const firstContribDate = new Date(contributorActivity.firstContribution);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    if (firstContribDate < sixMonthsAgo && !existingBadgeNames.has('Early-Contributor')) {
      newBadges.push({
        name: 'Early-Contributor',
        assigned: formatDate(contributorActivity.firstContribution)
      });
      existingBadgeNames.add('Early-Contributor');
    }
  }

  // Activity Badges: Active-Last-30d
  const recentActivity = [
    ...contributorActivity.mergedPRs.filter(pr => isWithinDays(pr.merged_at, 30)),
    ...contributorActivity.reviews.filter(r => isWithinDays(r.submitted_at, 30)),
    ...contributorActivity.comments.filter(c => isWithinDays(c.created_at, 30))
  ];

  if (recentActivity.length > 0) {
    const hasActive30d = existingBadgeNames.has('Active-Last-30d');
    if (!hasActive30d) {
      newBadges.push({
        name: 'Active-Last-30d',
        assigned: today
      });
    } else {
      // Update existing badge date
      const existingBadge = badges.find(b => b.name === 'Active-Last-30d');
      if (existingBadge) {
        existingBadge.assigned = today;
      }
    }
  } else {
    // Remove if no longer active
    const active30dIndex = badges.findIndex(b => b.name === 'Active-Last-30d');
    if (active30dIndex !== -1) {
      badges.splice(active30dIndex, 1);
    }
  }

  // Activity Badges: Active-Last-90d
  const activity90d = [
    ...contributorActivity.mergedPRs.filter(pr => isWithinDays(pr.merged_at, 90)),
    ...contributorActivity.reviews.filter(r => isWithinDays(r.submitted_at, 90)),
    ...contributorActivity.comments.filter(c => isWithinDays(c.created_at, 90))
  ];

  if (activity90d.length > 0) {
    const hasActive90d = existingBadgeNames.has('Active-Last-90d');
    if (!hasActive90d && !existingBadgeNames.has('Active-Last-30d')) {
      newBadges.push({
        name: 'Active-Last-90d',
        assigned: today
      });
    } else if (hasActive90d) {
      // Update existing badge date
      const existingBadge = badges.find(b => b.name === 'Active-Last-90d');
      if (existingBadge) {
        existingBadge.assigned = today;
      }
    }
  } else {
    // Remove if no longer active
    const active90dIndex = badges.findIndex(b => b.name === 'Active-Last-90d');
    if (active90dIndex !== -1) {
      badges.splice(active90dIndex, 1);
    }
  }

  // Activity Badges: New-Joiner
  if (contributorActivity.firstContribution && isWithinDays(contributorActivity.firstContribution, 30)) {
    if (!existingBadgeNames.has('New-Joiner')) {
      newBadges.push({
        name: 'New-Joiner',
        assigned: formatDate(contributorActivity.firstContribution)
      });
    }
  } else {
    // Remove if no longer a new joiner
    const newJoinerIndex = badges.findIndex(b => b.name === 'New-Joiner');
    if (newJoinerIndex !== -1) {
      badges.splice(newJoinerIndex, 1);
    }
  }

  // Combine existing badges (excluding empty ones) with new badges
  const validBadges = badges.filter(b => b.name && b.name.trim() !== '');
  return [...validBadges, ...newBadges];
}

// Main execution
async function main() {
  if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  console.log('🚀 Starting badge update process...');
  console.log(`📦 Repository: ${owner}/${repo}`);

  try {
    // Load contributors.json
    const contributorsData = JSON.parse(fs.readFileSync(CONTRIBUTORS_FILE, 'utf8'));
    console.log(`📋 Loaded ${Object.keys(contributorsData).length} contributors`);

    // Fetch activity data
    const [mergedPRs, reviews, comments] = await Promise.all([
      fetchMergedPRs(GITHUB_TOKEN),
      fetchPRReviews(GITHUB_TOKEN),
      fetchPRComments(GITHUB_TOKEN)
    ]);

    // Organize activity by contributor
    const activity = {};

    // Process merged PRs
    for (const pr of mergedPRs) {
      const username = pr.user?.login?.toLowerCase();
      if (username) {
        if (!activity[username]) {
          activity[username] = {
            mergedPRs: [],
            reviews: [],
            comments: [],
            firstContribution: null
          };
        }
        activity[username].mergedPRs.push({
          number: pr.number,
          merged_at: pr.merged_at,
          created_at: pr.created_at
        });
        
        // Track first contribution
        if (!activity[username].firstContribution || 
            new Date(pr.created_at) < new Date(activity[username].firstContribution)) {
          activity[username].firstContribution = pr.created_at;
        }
      }
    }

    // Process reviews
    for (const review of reviews) {
      const username = review.user?.login?.toLowerCase();
      if (username && review.state !== 'PENDING') {
        if (!activity[username]) {
          activity[username] = {
            mergedPRs: [],
            reviews: [],
            comments: [],
            firstContribution: null
          };
        }
        activity[username].reviews.push({
          id: review.id,
          submitted_at: review.submitted_at,
          state: review.state
        });
      }
    }

    // Process comments
    for (const comment of comments) {
      const username = comment.user?.login?.toLowerCase();
      if (username) {
        if (!activity[username]) {
          activity[username] = {
            mergedPRs: [],
            reviews: [],
            comments: [],
            firstContribution: null
          };
        }
        activity[username].comments.push({
          id: comment.id,
          created_at: comment.created_at
        });
      }
    }

    console.log(`📊 Activity data collected for ${Object.keys(activity).length} contributors`);

    // Update badges for each contributor
    let updatedCount = 0;
    for (const [slug, contributor] of Object.entries(contributorsData)) {
      const oldBadges = JSON.stringify(contributor.badges || []);
      contributor.badges = calculateBadges(contributor, activity);
      const newBadges = JSON.stringify(contributor.badges);
      
      if (oldBadges !== newBadges) {
        updatedCount++;
        const newBadgeNames = contributor.badges
          .filter(b => b.name && b.name.trim() !== '')
          .map(b => b.name);
        console.log(`  ✨ Updated badges for ${contributor.name}: ${newBadgeNames.join(', ')}`);
      }
    }

    // Save updated contributors.json
    fs.writeFileSync(
      CONTRIBUTORS_FILE,
      JSON.stringify(contributorsData, null, 2) + '\n',
      'utf8'
    );

    console.log(`\n✅ Badge update complete!`);
    console.log(`📝 Updated ${updatedCount} contributor(s)`);
    console.log(`💾 Saved to ${CONTRIBUTORS_FILE}`);

  } catch (error) {
    console.error('❌ Error updating badges:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { calculateBadges, fetchMergedPRs, fetchPRReviews };

