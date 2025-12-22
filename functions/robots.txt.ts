export function onRequest(context: { env: { CF_PAGES_BRANCH?: string; }; }) {
  // Access environment through the context parameter
  const branch = context.env.CF_PAGES_BRANCH || 'dev';
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