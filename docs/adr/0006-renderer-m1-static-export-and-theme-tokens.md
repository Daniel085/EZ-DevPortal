# ADR 0006: Renderer in M1: static export and theme tokens

Status: proposed, 2026-11-26. Milestone: M1. Revised the same day to apply the security design
review (`docs/reviews/2026-11-26-security-design-review.md`, H1, M5, M6, L9, L10).

## Context

M1 needs only enough renderer to see the engine's output with a default theme. The brief fixes a
Next.js app, requires core pages to stay statically exportable, and requires themes to be data.
M4 makes the same app multi-tenant; M2 adds "Try it" to the same pages.

## Decision

**Consumption.** `apps/portal` is a Next.js App Router app built with `output: 'export'` in M1. It
reads a portal bundle (ADR 0003) through one interface:

```ts
interface ContentSource {
  manifest(): Promise<Manifest>;
  page(path: string): Promise<PageData>;
  theme(): Promise<ThemeTokens>;
}
```

M1 has one implementation, which reads a bundle directory named by an environment variable at
build time. Routes come from `generateStaticParams` over the manifest. Page components are
presentational: they take `PageData` and nothing else, and do not know where it came from. M4 adds
a second `ContentSource` keyed by tenant in front of the same components.

Rules that keep pages exportable:

1. No core page uses request-time APIs (`cookies`, `headers`, `searchParams` on the server), route
   handlers, server actions or middleware.
2. Interactivity is client-side only: language choice (all languages are in the HTML; a stored
   preference selects one), light/dark mode, and a simple filter over `search.json`.
3. Markdown twins and `llms.txt` are copied from the bundle's `static/` into the export as files.
4. All links and the URLs of the app's own build assets go through the configured base path, so
   the same build works at `/` and under `/docs`. Tenant-supplied files are the exception: see
   "Tenant assets" below.
5. CI runs a full static export over the fixture corpus. If it fails, the change is rejected. This
   is the test of the standing constraint.

"Try it" in M2 is a client component that calls the proxy, a separate service. Pages stay static.

**Tenant text.** Descriptions in the model are untrusted Markdown. The renderer parses them with
`mdast-util-from-markdown` into a syntax tree and maps a fixed set of node types to React elements
with our own code. The GFM extensions are loaded individually, four of them: tables, task lists,
strikethrough and footnotes. `mdast-util-gfm` is not used, because it also turns on autolink
literals, which the guides contract forbids (4.1) and which would make links out of the bare URLs
in spec descriptions.

- HTML nodes are rendered as text. `dangerouslySetInnerHTML` is banned in the app by lint.
- Link targets are limited to `https:`, `mailto:` and in-page anchors. An `https:` target is parsed
  with the WHATWG URL parser and must have a host, no userinfo and no control characters;
  otherwise the link is rendered as its text. External links are rendered with
  `rel="noopener noreferrer nofollow ugc"`. This is the rule in contract 4.5.
- Images in spec descriptions are not loaded from remote hosts. An image is rendered as its alt
  text, and the page makes no request to the image's URL.
- Every `id` derived from tenant text, such as a heading anchor, gets a fixed prefix of ours, so it
  cannot shadow a DOM global. Client code does not use global named lookups (`window[name]`, a
  bare identifier that resolves to an element, `document.<name>`); lint enforces what it can.
- The same parser will serve guides in M5, with the contract's nesting cap of 32.

**Highlighting.** `shiki` (MIT), run at build time in server components, with its JavaScript regex
engine and only the grammars for our sample languages plus JSON. We take tokens and render
`<span>` elements; colors come from Shiki's CSS-variables theme, so syntax colors are theme tokens
and no highlighter code reaches the browser. The regex engine runs on tenant strings and has no
time bound of its own, so highlighting has an input cap and falls back to plain text. The cap is
on the size of a block and on the length of a line, 64 KB and 2,000 characters unless the security
reviewer sets others; past either, the block is rendered unhighlighted. The build runs inside the
publish worker and its time limit (ADR 0003).

**Variables in samples.** Sample code arrives as a list of segments, literal strings and variables
(ADR 0005). The highlighter is given the literal text with each variable's display text in place,
and the renderer then puts a placeholder element at each variable's recorded offset. Client code
fills only those elements, with a value passed through the variable's encoders. Nothing in the
app searches text or code for `{{`.

**Tenant assets.** M1 has none. From M5, guide assets are served from a dedicated per-tenant asset
origin, never the portal's or the customer's origin, with the response headers in contract
section 2. Their URLs are absolute and do not go through the base path. Two decisions in the
product brief are affected, and neither changes:

- *Subpath hosting.* Pages under `host.com/docs` stay same-origin with the customer's site, so the
  customer's fonts still load. Guide assets load cross-origin from an origin we host and do not
  pass through the customer's reverse proxy. A customer whose site sends a
  `Content-Security-Policy` must allow the asset origin in `img-src`.
- *Static export.* Core pages still export with no per-request server logic. An export whose
  guides have assets is not self-contained: its pages point at the asset origin, and whoever hosts
  the export keeps using ours or runs a second origin that sends the same headers. Copying the
  assets into the export beside the pages does not conform.

**Theme.** `@ezdp/theme` exports the `ThemeTokens` type (JSON, `tokensVersion: 1`), a validator,
`defaultTheme`, and `tokensToCss(tokens): string`. Token groups: color (background, surface, text,
muted, border, accent, accent contrast, code background, syntax, HTTP method colors) for light and
dark; font families and sizes; radius; spacing; shadow. A shadow is structured, never a string:
a list of layers, each `{ x, y, blur, spread, color }`, with lengths and a color that go through
the length and color serializers. The designer owns the list and values.

- The root layout emits one `<style>` block of `--ez-*` custom properties from the token data.
- Components are styled with CSS Modules and refer only to `var(--ez-*)`. No literal colors, fonts
  or radii in component CSS (lint). No CSS framework.
- `tokensToCss` writes each value through a typed serializer (color, length, font-family list,
  number, shadow). Every token group has one; a group without a serializer is not emitted. It
  never copies a token string into CSS verbatim, so a token cannot inject CSS or a `url()`.
  Serializer output never contains `<`, `;`, `}`, `\` or `url(`. A value that could only be
  written with one of them is rejected by the validator, and the default is used. A test asserts
  this over hostile token values. In M3 the brand extractor produces the same JSON and nothing
  else.
- Fonts in M1 are system stacks. Font loading belongs with subpath hosting and M3.

## Consequences

- Changing a theme is changing a JSON document; no build of tenant-specific code or CSS files.
- The static-export CI job makes the constraint mechanical instead of a review judgement.
- New runtime dependencies in `apps/portal`: `next`, `react`, `react-dom`, `shiki`,
  `mdast-util-from-markdown`, and the `micromark-extension-gfm-*` and `mdast-util-gfm-*` packages
  for `table`, `task-list-item`, `strikethrough` and `footnote`. All MIT. That is eight small
  packages in place of two umbrella packages, which is the cost of leaving autolink literals out.

## Alternative rejected

Have the renderer import the engine and build pages from the raw spec at request or build time.
It removes the bundle format, but it couples page rendering to spec parsing, makes the M4 renderer
parse tenant specs in the serving path, and leaves the proxy and MCP without a published model to
read. Also rejected: Tailwind or a component library for styling. Both are dependencies where
CSS Modules and variables do, and both tempt per-tenant style output.
