#!/usr/bin/env node

/**
 * Badge Generator for SEAL Frameworks Contributors
 *
 * Badge Categories:
 * - Role Badges: Manually assigned (Framework-Steward, Core-Contributor, Lead)
 * - Milestone Badges: Auto-generated persistent achievements
 * - Activity Badges: Auto-generated time-based status
 *
 * Required GitHub Token Permissions:
 * - public_repo (read-only access to public repositories) 
 * - OR no special scopes if repo is public (just basic read access)
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

// Repo creation date for Early-Contributor badge (adjust as needed)
const REPO_CREATION_DATE = new Date('2023-01-01');
// How many days after repo creation counts as "early"
const EARLY_CONTRIBUTOR_WINDOW_DAYS = 90;

// Role badges are manually assigned - script should preserve these
const ROLE_BADGES = new Set(['Framework-Steward', 'Core-Contributor', 'Lead']);

// Activity badges that should always use current date and be recalculated each run
const ACTIVITY_BADGES = new Set(['Active-Last-7d', 'Active-Last-30d', 'Dormant-90d+', 'New-Joiner']);

// All valid badge names for validation
const VALID_BADGES = new Set([
    // Role badges (manually assigned)
    'Framework-Steward',
    'Core-Contributor',
    'Lead',
    // Milestone badges (auto-assigned)
    'Contributor-25',
    'Contributor-10',
    'Contributor-5',
    'Reviewer-25',
    'Reviewer-10',
    'Issue-Opener-25',
    'Issue-Opener-10',
    'Issue-Opener-5',
    'Early-Contributor',
    'First-Contribution',
    'First-Review',
    // Activity badges (auto-assigned, time-based)
    'Active-Last-7d',
    'Active-Last-30d',
    'New-Joiner',
    'Dormant-90d+'
]);

// Helper function to make GitHub API requests with pagination and rate limit handling
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

        // Check rate limit headers
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
                console.warn(`⏳ Rate limit hit for ${endpoint}. Returning partial results.`);
                return allResults;
            }
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}\n${errorBody}`);
        }

        const data = await response.json();

        // Handle search API response format
        if (data.items) {
            allResults.push(...data.items);
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
        await new Promise(r => setTimeout(r, 200));
    }

    return allResults;
}

// Format date to YYYY-MM-DD
function formatDate(dateString) {
    if (!dateString) return null;
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0];
    } catch {
        return null;
    }
}

// Calculate days between two dates
function daysBetween(date1, date2 = new Date()) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
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
        let processedPRs = 0;

        // Fetch reviews for all closed PRs (not just merged) to capture review activity
        for (const pr of allPRs) {
            try {
                const reviews = await githubRequestWithPagination(
                    `/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pr.number}/reviews`
                );
                // Filter out PENDING and COMMENTED reviews, keep APPROVED and CHANGES_REQUESTED
                const meaningfulReviews = reviews.filter(r =>
                    r.state === 'APPROVED' || r.state === 'CHANGES_REQUESTED'
                );
                allReviews.push(...meaningfulReviews);
                processedPRs++;

                // Progress indicator every 50 PRs
                if (processedPRs % 50 === 0) {
                    console.log(`   ... processed ${processedPRs}/${allPRs.length} PRs`);
                }
            } catch (error) {
                console.warn(`   ⚠️  Could not fetch reviews for PR #${pr.number}: ${error.message}`);
            }

            // Add delay every 20 PRs to be nice to GitHub API
            if (processedPRs % 20 === 0) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        console.log(`   ✅ Found ${allReviews.length} meaningful PR reviews (APPROVED/CHANGES_REQUESTED)\n`);

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
                firstReview: null,
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

            // Track first contribution (use merged_at for PRs as that's when it was accepted)
            const mergedDate = new Date(pr.merged_at);
            if (!contributorActivity[username].firstContribution ||
                mergedDate < new Date(contributorActivity[username].firstContribution)) {
                contributorActivity[username].firstContribution = pr.merged_at;
            }

            // Track last activity
            if (!contributorActivity[username].lastActivity ||
                mergedDate > new Date(contributorActivity[username].lastActivity)) {
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
                title: issue.title,
                state: issue.state
            });

            // Track first contribution
            const issueDate = new Date(issue.created_at);
            if (!contributorActivity[username].firstContribution ||
                issueDate < new Date(contributorActivity[username].firstContribution)) {
                contributorActivity[username].firstContribution = issue.created_at;
            }

            // Track last activity
            if (!contributorActivity[username].lastActivity ||
                issueDate > new Date(contributorActivity[username].lastActivity)) {
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

            // Track first review
            const reviewDate = new Date(review.submitted_at);
            if (!contributorActivity[username].firstReview ||
                reviewDate < new Date(contributorActivity[username].firstReview)) {
                contributorActivity[username].firstReview = review.submitted_at;
            }

            // Track last activity
            if (!contributorActivity[username].lastActivity ||
                reviewDate > new Date(contributorActivity[username].lastActivity)) {
                contributorActivity[username].lastActivity = review.submitted_at;
            }
        }
    }

    console.log(`   ✅ Organized activity for ${Object.keys(contributorActivity).length} contributors\n`);
    return contributorActivity;
}

// Generate badges for a contributor with correct date assignment
function generateBadges(username, activity, existingBadges = []) {
    const badges = [];
    const today = formatDate(new Date());

    // Create a map of existing badge dates for milestone badges (to preserve original dates)
    const existingBadgeDates = {};
    const existingRoleBadges = [];

    for (const badge of existingBadges) {
        if (badge.name) {
            if (ROLE_BADGES.has(badge.name)) {
                // Preserve role badges exactly as they are
                existingRoleBadges.push(badge);
            } else if (!ACTIVITY_BADGES.has(badge.name)) {
                // Store dates for milestone badges
                existingBadgeDates[badge.name] = badge.assigned;
            }
        }
    }

    // Add preserved role badges first
    badges.push(...existingRoleBadges);

    // === MILESTONE BADGES (persistent, preserve original dates) ===

    // Contributor Milestones (based on merged PRs)
    const prCount = activity.mergedPRs.length;
    const sortedPRs = [...activity.mergedPRs].sort((a, b) =>
        new Date(a.merged_at) - new Date(b.merged_at)
    );

    if (prCount >= 1 || activity.issues.length >= 1) {
        badges.push({
            name: 'First-Contribution',
            assigned: existingBadgeDates['First-Contribution'] ||
                formatDate(activity.firstContribution) || today
        });
    }
    if (prCount >= 5) {
        badges.push({
            name: 'Contributor-5',
            assigned: existingBadgeDates['Contributor-5'] ||
                formatDate(sortedPRs[4]?.merged_at) || today
        });
    }
    if (prCount >= 10) {
        badges.push({
            name: 'Contributor-10',
            assigned: existingBadgeDates['Contributor-10'] ||
                formatDate(sortedPRs[9]?.merged_at) || today
        });
    }
    if (prCount >= 25) {
        badges.push({
            name: 'Contributor-25',
            assigned: existingBadgeDates['Contributor-25'] ||
                formatDate(sortedPRs[24]?.merged_at) || today
        });
    }

    // Reviewer Milestones
    const reviewCount = activity.reviews.length;
    const sortedReviews = [...activity.reviews].sort((a, b) =>
        new Date(a.submitted_at) - new Date(b.submitted_at)
    );

    if (reviewCount >= 1) {
        badges.push({
            name: 'First-Review',
            assigned: existingBadgeDates['First-Review'] ||
                formatDate(sortedReviews[0]?.submitted_at) || today
        });
    }
    if (reviewCount >= 10) {
        badges.push({
            name: 'Reviewer-10',
            assigned: existingBadgeDates['Reviewer-10'] ||
                formatDate(sortedReviews[9]?.submitted_at) || today
        });
    }
    if (reviewCount >= 25) {
        badges.push({
            name: 'Reviewer-25',
            assigned: existingBadgeDates['Reviewer-25'] ||
                formatDate(sortedReviews[24]?.submitted_at) || today
        });
    }

    // Issue Opener Milestones
    const issueCount = activity.issues.length;
    const sortedIssues = [...activity.issues].sort((a, b) =>
        new Date(a.created_at) - new Date(b.created_at)
    );

    if (issueCount >= 5) {
        badges.push({
            name: 'Issue-Opener-5',
            assigned: existingBadgeDates['Issue-Opener-5'] ||
                formatDate(sortedIssues[4]?.created_at) || today
        });
    }
    if (issueCount >= 10) {
        badges.push({
            name: 'Issue-Opener-10',
            assigned: existingBadgeDates['Issue-Opener-10'] ||
                formatDate(sortedIssues[9]?.created_at) || today
        });
    }
    if (issueCount >= 25) {
        badges.push({
            name: 'Issue-Opener-25',
            assigned: existingBadgeDates['Issue-Opener-25'] ||
                formatDate(sortedIssues[24]?.created_at) || today
        });
    }

    // Early Contributor - contributed within first 90 days of repo creation
    if (activity.firstContribution) {
        const firstDate = new Date(activity.firstContribution);
        const daysSinceRepoCreation = daysBetween(REPO_CREATION_DATE, firstDate);

        if (daysSinceRepoCreation !== null && daysSinceRepoCreation <= EARLY_CONTRIBUTOR_WINDOW_DAYS) {
            badges.push({
                name: 'Early-Contributor',
                assigned: existingBadgeDates['Early-Contributor'] ||
                    formatDate(activity.firstContribution)
            });
        }
    }

    // Preserve any existing milestone badges that weren't regenerated
    // (e.g., manually assigned Early-Contributor, or badges from incomplete API data)
    for (const badge of existingBadges) {
        if (!ROLE_BADGES.has(badge.name) && !ACTIVITY_BADGES.has(badge.name)) {
            if (!badges.find(b => b.name === badge.name)) {
                badges.push(badge);
            }
        }
    }

    // === ACTIVITY BADGES (time-based, always recalculated) ===

    // New-Joiner: first contribution/review was within the last 2 weeks (14 days)
    const firstActivityDate = getEarliestDate(activity.firstContribution, activity.firstReview);
    if (firstActivityDate) {
        const daysSinceFirst = daysBetween(firstActivityDate);
        if (daysSinceFirst !== null && daysSinceFirst <= 14) {
            badges.push({
                name: 'New-Joiner',
                lastActive: formatDate(firstActivityDate)
            });
        }
    }

    // Activity status badges (mutually exclusive)
    if (activity.lastActivity) {
        const daysSinceLast = daysBetween(activity.lastActivity);
        const lastActiveDate = formatDate(activity.lastActivity);

        if (daysSinceLast !== null) {
            if (daysSinceLast <= 7) {
                badges.push({
                    name: 'Active-Last-7d',
                    lastActive: lastActiveDate
                });
            } else if (daysSinceLast <= 30) {
                badges.push({
                    name: 'Active-Last-30d',
                    lastActive: lastActiveDate
                });
            } else if (daysSinceLast > 90) {
                // Dormant: 90+ days since last contribution or review
                badges.push({
                    name: 'Dormant-90d+',
                    lastActive: lastActiveDate
                });
            }
        }
    }

    return badges;
}

// Helper to get the earliest of two dates
function getEarliestDate(date1, date2) {
    if (!date1 && !date2) return null;
    if (!date1) return date2;
    if (!date2) return date1;
    return new Date(date1) < new Date(date2) ? date1 : date2;
}

// Main function
async function main() {
    try {
        console.log('🏅 SEAL Frameworks - Badge Generator\n');
        console.log('================================================\n');

        if (!process.env.GITHUB_TOKEN) {
            console.warn('⚠️  No GitHub Token found. Using unauthenticated requests (rate limited to 60/hr)\n');
            console.warn('    For better performance, create a token with "public_repo" read access.\n');
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
        let skippedCount = 0;

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
            let slug = githubUsernameToSlug[username];

            if (!slug) {
                // Auto-add new contributors not yet in the database
                slug = username;
                contributorsData[slug] = {
                    slug: slug,
                    name: username,
                    avatar: `https://avatars.githubusercontent.com/${username}`,
                    github: `https://github.com/${username}`,
                    twitter: null,
                    website: null,
                    company: null,
                    job_title: null,
                    role: 'contributor',
                    description: 'Frameworks Contributor',
                    badges: []
                };
                githubUsernameToSlug[username] = slug;
                console.log(`   🆕 Auto-added new contributor: ${username}`);
            }

            const contributor = contributorsData[slug];

            // Get existing badges (handle both old nested structure and flat array)
            let existingBadges = [];
            if (contributor.badges) {
                if (typeof contributor.badges === 'object' && !Array.isArray(contributor.badges)) {
                    // Old nested structure: { static: [], dynamic: [] }
                    existingBadges = [
                        ...(contributor.badges.static || []),
                        ...(contributor.badges.dynamic || [])
                    ];
                } else if (Array.isArray(contributor.badges)) {
                    // Already flat array
                    existingBadges = contributor.badges;
                }
            }

            // Generate new badges with preserved dates for milestone badges
            const newBadges = generateBadges(username, activity, existingBadges);

            // Check if badges changed (compare names only, ignore date changes for activity badges)
            const oldBadgeNames = existingBadges.map(b => b.name).sort().join(',');
            const newBadgeNames = newBadges.map(b => b.name).sort().join(',');

            // Update to simple flat array structure
            contributor.badges = newBadges;

            if (oldBadgeNames !== newBadgeNames) {
                updatedCount++;
                console.log(`   ✅ Updated ${contributor.name} (@${username})`);
                console.log(`      Old: ${oldBadgeNames || 'none'}`);
                console.log(`      New: ${newBadgeNames || 'none'}`);
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
        console.log(`   - Contributors in database: ${Object.keys(contributorsData).length}`);
        console.log(`   - Contributors with activity: ${Object.keys(contributorActivity).length}`);
        console.log(`   - Badges updated: ${updatedCount}`);
        console.log(`   - Skipped (not in database): ${skippedCount}`);
        console.log(`\n💾 Saved to ${CONTRIBUTORS_FILE}`);
        console.log(`\n💡 Token permissions needed: public_repo (read-only) or no special scopes for public repos`);

        // Print badge legend
        console.log('\n📋 Badge Legend:');
        console.log('   Role Badges (manually assigned):');
        console.log('      - Framework-Steward: Official maintainer');
        console.log('      - Core-Contributor: Elite contributor with governance');
        console.log('      - Lead: Initiative lead and project maintainer');
        console.log('   Milestone Badges (auto-assigned):');
        console.log('      - First-Contribution: Made first merged PR');
        console.log('      - Contributor-5/10/25: Merged PR milestones');
        console.log('      - First-Review: Completed first code review');
        console.log('      - Reviewer-10/25: Review milestones');
        console.log('      - Issue-Opener-5/10/25: Issue opening milestones');
        console.log('      - Early-Contributor: Contributed in first 90 days');
        console.log('   Activity Badges (auto-assigned, time-based):');
        console.log('      - New-Joiner: First activity within last 14 days');
        console.log('      - Active-Last-7d: Active in last 7 days');
        console.log('      - Active-Last-30d: Active in last 30 days');
        console.log('      - Dormant-90d+: No activity for 90+ days');

    } catch (error) {
        console.error('❌ Fatal Error:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

main();
