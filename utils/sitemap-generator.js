/*
  Purpose
  - Generates a sitemap.xml for the Security Frameworks site at build time.
  - Only the main branch (.org) gets a full sitemap; dev branch (.dev) gets an empty one
    since .dev pages dont have to be indexed.
  - Only runs on Cloudflare Pages (Vercel is used for previews only).

  What it does
  - Parses the sidebar configuration from vocs.config.ts to collect all page URLs.
  - Respects branch-based filtering: on main branch, excludes pages marked with dev: true.
  - Extracts lastmod dates from the Vocs JS bundle (parses lastUpdatedAt from virtual routes).
  - Finds and overwrites the placeholder sitemap.xml copied from public/.

  High-level flow
  1) Only run on Cloudflare Pages (skip Vercel preview deployments).
  2) Find the sitemap.xml placeholder in the build output.
  3) Check branch via CF_PAGES_BRANCH (main vs develop/other).
  4) For dev branch: write an empty sitemap.
  5) For main branch: generate full sitemap with lastmod dates from JS bundle.

  Note: Requires GIT_CLONE_DEPTH=0 on CF Pages for Vocs to extract git timestamps.
*/

const fs = require('fs');
const path = require('path');

const workspaceRoot = process.cwd();
const vocsConfigPath = path.join(workspaceRoot, 'vocs.config.ts');

// Candidate output directories - ordered by priority
const candidateDirs = [
  path.join(workspaceRoot, 'docs', 'dist'),
  path.join(workspaceRoot, 'dist'),
  path.join(workspaceRoot, '.vercel', 'output', 'static'),
  '/vercel/path0/docs/dist',
];

const MAIN_SITE_URL = 'https://frameworks.securityalliance.org';

/**
 * Escape special XML characters in URLs
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Find sitemap.xml in candidate directories.
 * Returns { distDir, writeLocations } where distDir is the build output directory.
 */
function findSitemapLocations() {
  const writeLocations = [];
  let distDir = null;

  for (const dir of candidateDirs) {
    const sitemapPath = path.join(dir, 'sitemap.xml');
    console.log(`Checking: ${sitemapPath}`);

    if (fs.existsSync(sitemapPath)) {
      console.log(`  Found sitemap.xml at: ${sitemapPath}`);
      writeLocations.push(sitemapPath);
      if (!distDir) {
        distDir = dir;
        console.log(`  Using as build output directory: ${distDir}`);
      }
    } else if (fs.existsSync(dir)) {
      console.log(`  Directory exists, can write to: ${sitemapPath}`);
      writeLocations.push(sitemapPath);
    } else {
      console.log(`  Directory not found: ${dir}`);
    }
  }

  return { distDir, writeLocations };
}

/**
 * Parse the Vocs JS bundle to extract lastUpdatedAt timestamps for all routes.
 * Vocs embeds route data: path:"/route",type:"mdx",...,lastUpdatedAt:1234567890
 * Returns a Map of path -> date string (YYYY-MM-DD)
 */
function parseTimestampsFromBundle(distDir) {
  const assetsDir = path.join(distDir, 'assets');
  const timestampMap = new Map();

  if (!fs.existsSync(assetsDir)) {
    console.log('  Assets directory not found, cannot parse JS bundle');
    return timestampMap;
  }

  const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));

  for (const jsFile of jsFiles) {
    const jsPath = path.join(assetsDir, jsFile);
    const content = fs.readFileSync(jsPath, 'utf8');

    if (!content.includes('lastUpdatedAt')) continue;

    console.log(`  Parsing routes from: ${jsFile}`);

    // Match: path:"/route",...,lastUpdatedAt:1234567890 (may use scientific notation e3)
    const routePattern = /path:"([^"]+)"[^}]*?lastUpdatedAt:(\d+(?:e\d+)?)/g;
    let match;

    while ((match = routePattern.exec(content)) !== null) {
      const routePath = match[1];
      const rawTimestamp = parseFloat(match[2]);

      // Skip .html duplicates (Vocs generates both /path and /path.html)
      if (routePath.endsWith('.html')) continue;

      // Convert to milliseconds if needed
      const timestampMs = rawTimestamp < 1e10 ? rawTimestamp * 1000 : rawTimestamp;
      const date = new Date(timestampMs);
      const dateStr = date.toISOString().split('T')[0];

      if (rawTimestamp > 0 && !isNaN(date.getTime())) {
        timestampMap.set(routePath, dateStr);
      }
    }
  }

  return timestampMap;
}

/**
 * Get lastmod date for a link from the timestamp map.
 * Falls back to today's date if not found.
 */
function getLastModFromBundle(timestampMap, link) {
  const fallbackDate = new Date().toISOString().split('T')[0];

  if (timestampMap.has(link)) {
    return { date: timestampMap.get(link), found: true };
  }

  return { date: fallbackDate, found: false, reason: 'not_in_bundle' };
}

/**
 * Parse vocs.config.ts and extract all sidebar links.
 * On main branch, excludes items with dev: true.
 */
function extractSidebarLinks(isMainBranch) {
  if (!fs.existsSync(vocsConfigPath)) {
    console.error('vocs.config.ts not found');
    return [];
  }

  const cfg = fs.readFileSync(vocsConfigPath, 'utf8');
  const lines = cfg.split('\n');
  const links = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const linkMatch = line.match(/link:\s*(['"])(.*?)\1/);

    if (linkMatch) {
      const link = linkMatch[2];

      // Skip external URLs (social links, etc.)
      if (link.startsWith('http://') || link.startsWith('https://')) {
        continue;
      }

      // Check for dev: true on the same line
      const hasDevOnLine = line.includes('dev:') && line.includes('true');

      // Check parent context for dev: true
      let hasDevInParent = false;
      let braceDepth = 0;
      for (let j = i; j >= Math.max(0, i - 10); j--) {
        const checkLine = lines[j];
        braceDepth += (checkLine.match(/\}/g) || []).length;
        braceDepth -= (checkLine.match(/\{/g) || []).length;

        if (braceDepth > 0) break;

        if (j !== i && checkLine.includes('dev:') && checkLine.includes('true')) {
          hasDevInParent = true;
          break;
        }
      }

      if (isMainBranch && (hasDevOnLine || hasDevInParent)) {
        console.log(`  Skipping dev page: ${link}`);
        continue;
      }

      links.push(link);
    }
  }

  return links;
}

/**
 * Generate XML sitemap content
 */
function generateSitemapXml(urls, writtenFrom) {
  const urlEntries = urls
    .map(
      ({ loc, lastmod }) => `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated from: ${writtenFrom} -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

/**
 * Generate empty sitemap for dev branch
 */
function generateEmptySitemap(writtenFrom) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated from: ${writtenFrom} -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;
}

async function main() {
  if (!process.env.CF_PAGES) {
    console.log('Skipping sitemap generation: not running on Cloudflare Pages');
    return;
  }

  console.log(`Working directory: ${workspaceRoot}`);

  const isMainBranch = process.env.CF_PAGES_BRANCH === 'main';
  console.log(`Branch: ${isMainBranch ? 'main (.org)' : 'develop (.dev)'}`);

  const { distDir, writeLocations } = findSitemapLocations();

  if (writeLocations.length === 0) {
    console.error('No output directories found for sitemap.xml');
    process.exit(1);
  }

  if (!distDir) {
    console.error('No sitemap.xml placeholder found in any candidate directory');
    process.exit(1);
  }

  let urls = [];
  if (!isMainBranch) {
    console.log('Generating empty sitemap for dev branch');
  } else {
    console.log('Generating sitemap for main branch...');

    console.log('Parsing lastUpdatedAt timestamps from JS bundle...');
    const timestampMap = parseTimestampsFromBundle(distDir);
    console.log(`  Found ${timestampMap.size} timestamps in bundle`);

    const links = extractSidebarLinks(true);
    console.log(`Found ${links.length} pages in sidebar`);

    let datesFound = 0;
    let datesFallback = 0;
    const fallbackReasons = {};

    for (const link of links) {
      const { date, found, reason } = getLastModFromBundle(timestampMap, link);

      if (found) {
        datesFound++;
      } else {
        datesFallback++;
        fallbackReasons[reason] = (fallbackReasons[reason] || 0) + 1;
      }

      urls.push({
        loc: `${MAIN_SITE_URL}${link}`,
        lastmod: date,
      });
    }

    console.log(`Generated sitemap with ${urls.length} URLs`);
    console.log(`  Dates from JS bundle: ${datesFound}, Fallback to today: ${datesFallback}`);
    if (datesFallback > 0) {
      console.log(`  Fallback reasons: ${JSON.stringify(fallbackReasons)}`);
    }
  }

  for (const sitemapPath of writeLocations) {
    try {
      const sitemapContent = isMainBranch
        ? generateSitemapXml(urls, sitemapPath)
        : generateEmptySitemap(sitemapPath);

      fs.writeFileSync(sitemapPath, sitemapContent);
      console.log(`Sitemap written to: ${sitemapPath}`);
    } catch (err) {
      console.log(`Failed to write to ${sitemapPath}: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
