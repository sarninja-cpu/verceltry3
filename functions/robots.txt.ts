export function onRequest(context: { env: { CF_PAGES_BRANCH?: string; }; }) {
  const branch = context.env.CF_PAGES_BRANCH;
  const isMain = branch === 'main';

  const header = `# As a condition of accessing this website, you agree to abide by the following
# content signals:
#
# (a) If a content-signal = yes, you may collect content for the corresponding use.
# (b) If a content-signal = no, you may not collect content for the corresponding use.
# (c) If a content signal is not present, no permission is granted or denied.
#
# The content signals and their meanings are:
#
# search:   building a search index and providing search results
# ai-input: inputting content into AI systems for real-time generation
# ai-train: training or fine-tuning AI models
#
# ANY RESTRICTIONS EXPRESSED VIA CONTENT SIGNALS ARE EXPRESS RESERVATIONS OF
# RIGHTS UNDER ARTICLE 4 OF THE EU DIRECTIVE 2019/790.
`;

const rules = isMain
? `User-agent: *
Allow: /
`
: `User-agent: *
Disallow: /
`;

  // Build the robots.txt content
  const body = `${header}
${rules}`.trim();

  return new Response(body + '\n', {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
