/*
  Purpose
  - Generates a sitemap.xml for the Security Frameworks site at build time.
  - Only the main branch (.org) gets a full sitemap; dev branch (.dev) gets an empty one
    since .dev pages dont have to be indexed.
  - Only runs on Cloudflare Pages (Vercel is used for previews only).

  What it does
  - Parses the sidebar configuration from vocs.config.ts to collect all page URLs.
  - Respects branch-based filtering: on main branch, excludes pages marked with dev: true.
  - Reads file modification times from the source MDX files for the lastmod tag.
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
const pagesDir = path.join(workspaceRoot, 'docs', 'pages');
const vocsConfigPath = path.join(workspaceRoot, 'vocs.config.ts');

// Candidate output directories (same as searchbar-indexing.js)
const candidateDirs = [
  path.join(workspaceRoot, 'dist'),
  path.join(workspaceRoot, '.vercel', 'output', 'static'),
  '/vercel/path0/docs/dist',
  path.join(workspaceRoot, 'docs', 'dist'),
];

const MAIN_SITE_URL = 'https://frameworks.securityalliance.org';

/**
 * Find sitemap.xml in candidate directories
 */
function findSitemapLocations() {
  const locations = [];

  for (const dir of candidateDirs) {
    const sitemapPath = path.join(dir, 'sitemap.xml');
    console.log(`Checking: ${sitemapPath}`);

    if (fs.existsSync(sitemapPath)) {
      console.log(`  Found sitemap.xml at: ${sitemapPath}`);
      locations.push(sitemapPath);
    } else if (fs.existsSync(dir)) {
      // Directory exists but no sitemap - we can create one here
      console.log(`  Directory exists, can write to: ${sitemapPath}`);
      locations.push(sitemapPath);
    } else {
      console.log(`  Directory not found: ${dir}`);
    }
  }

  return locations;
}

/**
 * Convert a sidebar link (e.g., '/intro/introduction') to its MDX file path
 */
function linkToMdxPath(link) {
  const relativePath = link.replace(/^\//, '');

  // Try direct .mdx file first
  const directPath = path.join(pagesDir, `${relativePath}.mdx`);
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  // Try index.mdx in directory
  const indexPath = path.join(pagesDir, relativePath, 'index.mdx');
  if (fs.existsSync(indexPath)) {
    return indexPath;
  }

  return null;
}

/**
 * Get file modification time as ISO date string (YYYY-MM-DD)
 */
function getLastMod(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.mtime.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
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
 */
function generateSitemapXml(urls) {
  const urlEntries = urls
    .map(({ loc, lastmod }) => {
      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

/**
 * Generate empty sitemap for dev branch
 */
function generateEmptySitemap() {
  return `<?xml version="1.0" encoding="UTF-8"?>
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
  const sitemapLocations = findSitemapLocations();

  if (sitemapLocations.length === 0) {
    console.error('No output directories found for sitemap.xml');
    process.exit(1);
  }

  let sitemapContent;

  if (!isMainBranch) {
    console.log('Generating empty sitemap for dev branch');
    sitemapContent = generateEmptySitemap();
  } else {
    console.log('Generating sitemap for main branch...');

    const links = extractSidebarLinks(true);
    console.log(`Found ${links.length} pages in sidebar`);

    const urls = [];
    for (const link of links) {
      const mdxPath = linkToMdxPath(link);
      const lastmod = mdxPath ? getLastMod(mdxPath) : new Date().toISOString().split('T')[0];

      urls.push({
        loc: `${MAIN_SITE_URL}${link}`,
        lastmod,
      });
    }

    sitemapContent = generateSitemapXml(urls);
    console.log(`Generated sitemap with ${urls.length} URLs`);
  }

  // Write to all found locations
  for (const sitemapPath of sitemapLocations) {
    try {
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
