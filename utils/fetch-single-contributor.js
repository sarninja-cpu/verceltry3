#!/usr/bin/env node

/**
 * Fetch Single Contributor Activity
 *
 * Fetches GitHub activity for a single contributor and saves it to a JSON file.
 * Limited to first 25 items for PRs, issues, and reviews.
 *
 * Usage: node fetch-single-contributor.js <github-username>
 * Example: node fetch-single-contributor.js mattaereal
 *
 * Output: contributor-<username>-activity.json
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
const GITHUB_API = 'https://api.github.com';
const LIMIT = 25; // Limit for PRs, issues, and reviews

// Get username from command line
const targetUsername = process.argv[2]?.toLowerCase();

if (!targetUsername) {
    console.error('❌ Usage: node fetch-single-contributor.js <github-username>');
    console.error('   Example: node fetch-single-contributor.js mattaereal');
    process.exit(1);
}

// Helper function to make GitHub API requests with pagination
async function githubRequestWithPagination(endpoint) {
    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SEAL-Frameworks-Contributor-Fetcher'
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

        // Check rate limit
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
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}\n${errorBody}`);
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

// Format date nicely
function formatDate(dateString) {
    if (!dateString) return null;
    return new Date(dateString).toISOString();
}

// Calculate days since a date
function daysSince(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    return Math.floor((now - date) / (1000 * 60 * 60 * 24));
}

async function main() {
    console.log(`\n🔍 Fetching all activity for: ${targetUsername}\n`);
    console.log('================================================\n');

    if (!process.env.GITHUB_TOKEN) {
        console.warn('⚠️  No GitHub Token found. Using unauthenticated requests (rate limited to 60/hr)\n');
    } else {
        console.log('🔑 GitHub Token found. Using authenticated requests.\n');
    }

    const contributorData = {
        username: targetUsername,
        fetchedAt: new Date().toISOString(),
        summary: {},
        first25MergedPRs: [],
        first25IssuesOpened: [],
        first25Reviews: [],
        timeline: {
            firstContribution: null,
            firstReview: null,
            lastActivity: null
        }
    };

    // Track all dates for timeline calculation
    const allMergedPRDates = [];
    const allIssueDates = [];
    const allReviewDates = [];
    let totalMergedPRs = 0;
    let totalIssues = 0;
    let totalReviews = 0;

    try {
        // 1. Fetch PRs authored by this user
        console.log('📥 Fetching pull requests...');
        const allPRs = await githubRequestWithPagination(
            `/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=closed&sort=created&direction=asc`
        );

        const userMergedPRs = allPRs
            .filter(pr => pr.user?.login?.toLowerCase() === targetUsername && pr.merged_at)
            .sort((a, b) => new Date(a.merged_at) - new Date(b.merged_at));

        totalMergedPRs = userMergedPRs.length;

        // Get first 25 merged PRs
        for (const pr of userMergedPRs.slice(0, LIMIT)) {
            contributorData.first25MergedPRs.push({
                number: pr.number,
                title: pr.title,
                url: pr.html_url,
                createdAt: formatDate(pr.created_at),
                mergedAt: formatDate(pr.merged_at),
                labels: pr.labels.map(l => l.name)
            });
        }

        // Collect all merged dates for timeline
        allMergedPRDates.push(...userMergedPRs.map(pr => pr.merged_at));

        console.log(`   ✅ Found ${totalMergedPRs} merged PRs (showing first ${contributorData.first25MergedPRs.length})`);

        // 2. Fetch issues opened by this user
        console.log('📥 Fetching issues...');
        const allIssues = await githubRequestWithPagination(
            `/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=all&sort=created&direction=asc&creator=${targetUsername}`
        );

        const pureIssues = allIssues
            .filter(issue => !issue.pull_request)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        totalIssues = pureIssues.length;

        // Get first 25 issues
        for (const issue of pureIssues.slice(0, LIMIT)) {
            contributorData.first25IssuesOpened.push({
                number: issue.number,
                title: issue.title,
                url: issue.html_url,
                state: issue.state,
                createdAt: formatDate(issue.created_at),
                labels: issue.labels.map(l => l.name)
            });
        }

        // Collect all issue dates for timeline
        allIssueDates.push(...pureIssues.map(issue => issue.created_at));

        console.log(`   ✅ Found ${totalIssues} issues (showing first ${contributorData.first25IssuesOpened.length})`);

        // 3. Fetch PR reviews by this user
        console.log('📥 Fetching PR reviews (this may take a moment)...');
        const closedPRs = await githubRequestWithPagination(
            `/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=closed&sort=created&direction=asc`
        );
        const openPRs = await githubRequestWithPagination(
            `/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=open&sort=created&direction=asc`
        );
        const allRepoPRs = [...closedPRs, ...openPRs];

        const allUserReviews = [];
        let reviewsProcessed = 0;

        for (const pr of allRepoPRs) {
            try {
                const reviews = await githubRequestWithPagination(
                    `/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pr.number}/reviews`
                );

                const userReviews = reviews.filter(r =>
                    r.user?.login?.toLowerCase() === targetUsername &&
                    (r.state === 'APPROVED' || r.state === 'CHANGES_REQUESTED')
                );

                for (const review of userReviews) {
                    allUserReviews.push({
                        prNumber: pr.number,
                        prTitle: pr.title,
                        prUrl: pr.html_url,
                        prAuthor: pr.user?.login,
                        state: review.state,
                        submittedAt: review.submitted_at
                    });
                }

                reviewsProcessed++;
                if (reviewsProcessed % 50 === 0) {
                    console.log(`   ... processed ${reviewsProcessed}/${allRepoPRs.length} PRs`);
                }
            } catch (error) {
                console.warn(`   ⚠️  Could not fetch reviews for PR #${pr.number}`);
            }

            if (reviewsProcessed % 20 === 0) {
                await new Promise(r => setTimeout(r, 500));
            }
        }

        // Sort reviews by date
        allUserReviews.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
        totalReviews = allUserReviews.length;

        // If less than 5 reviews, only show the first one; otherwise show first 25
        const reviewLimit = totalReviews < 5 ? 1 : LIMIT;
        for (const review of allUserReviews.slice(0, reviewLimit)) {
            contributorData.first25Reviews.push({
                prNumber: review.prNumber,
                prTitle: review.prTitle,
                prUrl: review.prUrl,
                prAuthor: review.prAuthor,
                state: review.state,
                submittedAt: formatDate(review.submittedAt)
            });
        }

        // Collect all review dates for timeline
        allReviewDates.push(...allUserReviews.map(r => r.submittedAt));

        console.log(`   ✅ Found ${totalReviews} reviews (showing first ${contributorData.first25Reviews.length})`);

        // 4. Calculate timeline
        console.log('\n📊 Calculating timeline...');

        // Find first contribution (first merged PR or first issue, whichever is earlier)
        const allContributionDates = [...allMergedPRDates, ...allIssueDates].filter(Boolean).sort();
        if (allContributionDates.length > 0) {
            contributorData.timeline.firstContribution = formatDate(allContributionDates[0]);
        }

        // Find first review
        if (allReviewDates.length > 0) {
            const sortedReviewDates = [...allReviewDates].sort();
            contributorData.timeline.firstReview = formatDate(sortedReviewDates[0]);
        }

        // Find last activity (most recent of any activity type)
        const allActivityDates = [...allMergedPRDates, ...allIssueDates, ...allReviewDates].filter(Boolean);
        if (allActivityDates.length > 0) {
            const sortedActivityDates = allActivityDates.sort().reverse();
            contributorData.timeline.lastActivity = formatDate(sortedActivityDates[0]);
        }

        // 5. Build summary
        contributorData.summary = {
            totalMergedPRs,
            totalIssuesOpened: totalIssues,
            totalReviews,
            firstContribution: contributorData.timeline.firstContribution,
            firstReview: contributorData.timeline.firstReview,
            lastActivity: contributorData.timeline.lastActivity,
            daysSinceFirstContribution: daysSince(contributorData.timeline.firstContribution),
            daysSinceLastActivity: daysSince(contributorData.timeline.lastActivity)
        };

        // Save to file
        const outputFile = path.join(__dirname, `../contributor-${targetUsername}-activity.json`);
        fs.writeFileSync(outputFile, JSON.stringify(contributorData, null, 2) + '\n', 'utf8');

        // Print summary
        console.log('\n================================================');
        console.log(`✅ Fetch complete for: ${targetUsername}\n`);
        console.log('📊 Summary:');
        console.log(`   - Merged PRs: ${contributorData.summary.totalMergedPRs} (showing first ${LIMIT})`);
        console.log(`   - Issues Opened: ${contributorData.summary.totalIssuesOpened} (showing first ${LIMIT})`);
        console.log(`   - Reviews: ${contributorData.summary.totalReviews} (showing first ${LIMIT})`);
        console.log(`\n📅 Timeline:`);
        console.log(`   - First Contribution: ${contributorData.timeline.firstContribution || 'N/A'}`);
        console.log(`   - First Review: ${contributorData.timeline.firstReview || 'N/A'}`);
        console.log(`   - Last Activity: ${contributorData.timeline.lastActivity || 'N/A'}`);
        if (contributorData.summary.daysSinceLastActivity !== null) {
            console.log(`   - Days since last activity: ${contributorData.summary.daysSinceLastActivity}`);
        }
        console.log(`\n💾 Saved to: ${outputFile}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

main();
