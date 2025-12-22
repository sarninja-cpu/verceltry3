export function onRequest() {
  // Detect the branch: main or preview/dev
  const branch = process.env.CF_PAGES_BRANCH || 'dev';
  const isMain = branch === 'main';

  // Build the robots.txt content
  const body = isMain
    ? `User-agent: *
Allow: /`
    : `User-agent: *
Disallow: /`;

  // Return the response with correct content type
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}