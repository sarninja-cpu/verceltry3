#!/usr/bin/env node

/**
 * Generate dynamic badges based on real GitHub contributor activity
 * 
 * This script fetches contributor data from the GitHub API and assigns badges
 * based on their actual contributions to the repository.
 * 
 * It ensures historical accuracy by calculating the exact date of milestones
 * (e.g., the date of the 25th contribution) rather than using the current date.
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

// Debug token presence
if (process.env.GITHUB_TOKEN) {
    console.log(`🔑 GitHub Token found (${process.env.GITHUB_TOKEN.length} characters)`);
} else {
    console.log('⚠️  No GitHub Token found in .env or system environment');
    console.log('   Using unauthenticated requests (rate limited to 60/hr)');
}

// Configuration
const REPO_OWNER = 'security-alliance';
const REPO_NAME = 'frameworks';
const CONTRIBUTORS_FILE = path.join(__dirname, '../docs/pages/config/contributors.json');
const OUTPUT_FILE = path.join(__dirname, 'dynamic-badges.json');

// List of badges that are managed by this script (will be overwritten/updated)
const MANAGED_BADGE_NAMES = [
    'Contributor-5', 'Contributor-10', 'Contributor-25',
    'Reviewer-10', 'Reviewer-25', 'Top-Reviewer',
    'Active-Last-30d', 'Active-Last-90d', 'Dormant-90d+',
    'New-Joiner', 'Early-Contributor',
    'Issue-Opener-5', 'Issue-Opener-10', 'Issue-Opener-25'
];

// GitHub API base URL
const GITHUB_API = 'https://api.github.com';

// Helper for Search API rate limiting (max 30/min = 1 every 2s, we use 3.5s to be safe)
let lastSearchTime = 0;
async function searchRateLimit() {
    const now = Date.now();
    const wait = Math.max(0, 3500 - (now - lastSearchTime));
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastSearchTime = Date.now();
}

// Helper function to make GitHub API requests
async function githubRequest(endpoint, isSearch = false) {
    if (isSearch) await searchRateLimit();

    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SEAL-Frameworks-Badge-Generator'
    };

    if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(`${GITHUB_API}${endpoint}`, { headers });

    if (!response.ok) {
        const errorBody = await response.text();
        // If rate limited, log a clear message
        if (response.status === 403 && (errorBody.includes('rate limit') || errorBody.includes('secondary rate limit'))) {
            console.warn(`⏳ Rate limit hit for ${endpoint}. Skipping this check.`);
            return null;
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}\n${errorBody}`);
    }

    return response.json();
}

/**
 * Get highly accurate date for a milestone
 * @param {string} username - GitHub username
 * @param {number} targetIndex - e.g., 25 for "25th oldest"
 * @param {string} type - 'commits', 'prs', or 'reviews'
 */
async function getAccurateMilestoneDate(username, targetIndex, type = 'commits') {
    try {
        let totalCount = 0;
        let endpoint;
        let isSearch = false;

        if (type === 'commits') {
            const searchData = await githubRequest(`/search/commits?q=repo:${REPO_OWNER}/${REPO_NAME}+author:${username}&per_page=1`, true);
            totalCount = searchData?.total_count || 0;
            endpoint = (page) => `/repos/${REPO_OWNER}/${REPO_NAME}/commits?author=${username}&per_page=100&page=${page}`;
            isSearch = false; // Commits API is not Search API
        } else if (type === 'prs') {
            const searchData = await githubRequest(`/search/issues?q=repo:${REPO_OWNER}/${REPO_NAME}+type:pr+author:${username}&per_page=1`, true);
            totalCount = searchData?.total_count || 0;
            endpoint = (page) => `/search/issues?q=repo:${REPO_OWNER}/${REPO_NAME}+type:pr+author:${username}&per_page=100&page=${page}`;
            isSearch = true;
        } else if (type === 'reviews') {
            const searchData = await githubRequest(`/search/issues?q=repo:${REPO_OWNER}/${REPO_NAME}+type:pr+reviewed-by:${username}&per_page=1`, true);
            totalCount = searchData?.total_count || 0;
            endpoint = (page) => `/search/issues?q=repo:${REPO_OWNER}/${REPO_NAME}+type:pr+reviewed-by:${username}&per_page=100&page=${page}`;
            isSearch = true;
        } else if (type === 'issues') {
            const searchData = await githubRequest(`/search/issues?q=repo:${REPO_OWNER}/${REPO_NAME}+type:issue+author:${username}&per_page=1`, true);
            totalCount = searchData?.total_count || 0;
            endpoint = (page) => `/search/issues?q=repo:${REPO_OWNER}/${REPO_NAME}+type:issue+author:${username}&per_page=100&page=${page}`;
            isSearch = true;
        }

        if (totalCount < targetIndex) {
            return null; // Don't award if threshold not met
        }

        // Index from newest (GitHub API default order)
        const indexFromNewest = totalCount - targetIndex + 1;
        const perPage = 100;
        const page = Math.ceil(indexFromNewest / perPage);
        const offset = (indexFromNewest - 1) % perPage;

        const data = await githubRequest(endpoint(page), isSearch);
        const items = data?.items || data;

        if (items && items[offset]) {
            const item = items[offset];
            if (item.commit) return item.commit.author.date.split('T')[0];
            if (item.created_at) return item.created_at.split('T')[0];
        }
    } catch (err) {
        console.warn(`   ⚠️  Failed to fetch milestone ${targetIndex} for ${type}: ${err.message}`);
    }
    return null;
}

// Determine badges based on activity
async function determineBadges(contributor, userDetails) {
    const username = contributor.login;
    const badges = [];
    const contributions = contributor.contributions;

    console.log(`   📅 Finding milestone dates for ${username} (Total Contributions: ${contributions})...`);

    // 1. Contributor Milestones (based on total contributions)
    // We use the commit history as the primary source for the date
    if (contributions >= 25) {
        const date = await getAccurateMilestoneDate(username, 25, 'commits') || await getAccurateMilestoneDate(username, 1, 'commits');
        if (date) badges.push({ name: 'Contributor-25', assigned: date });
    } else if (contributions >= 10) {
        const date = await getAccurateMilestoneDate(username, 10, 'commits') || await getAccurateMilestoneDate(username, 1, 'commits');
        if (date) badges.push({ name: 'Contributor-10', assigned: date });
    } else if (contributions >= 5) {
        const date = await getAccurateMilestoneDate(username, 5, 'commits') || await getAccurateMilestoneDate(username, 1, 'commits');
        if (date) badges.push({ name: 'Contributor-5', assigned: date });
    }

    // 2. Review Milestones
    const r25 = await getAccurateMilestoneDate(username, 25, 'reviews');
    if (r25) badges.push({ name: 'Reviewer-25', assigned: r25 });
    else {
        const r10 = await getAccurateMilestoneDate(username, 10, 'reviews');
        if (r10) badges.push({ name: 'Reviewer-10', assigned: r10 });
    }

    // 3. Early Contributor (date of 1st commit)
    const firstCommit = await getAccurateMilestoneDate(username, 1, 'commits');
    if (firstCommit) {
        const repoCreationDate = new Date('2023-01-01');
        const firstDate = new Date(firstCommit);

        // Early Contributor: joined in the first 90 days of repo history
        if ((firstDate - repoCreationDate) / (1000 * 60 * 60 * 24) < 90) {
            badges.push({ name: 'Early-Contributor', assigned: firstCommit });
        }

        // New-Joiner: joined in the last 30 days
        const diffFromNow = Math.ceil(Math.abs(new Date() - firstDate) / (1000 * 60 * 60 * 24));
        if (diffFromNow <= 30) {
            badges.push({ name: 'New-Joiner', assigned: firstCommit });
        }
    }

    // 4. Top-Reviewer (if reviews >= 50)
    const r50 = await getAccurateMilestoneDate(username, 50, 'reviews');
    if (r50) badges.push({ name: 'Top-Reviewer', assigned: r50 });

    // 5. Issue Opener Milestones
    const i25 = await getAccurateMilestoneDate(username, 25, 'issues');
    if (i25) badges.push({ name: 'Issue-Opener-25', assigned: i25 });
    else {
        const i10 = await getAccurateMilestoneDate(username, 10, 'issues');
        if (i10) badges.push({ name: 'Issue-Opener-10', assigned: i10 });
        else {
            const i5 = await getAccurateMilestoneDate(username, 5, 'issues');
            if (i5) badges.push({ name: 'Issue-Opener-5', assigned: i5 });
        }
    }

    // 6. Activity Status (last commit, review, or issue)
    const lastCommits = await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/commits?author=${username}&per_page=1`);
    const lastReviewDate = await getAccurateMilestoneDate(username, 1, 'reviews');
    const lastIssueDate = await getAccurateMilestoneDate(username, 1, 'issues');

    let lastActivityDate = null;
    if (lastCommits && lastCommits[0]) {
        lastActivityDate = lastCommits[0].commit.author.date.split('T')[0];
    }

    if (lastReviewDate && (!lastActivityDate || new Date(lastReviewDate) > new Date(lastActivityDate))) {
        lastActivityDate = lastReviewDate;
    }

    if (lastIssueDate && (!lastActivityDate || new Date(lastIssueDate) > new Date(lastActivityDate))) {
        lastActivityDate = lastIssueDate;
    }

    if (lastActivityDate) {
        const diff = Math.ceil(Math.abs(new Date() - new Date(lastActivityDate)) / (1000 * 60 * 60 * 24));

        if (diff <= 30) badges.push({ name: 'Active-Last-30d', assigned: lastActivityDate });
        else if (diff <= 90) badges.push({ name: 'Active-Last-90d', assigned: lastActivityDate });
        else badges.push({ name: 'Dormant-90d+', assigned: lastActivityDate });
    }

    return badges;
}

// Helper functions
async function getContributors() {
    return await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/contributors?per_page=100`);
}

async function getUserDetails(username) {
    return await githubRequest(`/users/${username}`);
}

function createSlug(username) {
    return username.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Main function
async function main() {
    try {
        console.log('🏅 Starting historical-sync badge generation...\n');
        console.log('   Note: This will take roughly 10-15s per contributor to ensure perfect dating.');

        if (!fs.existsSync(CONTRIBUTORS_FILE)) {
            console.error('❌ Contributors file not found:', CONTRIBUTORS_FILE);
            process.exit(1);
        }

        const contributorsData = JSON.parse(fs.readFileSync(CONTRIBUTORS_FILE, 'utf8'));
        const githubContributors = await getContributors();
        console.log(`Syncing ${githubContributors.length} contributors...\n`);

        let updatedCount = 0;
        let newCount = 0;
        const seenSlugs = new Set();

        for (const contributor of githubContributors) {
            const username = contributor.login;
            if (contributor.type === 'Bot' || username.includes('[bot]')) continue;

            const matchingSlug = Object.keys(contributorsData).find(slug => {
                const c = contributorsData[slug];
                return c.github && (c.github.toLowerCase().includes(username.toLowerCase()) ||
                    c.github.toLowerCase().endsWith(`/${username.toLowerCase()}`));
            });

            console.log(`🔍 Processing ${username}...`);
            const userDetails = await getUserDetails(username);
            const dynamicBadges = await determineBadges(contributor, userDetails);

            const targetSlug = matchingSlug || createSlug(username);

            if (!matchingSlug) {
                // Create new
                contributorsData[targetSlug] = {
                    slug: targetSlug,
                    name: userDetails?.name || username,
                    avatar: contributor.avatar_url,
                    github: `https://github.com/${username}`,
                    role: "contributor",
                    steward: "",
                    badges: dynamicBadges
                };
                newCount++;
                console.log(`   ➕ Created new contributor: ${targetSlug}`);
            } else {
                // Update existing (overwrite managed badges)
                const currentBadges = contributorsData[targetSlug].badges || [];
                const manualBadges = currentBadges.filter(b => !MANAGED_BADGE_NAMES.includes(b.name));
                contributorsData[targetSlug].badges = [...manualBadges, ...dynamicBadges];
                updatedCount++;
                console.log(`   ✅ Updated badges for ${targetSlug}`);
            }

            seenSlugs.add(targetSlug);

            // Delay between users to spread out requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Cleanup
        let deletedCount = 0;
        for (const slug of Object.keys(contributorsData)) {
            if (!seenSlugs.has(slug) && contributorsData[slug].github) {
                console.log(`🗑️  Removing ${slug}`);
                delete contributorsData[slug];
                deletedCount++;
            }
        }

        fs.writeFileSync(CONTRIBUTORS_FILE, JSON.stringify(contributorsData, null, 2));
        console.log(`\n✅ Done! New: ${newCount} | Updated: ${updatedCount} | Deleted: ${deletedCount}`);

    } catch (error) {
        console.error('❌ Fatal Error:', error.message);
        process.exit(1);
    }
}

main();
