# ADR 0006: Renderer in M1: static export and theme tokens

Status: proposed, 2026-11-26. Milestone: M1.

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
4. All links and asset URLs go through the configured base path, so the same build works at `/`
   and under `/docs`.
5. CI runs a full static export over the fixture corpus. If it fails, the change is rejected. This
   is the test of the standing constraint.

"Try it" in M2 is a client component that calls the proxy, a separate service. Pages stay static.

**Tenant text.** Descriptions in the model are untrusted Markdown. The renderer parses them with
`mdast-util-from-markdown` plus `mdast-util-gfm` (MIT) into a syntax tree and maps a fixed set of
node types to React elements with our own code. HTML nodes are rendered as text. Link targets are
limited to `https:`, `mailto:` and in-page anchors. `dangerouslySetInnerHTML` is banned in the app
by lint. The same parser will serve guides in M5.

**Highlighting.** `shiki` (MIT), run at build time in server components, with its JavaScript regex
engine and only the grammars for our sample languages plus JSON. We take tokens and render
`<span>` elements; colors come from Shiki's CSS-variables theme, so syntax colors are theme tokens
and no highlighter code reaches the browser.

**Theme.** `@ezdp/theme` exports the `ThemeTokens` type (JSON, `tokensVersion: 1`), a validator,
`defaultTheme`, and `tokensToCss(tokens): string`. Token groups: color (background, surface, text,
muted, border, accent, accent contrast, code background, syntax, HTTP method colors) for light and
dark; font families and sizes; radius; spacing; shadow. The designer owns the list and values.

- The root layout emits one `<style>` block of `--ez-*` custom properties from the token data.
- Components are styled with CSS Modules and refer only to `var(--ez-*)`. No literal colors, fonts
  or radii in component CSS (lint). No CSS framework.
- `tokensToCss` writes each value through a typed serializer (color, length, font-family list,
  number). It never copies a token string into CSS verbatim, so a token cannot inject CSS or a
  `url()`. In M3 the brand extractor produces the same JSON and nothing else.
- Fonts in M1 are system stacks. Font loading belongs with subpath hosting and M3.

## Consequences

- Changing a theme is changing a JSON document; no build of tenant-specific code or CSS files.
- The static-export CI job makes the constraint mechanical instead of a review judgement.
- New runtime dependencies in `apps/portal`: `next`, `react`, `react-dom`, `shiki`,
  `mdast-util-from-markdown`, `mdast-util-gfm`, `micromark-extension-gfm`. All MIT.

## Alternative rejected

Have the renderer import the engine and build pages from the raw spec at request or build time.
It removes the bundle format, but it couples page rendering to spec parsing, makes the M4 renderer
parse tenant specs in the serving path, and leaves the proxy and MCP without a published model to
read. Also rejected: Tailwind or a component library for styling. Both are dependencies where
CSS Modules and variables do, and both tempt per-tenant style output.
