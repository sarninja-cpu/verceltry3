/*
  Purpose
  - Generates a sitemap.xml for the Security Frameworks site at build time.
  - Only the main branch (.org) gets a full sitemap; dev branch (.dev) gets an empty one
    since .dev pages dont have to be indexed.
  - Only runs on Cloudflare Pages (Vercel is used for previews only).

  What it does
  - Parses the sidebar configuration from vocs.config.ts to collect all page URLs.
  - Respects branch-based filtering: on main branch, excludes pages marked with dev: true.
  - Extracts lastmod dates from the Vocs-generated HTML files (parses the <time> element in the footer).
  - Finds and overwrites the placeholder sitemap.xml copied from public/.

  High-level flow
  1) Only run on Cloudflare Pages (skip Vercel preview deployments).
  2) Find the sitemap.xml placeholder in the build output.
  3) Check branch via CF_PAGES_BRANCH (main vs develop/other).
  4) For dev branch: write an empty sitemap.
  5) For main branch: generate full sitemap with lastmod dates.
*/

const fs = require('fs');
const path = require('path');

const workspaceRoot = process.cwd();
const vocsConfigPath = path.join(workspaceRoot, 'vocs.config.ts');

// Candidate output directories - ordered by priority (docs/dist is the actual Vocs output on CF Pages)
const candidateDirs = [
  path.join(workspaceRoot, 'docs', 'dist'), // Primary: Vocs build output
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
 * Find sitemap.xml in candidate directories
 * Returns { distDir, writeLocations } where distDir is the actual build output directory
 */
function findSitemapLocations() {
  const writeLocations = [];
  let distDir = null;

  for (const dir of candidateDirs) {
    const sitemapPath = path.join(dir, 'sitemap.xml');
    console.log(`Checking: ${sitemapPath}`);

    if (fs.existsSync(sitemapPath)) {
      // Found actual sitemap.xml - this is the real build output directory
      console.log(`  Found sitemap.xml at: ${sitemapPath}`);
      writeLocations.push(sitemapPath);
      if (!distDir) {
        distDir = dir;
        console.log(`  Using as HTML source directory: ${distDir}`);
      }
    } else if (fs.existsSync(dir)) {
      // Directory exists but no sitemap - we can still write here
      console.log(`  Directory exists, can write to: ${sitemapPath}`);
      writeLocations.push(sitemapPath);
    } else {
      console.log(`  Directory not found: ${dir}`);
    }
  }

  return { distDir, writeLocations };
}

/**
 * Get lastmod date by parsing the Vocs-generated HTML file.
 * Vocs embeds a <time datetime="..."> in the footer with the git commit timestamp.
 * This ensures the sitemap date matches what users see on the page.
 * Returns { date, found } where found indicates if date was extracted from HTML.
 */
function getLastModFromHtml(distDir, link) {
  const htmlPath = path.join(distDir, link, 'index.html');
  const fallbackDate = new Date().toISOString().split('T')[0];

  if (!fs.existsSync(htmlPath)) {
    return { date: fallbackDate, found: false, reason: 'file_not_found' };
  }

  try {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const match = html.match(/<time datetime="([^"]+)"/);

    if (match) {
      return { date: match[1].split('T')[0], found: true };
    }
    return { date: fallbackDate, found: false, reason: 'no_time_element' };
  } catch (err) {
    return { date: fallbackDate, found: false, reason: `error: ${err.message}` };
  }
}

/**
 * Parse vocs.config.ts and extract all sidebar links
 * On main branch, excludes items with dev: true
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

      // Check for dev: true on the same line
      const hasDevOnLine = line.includes('dev:') && line.includes('true');

      // Also check parent context (look back for dev: true in containing object)
      let hasDevInParent = false;

      // Look back up to 10 lines for an opening brace that might have dev: true
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

      const hasDev = hasDevOnLine || hasDevInParent;

      if (isMainBranch && hasDev) {
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
 * @param {Array} urls - Array of {loc, lastmod} objects
 * @param {string} writtenFrom - Path where this sitemap was written (for debugging)
 */
function generateSitemapXml(urls, writtenFrom) {
  const urlEntries = urls
    .map(({ loc, lastmod }) => {
      return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated from: ${writtenFrom} -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

/**
 * Generate empty sitemap for dev branch
 * @param {string} writtenFrom - Path where this sitemap was written (for debugging)
 */
function generateEmptySitemap(writtenFrom) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated from: ${writtenFrom} -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;
}

async function main() {
  // Only run on Cloudflare Pages deployments (skip local builds and Vercel PR previews)
  if (!process.env.CF_PAGES) {
    console.log('Skipping sitemap generation: not running on Cloudflare Pages (local build or Vercel preview)');
    return;
  }

  console.log(`Working directory: ${workspaceRoot}`);

  const isMainBranch = process.env.CF_PAGES_BRANCH === 'main';
  console.log(`Branch: ${isMainBranch ? 'main (.org)' : 'develop (.dev)'}`);

  // Find all locations where sitemap.xml should be written
  const { distDir, writeLocations } = findSitemapLocations();

  if (writeLocations.length === 0) {
    console.error('No output directories found for sitemap.xml');
    process.exit(1);
  }

  if (!distDir) {
    console.error('No sitemap.xml placeholder found in any candidate directory');
    process.exit(1);
  }

  // Prepare URLs once (only for main branch)
  let urls = [];
  if (!isMainBranch) {
    console.log('Generating empty sitemap for dev branch');
  } else {
    console.log('Generating sitemap for main branch...');

    const links = extractSidebarLinks(true);
    console.log(`Found ${links.length} pages in sidebar`);

    let datesFound = 0;
    let datesFallback = 0;
    const fallbackReasons = {};

    for (const link of links) {
      const { date, found, reason } = getLastModFromHtml(distDir, link);

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
    console.log(`  Dates from HTML: ${datesFound}, Fallback to today: ${datesFallback}`);
    if (datesFallback > 0) {
      console.log(`  Fallback reasons: ${JSON.stringify(fallbackReasons)}`);
    }
  }

  // Write to all found locations (each with its own path in the XML comment)
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
