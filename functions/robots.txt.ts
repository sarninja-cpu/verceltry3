export async function onRequest() {
  const isMain = process.env.CF_PAGES_BRANCH === 'main';

  const body = isMain
    ? `User-agent: *
Allow: /
`
    : `User-agent: *
Disallow: /`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
