# ADR 0006: Renderer in M1: static export and theme tokens

Status: accepted, 2026-11-26. Milestone: M1. Revised the same day to apply the security design
review (`docs/reviews/2026-11-26-security-design-review.md`, H1, M5, M6, L9, L10). The re-review
(`docs/reviews/2026-11-26-security-design-re-review.md`) passed it subject to required fixes:
rulings 9 and 10 and the encoder rule. They are applied in this text.
Revised 2026-11-27 for the user's decision that a portal may hold several APIs and versions:
"Units" is added.
Revised again that day to close gaps a readiness audit found. Scope follows m1.md, which the
product manager owns: dark mode (M3) and search (M5) are removed from M1's interactivity, and
the rules for the export's layout, fragments and page weight are added. `Manifest` and
`PageData` are defined in ADR 0003, "The portal bundle".

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
a second `ContentSource` keyed by tenant in front of the same components. `Manifest`, `PageData`
and the page paths are the engine's (ADR 0003, "The portal bundle"); `page(path)` takes a page
path from the manifest.

**Units.** A portal bundle is one unit: one version of one API (ADR 0002, ADR 0003). A
`ContentSource` therefore serves one unit, and from M4 a portal has one per (project, API,
version). Two prefixes stand in front of a bundle path, and they are different things: the
**base path**, where the portal is mounted (`/docs`), which also carries the app's own build
assets and the theme; and the **unit prefix**, where one API version sits below it. In M1 the
unit prefix is empty. M1 still builds every URL of a page, a twin and `llms.txt`
through one function that takes both, and no component joins a bundle path to the base path
itself or assumes that a bundle path starts at the portal root. `theme()` is on `ContentSource`
for M1 only; a theme belongs to the portal, not to a unit, and M4 moves it.

Rules that keep pages exportable:

1. No core page uses request-time APIs (`cookies`, `headers`, `searchParams` on the server), route
   handlers, server actions or middleware.
2. Interactivity is client-side only, and in M1 it is this list: language choice, variant
   switchers, schema expanders and copy buttons. M1 has no light/dark switch and no search,
   filter or search index in the export: m1.md puts dark mode in M3 and search of any kind in
   M5. All languages are in the HTML. The choice is kept in `localStorage` under one key of
   ours, `ezdp.sampleLanguage`, read only as one of the manifest's languages, so it holds across
   pages, reloads and tabs with no server state. With JavaScript off, every page shows the
   manifest's first language, every variant and every schema section (criterion 16).
3. Everything under the bundle's `static/` is copied into the export as files: the Markdown
   twins, `llms.txt` and `doctor-report.json`. `manifest.json`, `model.json` and the page files
   are build inputs and are not exported.
4. All links and the URLs of the app's own build assets go through the configured base path, so
   the same build works at `/` and under `/docs`. Tenant-supplied files are the exception: see
   "Tenant assets" below.
5. CI runs a full static export over the fixture corpus. If it fails, the change is rejected. This
   is the test of the standing constraint.
6. Layout, so the export works from a plain file server (criterion 21). The export uses
   `trailingSlash: true`: the page with path `P` is the file `P/index.html` and is linked as
   `P/`; the home page, path `index`, is the unit's base itself. Its twin is the file `P.md`
   beside that directory, which is what criterion 17 means by the page URL plus `.md`.
   `llms.txt`, `doctor-report.json` and `spec/` sit at the unit's base. The first path segments
   the engine uses are a closed list: `operations`, `schemas`, `tags`, `doctor` and `spec`. The
   prefix reserved for guides in M5 (contract 3) must not be one of them.
7. The HTML of a page is linear in its page file. A reference to a named schema is rendered as
   a link or an expander that points at that schema's one section on the page
   (`#schema-<slug>`) or at its own page; the renderer never renders a referenced schema inside
   the schema that refers to it. This is what keeps a recursive schema finite (criterion 2) and
   stops the expansion of ADR 0003, "Budgets".
8. Fragments are the ones ADR 0003 lists, and no other `id` is promised. An element that
   carries one is in the HTML as exported and is not inside content that starts collapsed, so
   the URL loads directly to it with JavaScript off (criterion 11).

"Try it" in M2 is a client component that calls the proxy, a separate service. Pages stay static.

**Tenant text.** Descriptions in the model are untrusted Markdown. The renderer parses them with
`mdast-util-from-markdown` into a syntax tree and maps a fixed set of node types to React elements
with our own code. The GFM extensions are loaded individually, four of them: tables, task lists,
strikethrough and footnotes. `mdast-util-gfm` is not used, because it also turns on autolink
literals, which the guides contract forbids (4.1) and which would make links out of the bare URLs
in spec descriptions.

- HTML nodes are rendered as text. `dangerouslySetInnerHTML` is banned in the app by lint.
- Link targets are limited to `https:`, `mailto:` and in-page anchors. An `https:` target must
  match the regex in contract 4.5 and have no `\`. The renderer also parses it with the WHATWG
  parser and rejects it if the parsed host differs from the host in the text. A target that fails
  any of these is rendered as its text. External links are rendered with
  `rel="noopener noreferrer nofollow ugc"`. This is the rule in contract 4.5, and one function
  serves both spec descriptions and guides.
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
and the renderer then puts a placeholder element at each variable's recorded offset. In M1
nothing fills them: there is no credential entry (M2), and a copy button copies the display
text. From M2, client code fills only those elements, with a value passed through the variable's encoders. An unknown encoder
id means the placeholder is not filled. A typed scalar is written by JSON serialization. Nothing
in the app searches text or code for `{{`.

**Tenant assets.** M1 has none. From M5, guide assets are served as contract section 2 says:

- svg, pdf, json and zip always use the asset origin, a dedicated per-tenant origin that is never
  the portal's or the customer's. Their URLs are absolute and do not go through the base path.
- png, jpg, webp and gif use the asset origin too, with one narrower option: an image of these
  types that has been re-encoded by the portal may be served on the page origin with
  `X-Content-Type-Options: nosniff`, and then its URL goes through the base path like the app's
  own files. Re-encoding is done by the publish pipeline, not by the renderer and not by the
  engine. The bundle's own bytes are never served on the page origin.
- Every asset-origin response has the headers in contract section 2, which include
  `Cross-Origin-Resource-Policy: cross-origin` and, for svg,
  `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`.
- The design is sound as far as is known and is not verified. A browser test in Chrome, Firefox
  and Safari is an M5 acceptance test: each image type shows through an image element on a portal
  page, including an svg sent with `Content-Disposition: attachment` and the sandbox policy, and
  no asset type runs anything when opened directly.

Two decisions in the product brief are affected, and neither changes:

- *Subpath hosting.* Pages under `host.com/docs` stay same-origin with the customer's site, so the
  customer's fonts still load. Re-encoded png, jpg, webp and gif may come through the customer's
  reverse proxy on the page origin. svg, pdf, json and zip load cross-origin from an origin we
  host and never pass through the customer's reverse proxy. A customer whose site sends a
  `Content-Security-Policy` must allow the asset origin in `img-src` only where guides show svg
  images or the portal keeps other images on the asset origin.
- *Static export.* Core pages still export with no per-request server logic. An export whose
  guide assets are all png, jpg, webp or gif is self-contained: the re-encoded images are exported
  beside the pages, and the host must send `nosniff` with them. Where guides have svg, pdf, json
  or zip assets, the pages point at the asset origin for those files, and whoever hosts the export
  keeps using ours or runs a second origin that sends the same headers. Copying those four types,
  or any image as it came in the bundle, into the export beside the pages does not conform.

**Theme.** `@ezdp/theme` exports the `ThemeTokens` type (JSON, `tokensVersion: 1`), a validator,
`defaultTheme`, and `tokensToCss(tokens): string`. Token groups: color (background, surface, text,
muted, border, accent, accent contrast, code background, syntax, HTTP method colors), keyed by
mode; font families and sizes; radius; spacing; shadow. M1 ships light only (m1.md): the color
group's `light` is required and `dark` is optional, `defaultTheme` has no `dark`, and
`tokensToCss` writes the light values and no `prefers-color-scheme` rule. Keeping the mode key
in the type is all M1 does for dark mode, so that M3 adds values and not a new token format.
A shadow is structured, never a string:
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

**Page weight.** Criterion 24's threshold is confirmed: no operation page of the GitHub fixture
transfers more than 500 KB compressed, fonts excluded. It is measured as the sum, over the
page's HTML file and every script and stylesheet that file loads, of each file's size under
gzip at level 6, from the export directory with nothing cached. The largest GitHub operation,
`GET /emojis`, is 166 KB of schema as written and 17 KB under gzip, so the budget is spent on
the app's own scripts, not on content. "No page embeds the whole spec" is met by construction:
a page is built from its page file, and `model.json` is not exported (rule 3). The navigation
is the one part that grows with the spec; how it is delivered is the renderer developer's
choice within this threshold. Criterion 23 is in ADR 0003, "Performance".

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
