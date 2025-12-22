export function onRequest() {
  // Fallback if env var is undefined
  const branch = process.env.CF_PAGES_BRANCH || 'dev';

  const isMain = branch === 'main';

  const body = isMain
    ? `User-agent: *
Allow: /
Sitemap: https://verceltry.pages.dev/sitemap.xml`
    : `User-agent: *
Disallow: /`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
