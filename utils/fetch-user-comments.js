#!/usr/bin/env node

/**
 * Fetch PR Comments for a User
 * 
 * Fetches all PR comments (issue comments + review comments) for a specific user.
 * Shows: total count, first comment date, and list of all comments with dates.
 * 
 * Usage: node fetch-user-comments.js <github-username>
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

const REPO_OWNER = 'security-alliance';
const REPO_NAME = 'frameworks';
const GITHUB_API = 'https://api.github.com';

const targetUsername = process.argv[2]?.toLowerCase();

if (!targetUsername) {
    console.error('Usage: node fetch-user-comments.js <github-username>');
    process.exit(1);
}

async function githubRequest(endpoint) {
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
        
        const remaining = response.headers.get('X-RateLimit-Remaining');
        if (remaining && parseInt(remaining) < 10) {
            const reset = response.headers.get('X-RateLimit-Reset');
            const resetTime = new Date(parseInt(reset) * 1000);
            const waitTime = Math.max(0, resetTime - Date.now());
            console.warn(`Rate limit low. Waiting ${Math.ceil(waitTime / 1000)}s...`);
            await new Promise(r => setTimeout(r, waitTime + 1000));
        }

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (Array.isArray(data)) {
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

async function main() {
    console.log(`\nFetching PR comments for: ${targetUsername}\n`);
    console.log('================================================\n');

    if (!process.env.GITHUB_TOKEN) {
        console.warn('No GitHub Token. Rate limited to 60 requests/hr.\n');
    }

    const allComments = [];

    // 1. Fetch issue comments (general PR comments)
    console.log('Fetching issue comments on PRs...');
    const issueComments = await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/issues/comments`);
    
    const userIssueComments = issueComments.filter(c => 
        c.user?.login?.toLowerCase() === targetUsername &&
        c.html_url?.includes('/pull/')
    );
    
    for (const c of userIssueComments) {
        const prNumber = c.html_url.match(/\/pull\/(\d+)/)?.[1];
        allComments.push({
            type: 'issue_comment',
            prNumber: prNumber ? parseInt(prNumber) : null,
            url: c.html_url,
            createdAt: c.created_at,
            body: c.body?.substring(0, 100) + (c.body?.length > 100 ? '...' : '')
        });
    }
    console.log(`  Found ${userIssueComments.length} issue comments`);

    // 2. Fetch review comments (inline code comments)
    console.log('Fetching review comments (inline code comments)...');
    const reviewComments = await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls/comments`);
    
    const userReviewComments = reviewComments.filter(c => 
        c.user?.login?.toLowerCase() === targetUsername
    );
    
    for (const c of userReviewComments) {
        const prNumber = c.pull_request_url?.match(/\/pulls\/(\d+)/)?.[1];
        allComments.push({
            type: 'review_comment',
            prNumber: prNumber ? parseInt(prNumber) : null,
            url: c.html_url,
            createdAt: c.created_at,
            body: c.body?.substring(0, 100) + (c.body?.length > 100 ? '...' : '')
        });
    }
    console.log(`  Found ${userReviewComments.length} review comments`);

    // Sort all comments by date
    allComments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Output results
    console.log('\n================================================');
    console.log(`SUMMARY for ${targetUsername}`);
    console.log('================================================\n');
    console.log(`Total PR comments: ${allComments.length}`);
    
    if (allComments.length > 0) {
        console.log(`First comment: ${allComments[0].createdAt}`);
        console.log(`Last comment: ${allComments[allComments.length - 1].createdAt}`);
        
        console.log('\n--- All Comments (chronological) ---\n');
        for (const c of allComments) {
            console.log(`[${c.createdAt}] PR #${c.prNumber} (${c.type})`);
            console.log(`  URL: ${c.url}`);
            console.log(`  Preview: ${c.body}`);
            console.log('');
        }
    } else {
        console.log('No PR comments found for this user.');
    }

    // Save to file
    const output = {
        username: targetUsername,
        fetchedAt: new Date().toISOString(),
        totalComments: allComments.length,
        firstComment: allComments[0]?.createdAt || null,
        lastComment: allComments[allComments.length - 1]?.createdAt || null,
        comments: allComments
    };
    
    const outputFile = path.join(__dirname, `../contributor-${targetUsername}-comments.json`);
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2) + '\n');
    console.log(`\nSaved to: ${outputFile}`);
}

main().catch(console.error);
