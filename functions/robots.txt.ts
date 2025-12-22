// functions/robots_txt.ts
export function onRequest() {
  return new Response("User-agent: *\nDisallow: /", {
    headers: { "Content-Type": "text/plain" },
  });
}