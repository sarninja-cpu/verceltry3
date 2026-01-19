# Search Index Workaround

This document explains why `searchbar-indexing.js` exists and why it's more reliable than Vocs' built-in search indexer.

## Background

Vocs (v1.2.1) has a known issue where its search indexer fails to properly index MDX files containing ESM imports or React components. This results in pages being missing from search results.

## How Vocs' Built-in Indexer Works

Located in `node_modules/vocs/_lib/vite/utils/search.js`, Vocs' indexer:

1. Reads each MDX file
2. Strips import/export statements with regex: `mdx.replace(/^(import|export).*/gm, '')`
3. Strips React components with regex: `/<\/?\s*[A-Z][^>]*>/g`
4. Compiles the MDX using `@mdx-js/mdx`
5. Renders to static HTML using `react-dom/server`
6. Extracts sections from the HTML

### Limitations of Vocs' Approach

1. **Silent failures**: If MDX compilation fails for any reason, the catch block returns empty content with no warning:
   ```javascript
   catch (_error) {
       // TODO: Resolve imports (e.g. virtual modules)
       return { html: '', frontmatter: {} };
   }
   ```

2. **Basic component stripping**: The regex `/<\/?\s*[A-Z][^>]*>/g` only handles simple cases. It fails on:
   - Nested components: `<TagProvider><TagList /></TagProvider>`
   - Multi-line component props
   - Components with complex children
   - Self-closing components with spread props

3. **Virtual module errors**: Components using vanilla-extract or virtual modules cause compilation to fail (noted in their TODO comments)

4. **No sidebar awareness**: Indexes all files regardless of whether they appear in the sidebar

## How Our Workaround Works

Our `searchbar-indexing.js` takes a fundamentally different approach:

1. Reads each MDX file as **plain text** (no compilation)
2. Parses frontmatter using `gray-matter`
3. Splits content by markdown headings (`#`, `##`, etc.)
4. Builds a MiniSearch index directly from the text
5. Respects sidebar configuration to filter indexed pages
6. Respects `dev: true` flags for branch-based filtering

### Advantages

| Feature | Vocs Built-in | Our Workaround |
|---------|---------------|----------------|
| Handles imports/exports | Partial (regex strip) | Full (ignored as text) |
| Handles React components | Partial (simple regex) | Full (ignored as text) |
| Handles virtual modules | No (causes failure) | Yes (not compiled) |
| Silent failures | Yes | No |
| Sidebar-aware filtering | No | Yes |
| Branch-based filtering | No | Yes (dev pages on main) |
| Compilation required | Yes | No |
| Error-prone | Yes | No |

### Why Plain Text Parsing Works Better

For search indexing, we don't need rendered HTML—we need searchable text. By treating MDX as plain text:

- Import statements are just lines of text (easily ignored)
- React components are just angle-bracket syntax (stripped with the content, not the structure)
- No compilation means no compilation errors
- Frontmatter is reliably parsed by `gray-matter`
- Heading-based sectioning works on the raw markdown

## When This Workaround Can Be Removed

Monitor Vocs releases for resolution of these issues:

1. The TODO at line 92-93: `// TODO: Pass components - vanilla extract and virtual module errors`
2. The TODO at line 98: `// TODO: Resolve imports (e.g. virtual modules)`

Once Vocs properly handles all MDX files without silent failures, this workaround can be deprecated.

## Script Behavior

- **Only runs in CI**: Checks for `VERCEL` or `CF_PAGES` environment variables
- **Skips local builds**: Prints a message and exits cleanly
- **Post-build hook**: Runs via `postdocs:build` in package.json
- **Overwrites Vocs index**: Replaces the generated `search-index-*.json` with our version
