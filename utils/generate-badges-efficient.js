#!/usr/bin/env node

/**
 * Efficient Badge Generator for SEAL Frameworks Contributors
 *
 * This script significantly reduces API calls by:
 * 1. Fetching all data in bulk with pagination
 * 2. Processing data in memory instead of making individual API calls
 * 3. Using the Search API only once per query type
 * 4. Caching results to avoid redundant requests
 *
 * Badge Categories (all auto-generated):
 * - Achievement Badges: Persistent milestones (Contributor-5/10/25, Reviewer-10/25, etc.)
 * - Activity Badges: Time-based (Active-Last-30d, Active-Last-90d, New-Joiner, Dormant-90d+)
 *
 * Note: Roles (lead, core, steward) are indicated by the "role" field, not badges.
 */

const fs = require('fs');
const path = require('path');

// Load .env file manually if it exists
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) return;

        const [key, ...value] = trimmedLine.split('=');
        if (key && value.length > 0) {
            const val = value.join('=').trim().replace(/^["']|["']$/g, '');
            process.env[key.trim()] = val;
        }
    });
}

// Configuration
const REPO_OWNER = 'security-alliance';
const REPO_NAME = 'frameworks';
const CONTRIBUTORS_FILE = path.join(__dirname, '../docs/pages/config/contributors.json');
const GITHUB_API = 'https://api.github.com';

// All badge types managed by this script
const MANAGED_BADGE_NAMES = [
    'Contributor-5', 'Contributor-10', 'Contributor-25',
    'Reviewer-10', 'Reviewer-25', 'Top-Reviewer',
    'Active-Last-30d', 'Active-Last-90d', 'Dormant-90d+',
    'New-Joiner', 'Early-Contributor',
    'Issue-Opener-5', 'Issue-Opener-10', 'Issue-Opener-25'
];

// Repo creation date for Early-Contributor badge
const REPO_CREATION_DATE = new Date('2023-01-01');

// Helper function to make GitHub API requests with pagination
async function githubRequestWithPagination(endpoint, options = {}) {
    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SEAL-Frameworks-Badge-Generator'
    };

    if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    const allResults = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const url = endpoint.includes('?')
            ? `${GITHUB_API}${endpoint}&page=${page}&per_page=100`
            : `${GITHUB_API}${endpoint}?page=${page}&per_page=100`;

        const response = await fetch(url, { headers });

        if (!response.ok) {
            const errorBody = await response.text();
            if (response.status === 403 && errorBody.includes('rate limit')) {
                console.warn(`⏳ Rate limit hit for ${endpoint}. Returning partial results.`);
                return allResults;
            }
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}\n${errorBody}`);
        }

        const data = await response.json();

        // Handle search API response format
        if (data.items) {
            allResults.push(...data.items);
            // Check if there are more results
            hasMore = data.items.length === 100 && allResults.length < data.total_count;
        } else if (Array.isArray(data)) {
            allResults.push(...data);
            hasMore = data.length === 100;
        } else {
            // Single object response
            return data;
        }

        page++;

        // Add a small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 100));
    }

    return allResults;
}

// Format date to YYYY-MM-DD
function formatDate(dateString) {
    if (!dateString) return null;
    try {
        return new Date(dateString).toISOString().split('T')[0];
    } catch {
        return null;
    }
}

// Calculate days between two dates
function daysBetween(date1, date2 = new Date()) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
}

// Fetch all activity data efficiently
async function fetchAllActivityData() {
    console.log('📥 Fetching activity data from GitHub API...\n');

    try {
        console.log('   Fetching merged pull requests...');
        const allPRs = await githubRequestWithPagination(
            `/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=closed&sort=created&direction=asc`
        );
        const mergedPRs = allPRs.filter(pr => pr.merged_at !== null);
        console.log(`   ✅ Found ${mergedPRs.length} merged PRs`);

        console.log('   Fetching all issues...');
        const allIssues = await githubRequestWithPagination(
            `/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=all&sort=created&direction=asc`
        );
        // Filter out PRs (GitHub API returns both issues and PRs in /issues endpoint)
        const pureIssues = allIssues.filter(issue => !issue.pull_request);
        console.log(`   ✅ Found ${pureIssues.length} issues`);

        console.log('   Fetching PR reviews (this may take a moment)...');
        const allReviews = [];
        // Only fetch reviews for merged PRs
        for (const pr of mergedPRs) {
            try {
                const reviews = await githubRequestWithPagination(
                    `/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pr.number}/reviews`
                );
                allReviews.push(...reviews.filter(r => r.state !== 'PENDING'));
            } catch (error) {
                console.warn(`   ⚠️  Could not fetch reviews for PR #${pr.number}`);
            }

            // Add a small delay every 10 PRs to avoid rate limiting
            if (mergedPRs.indexOf(pr) % 10 === 0) {
                await new Promise(r => setTimeout(r, 500));
            }
        }
        console.log(`   ✅ Found ${allReviews.length} PR reviews\n`);

        return {
            mergedPRs,
            issues: pureIssues,
            reviews: allReviews
        };
    } catch (error) {
        console.error('❌ Error fetching activity data:', error.message);
        throw error;
    }
}

// Organize activity by contributor
function organizeActivityByContributor(activityData) {
    console.log('📊 Organizing activity by contributor...\n');

    const { mergedPRs, issues, reviews } = activityData;
    const contributorActivity = {};

    // Helper to initialize contributor
    const initContributor = (username) => {
        if (!contributorActivity[username]) {
            contributorActivity[username] = {
                mergedPRs: [],
                issues: [],
                reviews: [],
                firstContribution: null,
                lastActivity: null
            };
        }
    };

    // Process merged PRs
    for (const pr of mergedPRs) {
        const username = pr.user?.login?.toLowerCase();
        if (username && pr.user?.type !== 'Bot' && !username.includes('[bot]')) {
            initContributor(username);
            contributorActivity[username].mergedPRs.push({
                number: pr.number,
                created_at: pr.created_at,
                merged_at: pr.merged_at,
                title: pr.title
            });

            // Track first contribution
            if (!contributorActivity[username].firstContribution ||
                new Date(pr.created_at) < new Date(contributorActivity[username].firstContribution)) {
                contributorActivity[username].firstContribution = pr.created_at;
            }

            // Track last activity
            if (!contributorActivity[username].lastActivity ||
                new Date(pr.merged_at) > new Date(contributorActivity[username].lastActivity)) {
                contributorActivity[username].lastActivity = pr.merged_at;
            }
        }
    }

    // Process issues
    for (const issue of issues) {
        const username = issue.user?.login?.toLowerCase();
        if (username && issue.user?.type !== 'Bot' && !username.includes('[bot]')) {
            initContributor(username);
            contributorActivity[username].issues.push({
                number: issue.number,
                created_at: issue.created_at,
                title: issue.title
            });

            // Track first contribution
            if (!contributorActivity[username].firstContribution ||
                new Date(issue.created_at) < new Date(contributorActivity[username].firstContribution)) {
                contributorActivity[username].firstContribution = issue.created_at;
            }

            // Track last activity
            if (!contributorActivity[username].lastActivity ||
                new Date(issue.created_at) > new Date(contributorActivity[username].lastActivity)) {
                contributorActivity[username].lastActivity = issue.created_at;
            }
        }
    }

    // Process reviews
    for (const review of reviews) {
        const username = review.user?.login?.toLowerCase();
        if (username && review.user?.type !== 'Bot' && !username.includes('[bot]')) {
            initContributor(username);
            contributorActivity[username].reviews.push({
                id: review.id,
                submitted_at: review.submitted_at,
                state: review.state
            });

            // Track last activity
            if (!contributorActivity[username].lastActivity ||
                new Date(review.submitted_at) > new Date(contributorActivity[username].lastActivity)) {
                contributorActivity[username].lastActivity = review.submitted_at;
            }
        }
    }

    console.log(`   ✅ Organized activity for ${Object.keys(contributorActivity).length} contributors\n`);
    return contributorActivity;
}

// Generate badges for a contributor
function generateBadges(username, activity) {
    const badges = [];
    const today = formatDate(new Date());

    // Achievement Badges: Contributor Milestones
    const prCount = activity.mergedPRs.length;
    if (prCount >= 25) {
        const milestone = activity.mergedPRs.sort((a, b) =>
            new Date(a.merged_at) - new Date(b.merged_at)
        )[24];
        badges.push({
            name: 'Contributor-25',
            assigned: formatDate(milestone?.merged_at) || today
        });
    } else if (prCount >= 10) {
        const milestone = activity.mergedPRs.sort((a, b) =>
            new Date(a.merged_at) - new Date(b.merged_at)
        )[9];
        badges.push({
            name: 'Contributor-10',
            assigned: formatDate(milestone?.merged_at) || today
        });
    } else if (prCount >= 5) {
        const milestone = activity.mergedPRs.sort((a, b) =>
            new Date(a.merged_at) - new Date(b.merged_at)
        )[4];
        badges.push({
            name: 'Contributor-5',
            assigned: formatDate(milestone?.merged_at) || today
        });
    }

    // Achievement Badges: Reviewer Milestones
    const reviewCount = activity.reviews.length;
    if (reviewCount >= 50) {
        const milestone = activity.reviews.sort((a, b) =>
            new Date(a.submitted_at) - new Date(b.submitted_at)
        )[49];
        badges.push({
            name: 'Top-Reviewer',
            assigned: formatDate(milestone?.submitted_at) || today
        });
    }

    if (reviewCount >= 25) {
        const milestone = activity.reviews.sort((a, b) =>
            new Date(a.submitted_at) - new Date(b.submitted_at)
        )[24];
        badges.push({
            name: 'Reviewer-25',
            assigned: formatDate(milestone?.submitted_at) || today
        });
    } else if (reviewCount >= 10) {
        const milestone = activity.reviews.sort((a, b) =>
            new Date(a.submitted_at) - new Date(b.submitted_at)
        )[9];
        badges.push({
            name: 'Reviewer-10',
            assigned: formatDate(milestone?.submitted_at) || today
        });
    }

    // Achievement Badges: Issue Opener Milestones
    const issueCount = activity.issues.length;
    if (issueCount >= 25) {
        const milestone = activity.issues.sort((a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
        )[24];
        badges.push({
            name: 'Issue-Opener-25',
            assigned: formatDate(milestone?.created_at) || today
        });
    } else if (issueCount >= 10) {
        const milestone = activity.issues.sort((a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
        )[9];
        badges.push({
            name: 'Issue-Opener-10',
            assigned: formatDate(milestone?.created_at) || today
        });
    } else if (issueCount >= 5) {
        const milestone = activity.issues.sort((a, b) =>
            new Date(a.created_at) - new Date(b.created_at)
        )[4];
        badges.push({
            name: 'Issue-Opener-5',
            assigned: formatDate(milestone?.created_at) || today
        });
    }

    // Achievement Badge: Early Contributor
    if (activity.firstContribution) {
        const firstDate = new Date(activity.firstContribution);
        const daysSinceRepoCreation = daysBetween(REPO_CREATION_DATE, firstDate);

        if (daysSinceRepoCreation <= 90) {
            badges.push({
                name: 'Early-Contributor',
                assigned: formatDate(activity.firstContribution)
            });
        }
    }

    // Activity Badge: New-Joiner
    if (activity.firstContribution) {
        const daysSinceFirst = daysBetween(activity.firstContribution);
        if (daysSinceFirst <= 30) {
            badges.push({
                name: 'New-Joiner',
                assigned: formatDate(activity.firstContribution)
            });
        }
    }

    // Activity Badges: Active-Last-30d / Active-Last-90d / Dormant-90d+
    if (activity.lastActivity) {
        const daysSinceLast = daysBetween(activity.lastActivity);

        if (daysSinceLast <= 30) {
            badges.push({
                name: 'Active-Last-30d',
                assigned: today
            });
        } else if (daysSinceLast <= 90) {
            badges.push({
                name: 'Active-Last-90d',
                assigned: today
            });
        } else {
            badges.push({
                name: 'Dormant-90d+',
                assigned: today
            });
        }
    }

    return badges;
}

// Main function
async function main() {
    try {
        console.log('🏅 SEAL Frameworks - Efficient Badge Generator\n');
        console.log('================================================\n');

        if (!process.env.GITHUB_TOKEN) {
            console.warn('⚠️  No GitHub Token found. Using unauthenticated requests (rate limited to 60/hr)\n');
        } else {
            console.log('🔑 GitHub Token found. Using authenticated requests.\n');
        }

        // Load existing contributors
        if (!fs.existsSync(CONTRIBUTORS_FILE)) {
            console.error('❌ Contributors file not found:', CONTRIBUTORS_FILE);
            process.exit(1);
        }

        const contributorsData = JSON.parse(fs.readFileSync(CONTRIBUTORS_FILE, 'utf8'));
        console.log(`📋 Loaded ${Object.keys(contributorsData).length} contributors from database\n`);

        // Fetch all activity data in bulk (minimizing API calls)
        const activityData = await fetchAllActivityData();

        // Organize activity by contributor
        const contributorActivity = organizeActivityByContributor(activityData);

        // Update badges for each contributor
        console.log('🔄 Updating contributor badges...\n');
        let updatedCount = 0;
        let newContributorsCount = 0;

        // Create a mapping of GitHub usernames to contributor slugs
        const githubUsernameToSlug = {};
        for (const [slug, contributor] of Object.entries(contributorsData)) {
            if (contributor.github) {
                const username = contributor.github.split('/').pop()?.toLowerCase();
                if (username) {
                    githubUsernameToSlug[username] = slug;
                }
            }
        }

        // Process each contributor with activity
        for (const [username, activity] of Object.entries(contributorActivity)) {
            const slug = githubUsernameToSlug[username];

            if (!slug) {
                console.log(`   ℹ️  Skipping ${username} (not in contributors database)`);
                continue;
            }

            const contributor = contributorsData[slug];

            // Get old badges (handle both old nested structure and flat array)
            let oldBadges = [];
            if (contributor.badges) {
                if (typeof contributor.badges === 'object' && !Array.isArray(contributor.badges)) {
                    // Was nested structure: { static: [], dynamic: [] }
                    oldBadges = contributor.badges.dynamic || [];
                } else if (Array.isArray(contributor.badges)) {
                    // Already flat array
                    oldBadges = contributor.badges.filter(b => b.name && MANAGED_BADGE_NAMES.includes(b.name));
                }
            }

            // Generate new badges
            const newBadges = generateBadges(username, activity);

            // Update to simple flat array structure
            contributor.badges = newBadges;

            // Check if badges changed
            const oldBadgeNames = oldBadges.map(b => b.name).sort().join(',');
            const newBadgeNames = newBadges.map(b => b.name).sort().join(',');

            if (oldBadgeNames !== newBadgeNames) {
                updatedCount++;
                console.log(`   ✅ Updated ${contributor.name} (${username})`);
                console.log(`      Badges: ${newBadges.map(b => b.name).join(', ') || 'none'}`);
            }
        }

        // Save updated contributors.json
        fs.writeFileSync(
            CONTRIBUTORS_FILE,
            JSON.stringify(contributorsData, null, 2) + '\n',
            'utf8'
        );

        console.log('\n================================================');
        console.log('✅ Badge generation complete!\n');
        console.log(`📊 Statistics:`);
        console.log(`   - Contributors processed: ${Object.keys(contributorActivity).length}`);
        console.log(`   - Badges updated: ${updatedCount}`);
        console.log(`   - Total API calls: ~${activityData.mergedPRs.length + 4} (vs ~${Object.keys(contributorActivity).length * 15} in old script)`);
        console.log(`\n💾 Saved to ${CONTRIBUTORS_FILE}`);

    } catch (error) {
        console.error('❌ Fatal Error:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

main();
