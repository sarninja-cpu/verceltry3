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
  - Writes sitemap.xml to dist/ for Cloudflare Pages deployment.

  High-level flow
  1) Only run on Cloudflare Pages (skip Vercel preview deployments).
  2) Check branch via CF_PAGES_BRANCH (main vs develop/other).
  3) For dev branch: write an empty sitemap (consistent with robots.txt noindex).
  4) For main branch:
     a) Parse vocs.config.ts to extract sidebar links (excluding dev: true items).
     b) For each link, find the corresponding MDX file and get its mtime.
     c) Generate sitemap.xml with loc, lastmod, and changefreq.
  5) Write to dist/.
*/

const fs = require('fs');
const path = require('path');

const workspaceRoot = process.cwd();
const pagesDir = path.join(workspaceRoot, 'docs', 'pages');
const vocsConfigPath = path.join(workspaceRoot, 'vocs.config.ts');
const outputDir = path.join(workspaceRoot, 'dist');

const MAIN_SITE_URL = 'https://frameworks.securityalliance.org';

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
      // This handles cases like { text: 'Foo', collapsed: false, dev: true, items: [...] }
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

  const isMainBranch = process.env.CF_PAGES_BRANCH === 'main';
  console.log(`Branch: ${isMainBranch ? 'main (.org)' : 'develop (.dev)'}`);

  if (!fs.existsSync(outputDir)) {
    console.error('Output directory not found: dist/');
    process.exit(1);
  }

  let sitemapContent;

  if (!isMainBranch) {
    console.log('Generating empty sitemap for dev branch (pages canonicalize to .org)');
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

  const sitemapPath = path.join(outputDir, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemapContent);
  console.log(`Sitemap written to: ${sitemapPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
