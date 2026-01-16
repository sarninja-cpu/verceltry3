#!/usr/bin/env node

/**
 * Contributor Activity Report Generator for SEAL Frameworks
 *
 * Generates a detailed Markdown report with all contributor activity data
 * fetched from GitHub for review purposes.
 *
 * Required GitHub Token Permissions:
 * - public_repo (read-only access to public repositories)
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
const REPORT_OUTPUT = path.join(__dirname, '../contributor-activity-report.md');
const GITHUB_API = 'https://api.github.com';

// Repo creation date for Early-Contributor badge
const REPO_CREATION_DATE = new Date('2023-01-01');
const EARLY_CONTRIBUTOR_WINDOW_DAYS = 90;

// Badge definitions for reference
const BADGE_INFO = {
    'Framework-Steward': { tier: 'legendary', category: 'role', description: 'Official maintainer responsible for framework quality' },
    'Core-Contributor': { tier: 'legendary', category: 'role', description: 'Elite contributor with governance responsibilities' },
    'Lead': { tier: 'epic', category: 'role', description: 'Initiative lead and project maintainer' },
    'Contributor-25': { tier: 'epic', category: 'milestone', description: '25+ merged contributions' },
    'Contributor-10': { tier: 'rare', category: 'milestone', description: '10+ merged contributions' },
    'Contributor-5': { tier: 'common', category: 'milestone', description: '5+ merged contributions' },
    'Reviewer-25': { tier: 'epic', category: 'milestone', description: '25+ code reviews completed' },
    'Reviewer-10': { tier: 'rare', category: 'milestone', description: '10+ code reviews completed' },
    'Issue-Opener-25': { tier: 'epic', category: 'milestone', description: '25+ issues opened' },
    'Issue-Opener-10': { tier: 'rare', category: 'milestone', description: '10+ issues opened' },
    'Issue-Opener-5': { tier: 'common', category: 'milestone', description: '5+ issues opened' },
    'Early-Contributor': { tier: 'rare', category: 'milestone', description: 'Among the first contributors to the project' },
    'First-Contribution': { tier: 'common', category: 'milestone', description: 'Made their first contribution to the project' },
    'First-Review': { tier: 'common', category: 'milestone', description: 'Completed their first code review' },
    'Active-Last-7d': { tier: 'common', category: 'activity', description: 'Active in the last 7 days' },
    'Active-Last-30d': { tier: 'common', category: 'activity', description: 'Active in the last 30 days' },
    'New-Joiner': { tier: 'common', category: 'activity', description: 'Welcome to the community!' },
    'Dormant-90d+': { tier: 'common', category: 'activity', description: 'Inactive for 90+ days' }
};

// Helper function to make GitHub API requests with pagination
async function githubRequestWithPagination(endpoint) {
    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SEAL-Frameworks-Report-Generator'
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

        const remaining = response.headers.get('X-RateLimit-Remaining');
        const reset = response.headers.get('X-RateLimit-Reset');

        if (remaining && parseInt(remaining) < 10) {
            const resetTime = new Date(parseInt(reset) * 1000);
            const waitTime = Math.max(0, resetTime - Date.now());
            console.warn(`⏳ Rate limit low (${remaining} remaining). Waiting ${Math.ceil(waitTime / 1000)}s...`);
            await new Promise(r => setTimeout(r, waitTime + 1000));
        }

        if (!response.ok) {
            const errorBody = await response.text();
            if (response.status === 403 && errorBody.includes('rate limit')) {
                console.warn(`⏳ Rate limit hit. Returning partial results.`);
                return allResults;
            }
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.items) {
            allResults.push(...data.items);
            hasMore = data.items.length === 100 && allResults.length < data.total_count;
        } else if (Array.isArray(data)) {
            allResults.push(...data);
            hasMore = data.length === 100;
        } else {
            return data;
        }

        page++;
        await new Promise(r => setTimeout(r, 200));
    }

    return allResults;
}

// Format date to YYYY-MM-DD
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toISOString().split('T')[0];
    } catch {
        return 'N/A';
    }
}

// Calculate days between two dates
function daysBetween(date1, date2 = new Date()) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
    return Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
}

// Get earliest date helper
function getEarliestDate(date1, date2) {
    if (!date1 && !date2) return null;
    if (!date1) return date2;
    if (!date2) return date1;
    return new Date(date1) < new Date(date2) ? date1 : date2;
}

// Fetch all activity data
async function fetchAllActivityData() {
    console.log('📥 Fetching activity data from GitHub API...\n');

    const allPRs = await githubRequestWithPagination(
        `/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=closed&sort=created&direction=asc`
    );
    const mergedPRs = allPRs.filter(pr => pr.merged_at !== null);
    console.log(`   ✅ Found ${mergedPRs.length} merged PRs`);

    const allIssues = await githubRequestWithPagination(
        `/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=all&sort=created&direction=asc`
    );
    const pureIssues = allIssues.filter(issue => !issue.pull_request);
    console.log(`   ✅ Found ${pureIssues.length} issues`);

    console.log('   Fetching PR reviews...');
    const allReviews = [];
    let processedPRs = 0;

    for (const pr of allPRs) {
        try {
            const reviews = await githubRequestWithPagination(
                `/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pr.number}/reviews`
            );
            const meaningfulReviews = reviews.filter(r =>
                r.state === 'APPROVED' || r.state === 'CHANGES_REQUESTED'
            ).map(r => ({ ...r, pr_number: pr.number, pr_title: pr.title }));
            allReviews.push(...meaningfulReviews);
            processedPRs++;

            if (processedPRs % 50 === 0) {
                console.log(`   ... processed ${processedPRs}/${allPRs.length} PRs`);
            }
        } catch (error) {
            console.warn(`   ⚠️  Could not fetch reviews for PR #${pr.number}`);
        }

        if (processedPRs % 20 === 0) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    console.log(`   ✅ Found ${allReviews.length} meaningful PR reviews\n`);

    return { mergedPRs, issues: pureIssues, reviews: allReviews, allPRs };
}

// Organize activity by contributor
function organizeActivityByContributor(activityData) {
    const { mergedPRs, issues, reviews } = activityData;
    const contributorActivity = {};

    const initContributor = (username) => {
        if (!contributorActivity[username]) {
            contributorActivity[username] = {
                mergedPRs: [],
                issues: [],
                reviews: [],
                firstContribution: null,
                firstReview: null,
                lastActivity: null
            };
        }
    };

    for (const pr of mergedPRs) {
        const username = pr.user?.login?.toLowerCase();
        if (username && pr.user?.type !== 'Bot' && !username.includes('[bot]')) {
            initContributor(username);
            contributorActivity[username].mergedPRs.push({
                number: pr.number,
                title: pr.title,
                created_at: pr.created_at,
                merged_at: pr.merged_at
            });

            const mergedDate = new Date(pr.merged_at);
            if (!contributorActivity[username].firstContribution ||
                mergedDate < new Date(contributorActivity[username].firstContribution)) {
                contributorActivity[username].firstContribution = pr.merged_at;
            }
            if (!contributorActivity[username].lastActivity ||
                mergedDate > new Date(contributorActivity[username].lastActivity)) {
                contributorActivity[username].lastActivity = pr.merged_at;
            }
        }
    }

    for (const issue of issues) {
        const username = issue.user?.login?.toLowerCase();
        if (username && issue.user?.type !== 'Bot' && !username.includes('[bot]')) {
            initContributor(username);
            contributorActivity[username].issues.push({
                number: issue.number,
                title: issue.title,
                created_at: issue.created_at,
                state: issue.state
            });

            const issueDate = new Date(issue.created_at);
            if (!contributorActivity[username].firstContribution ||
                issueDate < new Date(contributorActivity[username].firstContribution)) {
                contributorActivity[username].firstContribution = issue.created_at;
            }
            if (!contributorActivity[username].lastActivity ||
                issueDate > new Date(contributorActivity[username].lastActivity)) {
                contributorActivity[username].lastActivity = issue.created_at;
            }
        }
    }

    for (const review of reviews) {
        const username = review.user?.login?.toLowerCase();
        if (username && review.user?.type !== 'Bot' && !username.includes('[bot]')) {
            initContributor(username);
            contributorActivity[username].reviews.push({
                pr_number: review.pr_number,
                pr_title: review.pr_title,
                submitted_at: review.submitted_at,
                state: review.state
            });

            const reviewDate = new Date(review.submitted_at);
            if (!contributorActivity[username].firstReview ||
                reviewDate < new Date(contributorActivity[username].firstReview)) {
                contributorActivity[username].firstReview = review.submitted_at;
            }
            if (!contributorActivity[username].lastActivity ||
                reviewDate > new Date(contributorActivity[username].lastActivity)) {
                contributorActivity[username].lastActivity = review.submitted_at;
            }
        }
    }

    return contributorActivity;
}

// Calculate badges for a contributor
function calculateBadges(activity) {
    const badges = [];
    const today = new Date();

    const prCount = activity.mergedPRs.length;
    if (prCount >= 1) badges.push('First-Contribution');
    if (prCount >= 5) badges.push('Contributor-5');
    if (prCount >= 10) badges.push('Contributor-10');
    if (prCount >= 25) badges.push('Contributor-25');

    const reviewCount = activity.reviews.length;
    if (reviewCount >= 1) badges.push('First-Review');
    if (reviewCount >= 10) badges.push('Reviewer-10');
    if (reviewCount >= 25) badges.push('Reviewer-25');

    const issueCount = activity.issues.length;
    if (issueCount >= 5) badges.push('Issue-Opener-5');
    if (issueCount >= 10) badges.push('Issue-Opener-10');
    if (issueCount >= 25) badges.push('Issue-Opener-25');

    if (activity.firstContribution) {
        const firstDate = new Date(activity.firstContribution);
        const daysSinceRepoCreation = daysBetween(REPO_CREATION_DATE, firstDate);
        if (daysSinceRepoCreation !== null && daysSinceRepoCreation <= EARLY_CONTRIBUTOR_WINDOW_DAYS) {
            badges.push('Early-Contributor');
        }
    }

    const firstActivityDate = getEarliestDate(activity.firstContribution, activity.firstReview);
    if (firstActivityDate) {
        const daysSinceFirst = daysBetween(firstActivityDate, today);
        if (daysSinceFirst !== null && daysSinceFirst <= 14) {
            badges.push('New-Joiner');
        }
    }

    if (activity.lastActivity) {
        const daysSinceLast = daysBetween(activity.lastActivity, today);
        if (daysSinceLast !== null) {
            if (daysSinceLast <= 7) badges.push('Active-Last-7d');
            else if (daysSinceLast <= 30) badges.push('Active-Last-30d');
            else if (daysSinceLast > 90) badges.push('Dormant-90d+');
        }
    }

    return badges;
}

// Generate the report
function generateReport(activityData, contributorActivity, contributorsData) {
    const today = new Date();
    const reportDate = formatDate(today);

    let report = `# SEAL Frameworks - Contributor Activity Report

**Generated:** ${reportDate}
**Repository:** ${REPO_OWNER}/${REPO_NAME}

---

## Summary

| Metric | Count |
|--------|-------|
| Total Merged PRs | ${activityData.mergedPRs.length} |
| Total Issues | ${activityData.issues.length} |
| Total PR Reviews | ${activityData.reviews.length} |
| Contributors with Activity | ${Object.keys(contributorActivity).length} |
| Contributors in Database | ${Object.keys(contributorsData).length} |

---

## Badge Definitions

### Role Badges (Manually Assigned)
| Badge | Tier | Description |
|-------|------|-------------|
| Framework-Steward | Legendary | Official maintainer responsible for framework quality |
| Core-Contributor | Legendary | Elite contributor with governance responsibilities |
| Lead | Epic | Initiative lead and project maintainer |

### Milestone Badges (Auto-Assigned)
| Badge | Tier | Criteria |
|-------|------|----------|
| First-Contribution | Common | 1+ merged PR |
| Contributor-5 | Common | 5+ merged PRs |
| Contributor-10 | Rare | 10+ merged PRs |
| Contributor-25 | Epic | 25+ merged PRs |
| First-Review | Common | 1+ code review |
| Reviewer-10 | Rare | 10+ code reviews |
| Reviewer-25 | Epic | 25+ code reviews |
| Issue-Opener-5 | Common | 5+ issues opened |
| Issue-Opener-10 | Rare | 10+ issues opened |
| Issue-Opener-25 | Epic | 25+ issues opened |
| Early-Contributor | Rare | Contributed within first 90 days of repo |

### Activity Badges (Auto-Assigned, Time-Based)
| Badge | Tier | Criteria |
|-------|------|----------|
| New-Joiner | Common | First activity within last 14 days |
| Active-Last-7d | Common | Active in last 7 days |
| Active-Last-30d | Common | Active in last 30 days |
| Dormant-90d+ | Common | No activity for 90+ days |

---

## Contributor Details

`;

    // Create mapping of GitHub usernames to contributor slugs
    const githubUsernameToSlug = {};
    for (const [slug, contributor] of Object.entries(contributorsData)) {
        if (contributor.github) {
            const username = contributor.github.split('/').pop()?.toLowerCase();
            if (username) {
                githubUsernameToSlug[username] = slug;
            }
        }
    }

    // Sort contributors by total activity
    const sortedContributors = Object.entries(contributorActivity)
        .map(([username, activity]) => ({
            username,
            activity,
            totalActivity: activity.mergedPRs.length + activity.reviews.length + activity.issues.length
        }))
        .sort((a, b) => b.totalActivity - a.totalActivity);

    for (const { username, activity } of sortedContributors) {
        const slug = githubUsernameToSlug[username];
        const inDatabase = slug ? '✅' : '❌';
        const contributorData = slug ? contributorsData[slug] : null;
        const displayName = contributorData?.name || username;

        const calculatedBadges = calculateBadges(activity);
        const existingBadges = contributorData?.badges?.map(b => b.name) || [];

        const daysSinceLast = activity.lastActivity ? daysBetween(activity.lastActivity) : null;
        const firstActivityDate = getEarliestDate(activity.firstContribution, activity.firstReview);
        const daysSinceFirst = firstActivityDate ? daysBetween(firstActivityDate) : null;

        report += `### ${displayName} (@${username}) ${inDatabase}

| Metric | Value |
|--------|-------|
| In Database | ${inDatabase} ${slug ? `(${slug})` : '(not found)'} |
| Merged PRs | ${activity.mergedPRs.length} |
| Code Reviews | ${activity.reviews.length} |
| Issues Opened | ${activity.issues.length} |
| First Activity | ${formatDate(firstActivityDate)} ${daysSinceFirst !== null ? `(${daysSinceFirst} days ago)` : ''} |
| Last Activity | ${formatDate(activity.lastActivity)} ${daysSinceLast !== null ? `(${daysSinceLast} days ago)` : ''} |

**Calculated Badges:** ${calculatedBadges.length > 0 ? calculatedBadges.join(', ') : 'None'}
`;

        if (existingBadges.length > 0) {
            report += `**Existing Badges:** ${existingBadges.join(', ')}\n`;
        }

        // Show PR details if any
        if (activity.mergedPRs.length > 0) {
            report += `
<details>
<summary>Merged PRs (${activity.mergedPRs.length})</summary>

| # | Title | Merged |
|---|-------|--------|
`;
            const sortedPRs = [...activity.mergedPRs].sort((a, b) =>
                new Date(b.merged_at) - new Date(a.merged_at)
            );
            for (const pr of sortedPRs.slice(0, 20)) {
                const title = pr.title.length > 60 ? pr.title.substring(0, 57) + '...' : pr.title;
                report += `| #${pr.number} | ${title.replace(/\|/g, '\\|')} | ${formatDate(pr.merged_at)} |\n`;
            }
            if (sortedPRs.length > 20) {
                report += `| ... | *${sortedPRs.length - 20} more PRs* | ... |\n`;
            }
            report += `
</details>
`;
        }

        // Show review details if any
        if (activity.reviews.length > 0) {
            report += `
<details>
<summary>Code Reviews (${activity.reviews.length})</summary>

| PR | State | Date |
|----|-------|------|
`;
            const sortedReviews = [...activity.reviews].sort((a, b) =>
                new Date(b.submitted_at) - new Date(a.submitted_at)
            );
            for (const review of sortedReviews.slice(0, 20)) {
                report += `| #${review.pr_number} | ${review.state} | ${formatDate(review.submitted_at)} |\n`;
            }
            if (sortedReviews.length > 20) {
                report += `| ... | *${sortedReviews.length - 20} more reviews* | ... |\n`;
            }
            report += `
</details>
`;
        }

        // Show issue details if any
        if (activity.issues.length > 0) {
            report += `
<details>
<summary>Issues Opened (${activity.issues.length})</summary>

| # | Title | State | Created |
|---|-------|-------|---------|
`;
            const sortedIssues = [...activity.issues].sort((a, b) =>
                new Date(b.created_at) - new Date(a.created_at)
            );
            for (const issue of sortedIssues.slice(0, 20)) {
                const title = issue.title.length > 50 ? issue.title.substring(0, 47) + '...' : issue.title;
                report += `| #${issue.number} | ${title.replace(/\|/g, '\\|')} | ${issue.state} | ${formatDate(issue.created_at)} |\n`;
            }
            if (sortedIssues.length > 20) {
                report += `| ... | *${sortedIssues.length - 20} more issues* | ... | ... |\n`;
            }
            report += `
</details>
`;
        }

        report += '\n---\n\n';
    }

    // Add section for contributors in database but with no GitHub activity found
    const contributorsWithoutActivity = [];
    for (const [slug, contributor] of Object.entries(contributorsData)) {
        if (contributor.github) {
            const username = contributor.github.split('/').pop()?.toLowerCase();
            if (username && !contributorActivity[username]) {
                contributorsWithoutActivity.push({ slug, contributor, username });
            }
        }
    }

    if (contributorsWithoutActivity.length > 0) {
        report += `## Contributors in Database Without Detected Activity

These contributors are in the database but no GitHub activity was found:

| Name | GitHub | Existing Badges |
|------|--------|-----------------|
`;
        for (const { slug, contributor, username } of contributorsWithoutActivity) {
            const badges = contributor.badges?.map(b => b.name).join(', ') || 'None';
            report += `| ${contributor.name} | @${username} | ${badges} |\n`;
        }
    }

    // Add leaderboards
    report += `
---

## Leaderboards

### Top Contributors (by Merged PRs)
| Rank | Contributor | PRs |
|------|-------------|-----|
`;
    const topPRContributors = sortedContributors
        .filter(c => c.activity.mergedPRs.length > 0)
        .sort((a, b) => b.activity.mergedPRs.length - a.activity.mergedPRs.length)
        .slice(0, 10);
    topPRContributors.forEach((c, i) => {
        report += `| ${i + 1} | @${c.username} | ${c.activity.mergedPRs.length} |\n`;
    });

    report += `
### Top Reviewers (by Code Reviews)
| Rank | Contributor | Reviews |
|------|-------------|---------|
`;
    const topReviewers = sortedContributors
        .filter(c => c.activity.reviews.length > 0)
        .sort((a, b) => b.activity.reviews.length - a.activity.reviews.length)
        .slice(0, 10);
    topReviewers.forEach((c, i) => {
        report += `| ${i + 1} | @${c.username} | ${c.activity.reviews.length} |\n`;
    });

    report += `
### Top Issue Reporters
| Rank | Contributor | Issues |
|------|-------------|--------|
`;
    const topIssueReporters = sortedContributors
        .filter(c => c.activity.issues.length > 0)
        .sort((a, b) => b.activity.issues.length - a.activity.issues.length)
        .slice(0, 10);
    topIssueReporters.forEach((c, i) => {
        report += `| ${i + 1} | @${c.username} | ${c.activity.issues.length} |\n`;
    });

    report += `
---

## Activity Status Summary

| Status | Count | Contributors |
|--------|-------|--------------|
`;

    const activeLastWeek = sortedContributors.filter(c => {
        const days = c.activity.lastActivity ? daysBetween(c.activity.lastActivity) : null;
        return days !== null && days <= 7;
    });
    const activeLastMonth = sortedContributors.filter(c => {
        const days = c.activity.lastActivity ? daysBetween(c.activity.lastActivity) : null;
        return days !== null && days > 7 && days <= 30;
    });
    const dormant = sortedContributors.filter(c => {
        const days = c.activity.lastActivity ? daysBetween(c.activity.lastActivity) : null;
        return days !== null && days > 90;
    });
    const newJoiners = sortedContributors.filter(c => {
        const firstDate = getEarliestDate(c.activity.firstContribution, c.activity.firstReview);
        const days = firstDate ? daysBetween(firstDate) : null;
        return days !== null && days <= 14;
    });

    report += `| Active (Last 7 days) | ${activeLastWeek.length} | ${activeLastWeek.map(c => '@' + c.username).join(', ') || 'None'} |\n`;
    report += `| Active (Last 30 days) | ${activeLastMonth.length} | ${activeLastMonth.map(c => '@' + c.username).join(', ') || 'None'} |\n`;
    report += `| New Joiners (Last 14 days) | ${newJoiners.length} | ${newJoiners.map(c => '@' + c.username).join(', ') || 'None'} |\n`;
    report += `| Dormant (90+ days) | ${dormant.length} | ${dormant.map(c => '@' + c.username).join(', ') || 'None'} |\n`;

    report += `
---

*Report generated by SEAL Frameworks Report Generator*
`;

    return report;
}

// Main function
async function main() {
    try {
        console.log('📊 SEAL Frameworks - Contributor Activity Report Generator\n');
        console.log('============================================================\n');

        if (!process.env.GITHUB_TOKEN) {
            console.warn('⚠️  No GitHub Token found. Using unauthenticated requests (rate limited to 60/hr)\n');
        } else {
            console.log('🔑 GitHub Token found. Using authenticated requests.\n');
        }

        // Load existing contributors
        let contributorsData = {};
        if (fs.existsSync(CONTRIBUTORS_FILE)) {
            contributorsData = JSON.parse(fs.readFileSync(CONTRIBUTORS_FILE, 'utf8'));
            console.log(`📋 Loaded ${Object.keys(contributorsData).length} contributors from database\n`);
        } else {
            console.warn('⚠️  Contributors file not found. Report will not include database comparisons.\n');
        }

        // Fetch all activity data
        const activityData = await fetchAllActivityData();

        // Organize activity by contributor
        console.log('📊 Organizing activity by contributor...\n');
        const contributorActivity = organizeActivityByContributor(activityData);
        console.log(`   ✅ Organized activity for ${Object.keys(contributorActivity).length} contributors\n`);

        // Generate the report
        console.log('📝 Generating report...\n');
        const report = generateReport(activityData, contributorActivity, contributorsData);

        // Save the report
        fs.writeFileSync(REPORT_OUTPUT, report, 'utf8');

        console.log('============================================================');
        console.log('✅ Report generation complete!\n');
        console.log(`💾 Report saved to: ${REPORT_OUTPUT}`);
        console.log(`\n📊 Report includes:`);
        console.log(`   - Summary statistics`);
        console.log(`   - Badge definitions`);
        console.log(`   - Detailed activity for ${Object.keys(contributorActivity).length} contributors`);
        console.log(`   - Leaderboards`);
        console.log(`   - Activity status summary`);

    } catch (error) {
        console.error('❌ Fatal Error:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

main();