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
Revised again that day to close gaps a second audit found: the base path and the unit prefix
are settings of the M1 build ("Units"); "The export command" says how the export is produced
and who puts each file in it; and tenant text is rendered from the engine's safe form with the
engine's parser ("Tenant text"). The last goes to the security reviewer.
Revised 2026-11-28 for the user's decision that the doctor report is private by default (ADR
0003, "The doctor report is private"): the export command writes the doctor page and
`doctor-report.json` to a report directory and never to the export; `ContentSource` gains
`doctor()`. This goes to the security reviewer.
Revised again that day for guides contract 0.3 and its security review
(`docs/reviews/2026-11-28-security-review-contract-0.3.md`, rulings 1 and 2): "Guide pages and
generated values" is added. It is M5 work. Nothing in it changes the M1 renderer. The review
did not read this ADR.
Revised again that day for criterion 33 (text in any script): "Direction of tenant text" fixes
how a page isolates tenant text for bidi and what it does with bidi control characters. The
part on control characters is revised for the security review of that day
(`docs/reviews/2026-11-28-security-review-text-outside-ascii.md`, ruling E) and was
accepted by its re-review the same day.

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
  doctor(): Promise<DoctorPage>;         // `report/doctor.json`. Private; M1 export only.
  theme(): Promise<ThemeTokens>;
}
```

M1 has one implementation, which reads the bundle directory named by the environment variable
`EZDP_BUNDLE_DIR` at build time ("The export command"). Routes come from `generateStaticParams` over the manifest. Page components are
presentational: they take `PageData`, or `DoctorPage` for the doctor page, and nothing else, and do not know where it came from. M4 adds
a second `ContentSource` keyed by tenant in front of the same components. `Manifest`, `PageData`
and the page paths are the engine's (ADR 0003, "The portal bundle"); `page(path)` takes a page
path from the manifest. The doctor page is not in the manifest. It is one fixed route,
`doctor`, whose only source is `doctor()`, and no other component calls `doctor()` or links to
that route. A `ContentSource` that serves readers in M4 does not implement it.

**Units.** A portal bundle is one unit: one version of one API (ADR 0002, ADR 0003). A
`ContentSource` therefore serves one unit, and from M4 a portal has one per (project, API,
version). Two prefixes stand in front of a bundle path, and they are different things: the
**base path**, where the portal is mounted (`/docs`), which also carries the app's own build
assets and the theme; and the **unit prefix**, where one API version sits below it
(`payments/v2`). Both are settings of the M1 build, because criterion 21 tests an export at the
root, under `/docs` and under `/docs/payments/v2`.

| Setting | CLI option (ADR 0003) | Given to the portal as | Form | Default |
|---|---|---|---|---|
| Base path | `--base-path` | `EZDP_BASE_PATH` | Empty, or `/` and a segment, repeated, with no `/` at the end: `^(/[A-Za-z0-9._~-]+)*$`, no segment `.` or `..` | Empty |
| Unit prefix | `--unit-prefix` | `EZDP_UNIT_PREFIX` | Empty, or segments joined by `/` with none at either end: `^[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9-]*)*$` | Empty |

- A value that does not match stops the build before anything is written. A unit prefix
  cannot begin with `_`, so it never collides with the build assets' directory.
- The base path is fixed when the export is built. Criterion 21's three cases are three
  builds, each served from a plain file server at its own base path.
- **One function builds every URL**: `unitUrl(settings: { basePath: string; unitPrefix: string },
  path: string): string`, where `path` is a bundle path or a path below the unit's base. It
  returns the base path, then `/` and the unit prefix if there is one, then `/` and `path`:
  `unitUrl({ basePath: '/docs', unitPrefix: 'payments/v2' }, 'operations/get-pet/')` is
  `/docs/payments/v2/operations/get-pet/`. No component joins a bundle path to a prefix itself
  or assumes that a bundle path starts at the portal root. Next adds its `basePath` to router
  links by itself, so the one wrapper around `<Link>` calls `unitUrl` with an empty base path;
  a link to a file Next does not route (a twin, `llms.txt`, the published spec, and
  `doctor-report.json` from the doctor page alone) is a plain anchor with the full `unitUrl`.

`theme()` is on `ContentSource` for M1 only; a theme belongs to the portal, not to a unit, and
M4 moves it. In M1 it returns `defaultTheme`.

**The export command.** `apps/portal` has one package script, `export`, and it is the only way
an M1 export is made. `ezdp build` runs it as a child process in the portal's directory (ADR
0003, "The M1 command line"); the portal does not import the publisher and the publisher does
not import the portal (ADR 0001, rule 2).

- **In**, as environment variables: `EZDP_BUNDLE_DIR`, an absolute path to a directory holding
  the `PortalBundle` files at their paths; `EZDP_OUT_DIR`, an absolute path to an empty or
  missing directory; `EZDP_REPORT_DIR`, the same for the report directory, and not inside
  `EZDP_OUT_DIR`; `EZDP_BASE_PATH` and `EZDP_UNIT_PREFIX`, as above.
- **It does three things.** It runs the Next.js build with `output: 'export'`,
  `trailingSlash: true` and `basePath` set to the base path, which writes the pages and the
  app's build assets. Then it copies everything under the bundle's `static/` to
  `<EZDP_OUT_DIR>/<unit prefix>/`. Then it takes the doctor page out: it moves
  `<unit prefix>/doctor/` whole, with every file the Next.js build wrote for that page, to
  the same path under `EZDP_REPORT_DIR`, copies `_next/` there, and copies the bundle's
  `report/doctor-report.json` to `<EZDP_REPORT_DIR>/<unit prefix>/doctor-report.json`.
- **Out**: `EZDP_OUT_DIR` is the complete public export except `spec/`, which the publisher
  adds. It never holds the doctor page or `doctor-report.json`, and the export command has no
  setting that leaves them in: including them is the publisher's copy under `--public-report`
  (ADR 0003, "The M1 command line"). `EZDP_REPORT_DIR` holds the doctor page, its assets and
  the JSON report, laid out as the export is, so it can be served at the base path and audited
  (criteria 20 and 22). It exits non-zero on any failure.
- **Why one build and a move, not a second export.** A second Next.js build for one page would
  add a build's fixed time to every `ezdp build`, and would need a second mode of the app and
  a bundle split in two. The move is one directory, and the page under test is the same HTML
  either way. The cost is that privacy rests on the move being complete; the test in ADR
  0003, "The doctor report is private", checks that on every CI run.
- One export runs at a time in a portal directory. Tests that build exports run one at a time.

**Where each file is.** The export directory is what is served at the base path. `U` is the
unit prefix, and is nothing when the prefix is empty.

| File in the export directory | URL | Put there by |
|---|---|---|
| `_next/…`, the app's build assets | `<base path>/_next/…` | The Next.js build. Not under the unit prefix. |
| `U/index.html` | `<base path>/U/`, the unit's base | The Next.js build |
| `U/<page path>/index.html` | `<base path>/U/<page path>/` | The Next.js build |
| `U/<page path>.md`, `U/llms.txt` | The same path below the base path | The export command, from `static/` |
| `U/spec/openapi.json` or `.yaml` | The same path below the base path | The publisher (`ezdp build`), unless `--no-published-spec` |
| `U/doctor/index.html`, `U/doctor-report.json` | `<base path>/U/doctor/` and the same path below the base path | The publisher, from the report directory, with `--public-report` only. Absent by default. |

`<page path>` in this table is a public page's path, so never `doctor`. The report directory
has the last row's two paths and a copy of `_next/`, and nothing else.

The theme is a `<style>` block in each page, so it has no file. With a unit prefix the
directory above it has no page in M1; M4d's product switcher is what goes there.

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
3. Everything under the bundle's `static/` is copied into the export as files, by the export
   command: the Markdown twins and `llms.txt`. `manifest.json`, `model.json` and the page
   files are build inputs and are not exported. Nothing under the bundle's `report/` is
   copied into the export by the export command. The published spec
   is not in the bundle; the publisher writes it into the export ("The export command").
4. All links go through `unitUrl`, and the URLs of the app's own build assets through the
   configured base path, so the same source builds for `/`, for `/docs` and for
   `/docs/payments/v2`. Tenant-supplied files are the exception: see
   "Tenant assets" below.
5. CI runs a full static export over the fixture corpus. If it fails, the change is rejected. This
   is the test of the standing constraint.
6. Layout, so the export works from a plain file server (criterion 21). The export uses
   `trailingSlash: true`: the page with path `P` is the file `P/index.html` and is linked as
   `P/`; the home page, path `index`, is the unit's base itself. Its twin is the file `P.md`
   beside that directory, which is what criterion 17 means by the page URL plus `.md`.
   `llms.txt` and `spec/` sit at the unit's base, which is the base path
   and the unit prefix ("Where each file is"), and so do `doctor/` and `doctor-report.json`
   when `--public-report` includes them. The first path segments
   the engine uses are a closed list: `operations`, `schemas`, `tags`, `doctor` and `spec`.
   `doctor` stays reserved whether or not the report is included. The
   prefix reserved for guides in M5 (contract 3) must not be one of them.
7. The HTML of a page is linear in its page file. A reference to a named schema is rendered as
   a link or an expander that points at that schema's one section on the page
   (`#schema-<slug>`) or at its own page; the renderer never renders a referenced schema inside
   the schema that refers to it. This is what keeps a recursive schema finite (criterion 2) and
   stops the expansion of ADR 0003, "Budgets".
8. Fragments are the ones ADR 0003 lists, and no other `id` is promised. An element that
   carries one is in the HTML as exported and is not inside content that starts collapsed, so
   the URL loads directly to it with JavaScript off (criterion 11).

9. No exported page links to the doctor page or to `doctor-report.json`, and neither is in the
   navigation, with or without `--public-report` (ADR 0003, "The doctor report is private").
   What a public page says about the spec, such as "the spec declares no credential", comes
   from its own page file.

"Try it" in M2 is a client component that calls the proxy, a separate service. Pages stay static.

**Tenant text.** Descriptions in the model are untrusted Markdown. A `Markdown` field of a page
file is not that text: it is the safe form the engine made with `sanitizeMarkdown` (ADR 0003,
"Tenant Markdown"), in which raw HTML and autolinks are already text, images are their alt
text and refused links are their link text. The twin is written from the same string, so the
page and the twin agree. The renderer parses the field with the engine's `parseMarkdown` into a
syntax tree and maps a fixed set of node types to React elements with our own code. It has no
Markdown parser of its own and imports none (lint), so the engine and the renderer cannot
disagree about what a text contains. The parser is `mdast-util-from-markdown` with four GFM
extensions loaded individually: tables, task lists, strikethrough and footnotes.
`mdast-util-gfm` is not used, because it also turns on autolink literals, which the guides
contract forbids (4.1) and which would make links out of the bare URLs in spec descriptions.

The rules below stay in force on the safe form. They are the renderer's own check and do not
rely on the engine having run: a page file is data, and the renderer trusts none of it.

- HTML nodes are rendered as text. `dangerouslySetInnerHTML` is banned in the app by lint.
- Link targets are limited to `https:`, `mailto:` and in-page anchors, as the engine's
  `linkDestinationAllowed` decides (ADR 0003): an `https:` target must match the regex in
  contract 4.5 and have no `\`. The renderer also parses it with the WHATWG
  parser and rejects it if the parsed host differs from the host in the text. A target that fails
  any of these is rendered as its text. External links are rendered with
  `rel="noopener noreferrer nofollow ugc"`. This is the rule in contract 4.5, and one function
  serves both spec descriptions and guides.
- Images in spec descriptions are not loaded from remote hosts. An image is rendered as its alt
  text, and the page makes no request to the image's URL.
- Every `id` derived from tenant text, such as a heading anchor, gets a fixed prefix of ours, so it
  cannot shadow a DOM global. Client code does not use global named lookups (`window[name]`, a
  bare identifier that resolves to an element, `document.<name>`); lint enforces what it can.
- The same parser will serve guides in M5, with the contract's nesting cap of 32. It runs
  inside the engine's guides validator, and the renderer is given the validator's tree: it
  does not parse a guide page ("Guide pages and generated values").

**Direction of tenant text.** Decided 2026-11-28 for criterion 33, clause (c). It binds M1
pages and the doctor page, and M5 guide pages use the same component.

- **The page is left-to-right**: the root element is `<html lang="en" dir="ltr">`, and all
  text of ours is in that direction.
- **One component renders a tenant string**, in an element of its own that carries
  `dir="auto"`: a `<span>` by default, or the element the caller names (`h1`, `td`, `code`,
  a link's text). HTML's rendering rules give any element with a `dir` attribute a computed
  `unicode-bidi` of `isolate` (`plaintext` for `pre`), and `dir="auto"` takes the direction
  from the string's first strong character. It needs no stylesheet and works with JavaScript
  off. Every tenant string on a page goes through it: titles, summaries, the names of tags,
  schemas, properties and parameters, enum values, path templates, examples, server URLs,
  navigation titles, `PageRef.description`, and tenant text in a finding on the doctor
  page. A tenant string never shares a text node with text of ours: a label, a `:` or a
  type name beside it is outside its element.
- **URLs and path templates are the exception: `dir="ltr"`, not `auto`.** A path template,
  the method and path of an operation, and a server URL are isolated the same way but
  always laid out left to right, as RFC 3987, section 4.1, requires for an IRI: with
  `dir="auto"`, `/مستخدمين/{id}` would show its segments in reverse order. Their computed
  `unicode-bidi` is still `isolate`. Criterion 33(c) exempts them (amended
  2026-11-28).
- **Markdown.** Each block element made from a safe-form description (paragraph, heading,
  list item, table cell, block quote) carries `dir="auto"`, so each paragraph of a
  description in two languages takes its own direction.
- **Code reads left to right.** A `pre` has `dir="ltr"`. In a highlighted sample, every
  token span has `unicode-bidi: plaintext` from the code block's CSS module, so a
  right-to-left string literal takes its direction from its own first strong character and
  cannot reorder the tokens around it. How such a line looks beyond that is UX's (m1.md,
  "Not tested by these criteria"), but the isolation is not optional. Code that is not
  highlighted (over the cap, or a code block in a description) has no per-token isolation;
  its `pre` is isolated. Inline code that holds one tenant string is the component above as
  `<code dir="auto">`.
- **Bidi control characters** (revised for the 2026-11-28 review, ruling E;
  accepted by the security re-review of 2026-11-28). The marks U+200E, U+200F and
  U+061C are rendered as themselves: writers of right-to-left text use them, and they act
  only on the neutral characters beside them inside an element that is already isolated.
  Each embedding, override or isolate control, U+202A to U+202E and U+2066 to U+2069, is
  rendered as an element of its own, `<span dir="ltr" data-ez-bidi="U+202E">` holding that
  one code point. The control then starts an embedding that ends at its own element's edge
  with nothing in it, so it reorders nothing, and an unmatched closing control is ignored.
  A rule of ours, `[data-ez-bidi]::before { content: attr(data-ez-bidi) }`, styled from
  tokens, shows the reader that the text holds one. The DOM's text content and copied text
  are unchanged, because generated content is neither; the attribute's value is one of nine
  fixed strings of ours. Where markup cannot wrap a character, in an attribute value
  (`title`, `aria-label`, `alt`), in `<title>` and in a `<meta>` content, those nine
  controls are removed and the marks kept. Samples never hold any of them (ADR 0005, "Text
  outside ASCII", rule 3).
- **How the markup is built** (ruling E, in the reviewer's wording). The component builds
  React elements from the string's code points. No tenant text is put into an HTML string,
  `dangerouslySetInnerHTML` or `innerHTML`. The rule applies inside `pre` and `code` as it
  does everywhere else. The marker is `::before` and never `::after`: content after the
  control would be inside its override and shown reversed. In an element that holds only
  text (`<option>`, `<textarea>`, `<title>`), in an attribute value, in a `<meta>` content
  and in text that a script sets (`textContent`, `document.title`), the nine controls are
  removed and the marks are kept.
- `lang` is not set on tenant text: OpenAPI does not say what language a description is in.

Alternative rejected: `unicode-bidi: plaintext` from component CSS in place of `dir="auto"`.
It reorders the same way but does not set `direction`, so a right-to-left paragraph is still
aligned and laid out left to right, and it depends on a stylesheet loading.

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

**Guide pages and generated values.** M5. M1 renders no guide page and fills no variable, so
none of this is M1 work.

- **The renderer builds a page only from the tree the validator produced for a page with no
  page error; it never parses a page file itself.** The tree is `GuidesValidation.pages[].tree`
  (ADR 0003, "Guides: what M5 adds"). The portal app has no code path from a page file's text
  to elements, and a lint rule keeps the guide components from importing the engine's
  Markdown parser.
- **For a page with a page error, preview and dashboard show only its slug, finding codes and
  line numbers: never its frontmatter title or description, and no excerpt of its source.**
  That covers `invalid-frontmatter`: a title that failed validation is never shown. The
  preview never renders a page-error body, and such a page's navigation entry is its slug. A
  finding's `message` is the engine's fixed text for the code and holds no bundle text, so
  showing it shows nothing a tenant wrote.
- **`unique` values are generated by client code, in the reader's browser.** One value per
  sample for `unique`, one per page for each of `unique_1` to `unique_9`, chosen when the
  page loads (contract 4.6). Each digit is drawn by rejection sampling from
  `crypto.getRandomValues`. If that is unavailable the placeholder keeps its display text;
  `Math.random` is never used. A value is never written to storage, a URL or analytics. It
  is held in memory for as long as the page is open and filled into placeholder elements
  through the `Var`'s encoders, like any runtime value.
- **Display text.** Before any script runs, with JavaScript off, and when the random source
  is missing, a placeholder shows `UNIQUE` or `UNIQUE_1` to `UNIQUE_9` (ADR 0005, "Display
  text for generated values"). The exported HTML holds only that text, so the export stays
  byte-identical for the same input and static export is unaffected.
- **A "new values" control** replaces every generated value on the page together. It makes
  no request and reloads nothing. Its design is UX's.
- **Which milestone.** M5, with guides: a `unique` variable can only come from a guide's
  `<Sample>`, and no reference page has one. M2 builds the code that fills a placeholder
  through its encoders, for credentials; M5 adds the generator and the control on top of it.

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
- New runtime dependencies in `apps/portal`: `next`, `react`, `react-dom` and `shiki`. All
  MIT. The Markdown parser, `mdast-util-from-markdown` with the `micromark-extension-gfm-*` and
  `mdast-util-gfm-*` packages for `table`, `task-list-item`, `strikethrough` and `footnote`, is
  a dependency of the engine since 2026-11-27 (ADR 0001, rule 5) and reaches the portal through
  `parseMarkdown`. That is eight small packages in place of two umbrella packages, which is
  the cost of leaving autolink literals out.

## Alternative rejected

Have the renderer import the engine and build pages from the raw spec at request or build time.
It removes the bundle format, but it couples page rendering to spec parsing, makes the M4 renderer
parse tenant specs in the serving path, and leaves the proxy and MCP without a published model to
read. Also rejected: Tailwind or a component library for styling. Both are dependencies where
CSS Modules and variables do, and both tempt per-tenant style output.
