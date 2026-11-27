# ADR 0001: Monorepo layout and tooling

Status: accepted, 2026-11-27. Proposed 2026-11-26; it passed the security design review and
re-review of that day unchanged. Milestone: M1. Revised 2026-11-27: rule 5 records the user's
decision on the Public Suffix List. Revised again that day after the second audit: the engine
gains a Markdown parser (rule 5 line below), and rule 2 names the one process boundary between
`publisher` and `portal`.

## Context

The brief fixes one TypeScript monorepo with four parts: engine, renderer, brand extractor, control
plane. M1 builds the engine and a minimal renderer. Something must also do the I/O the engine is
forbidden to do (read the spec, fetch external `$ref`s, write output). M2 adds the proxy and MCP
directly on the engine.

## Decision

pnpm workspaces, TypeScript `strict` (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`),
Vitest, ESLint. Node 24 or later. Libraries are compiled with `tsc` project references; no bundler
and no task runner (Turborepo, Nx) until `pnpm -r` is measurably too slow.

```
packages/engine      @ezdp/engine     pure library                      runtime deps: yaml, and the
                                                                        Markdown parser (below)
packages/theme       @ezdp/theme      token schema, default theme,      runtime deps: none
                                      tokens -> CSS variables
packages/publisher   @ezdp/publisher  the I/O shell and `ezdp` CLI      deps: engine, Node built-ins
apps/portal          @ezdp/portal     Next.js renderer                  deps: engine, theme
fixtures/specs/      spec corpus, owned by QA (not a package)
data/public-suffix-list/   vendored list snapshot (not a package; rule 5, ADR 0004)
docs/                brief, contracts, ADRs, milestones
```

Reserved, not created in M1: `services/proxy` and `services/mcp` (M2, depend on engine),
`services/brand-extractor` (M3, depends on theme only), `apps/dashboard` (M4).

Dependency rules:

1. Direction is one way: `engine` and `theme` depend on no workspace package. `publisher` depends on
   `engine`. `portal` depends on `engine` and `theme`. Nothing depends on `portal` or `publisher`
   except, later, the control plane on `publisher`.
2. `portal` and `publisher` do not depend on each other: neither imports the other and neither's
   `package.json` names the other. They meet at the portal bundle, a data format defined and
   versioned by the engine (ADR 0003), and at one process boundary: `ezdp build` starts the
   portal's export command as a child process, with a bundle directory and settings in and an
   export directory out (ADR 0006, "The export command"; ADR 0003, "The M1 command line"). The
   CLI finds the portal by a directory path, not by a package dependency.
3. Imports cross a package boundary only through the package's `exports` entry. No deep imports
   (`@ezdp/engine/src/...`). Each package declares a single `exports` map; ESLint
   `no-restricted-imports` backs it up.
4. `engine` and `theme` must run unchanged in Node, a browser and an edge runtime. Their tsconfig
   uses `"lib": ["ES2023"]` and `"types": []`, so `fetch`, `process`, `fs` and DOM types do not
   compile. ESLint bans `Date`, `Math.random`, `console` and `node:*` there.
5. A new runtime dependency in any package needs an ADR line naming the package, its license and
   why our own code would not do. Permitted licenses: MIT, ISC, BSD, Apache-2.0.
   One exception, decided by the user on 2026-11-27: one file, `public_suffix_list.dat` from
   publicsuffix.org, is vendored and shipped under MPL 2.0 as data, byte for byte as downloaded,
   with its header and the licence text beside it. It is not edited, not converted into a
   checked-in derived file and not compiled into the source of any package. MPL-2.0 does not
   become a permitted licence for dependencies. The design is in ADR 0004, "The Public Suffix
   List".

Runtime dependency lines under rule 5, added 2026-11-27. Package: `@ezdp/engine`.
`mdast-util-from-markdown`, with `micromark-extension-gfm-table`, `-gfm-task-list-item`,
`-gfm-strikethrough`, `-gfm-footnote` and the four matching `mdast-util-gfm-*` packages. All MIT;
installed together they bring 51 packages, every one MIT (read from each `package.json` on
2026-11-27, versions 2.x). Why not our own code: the engine must find raw HTML, links and images
in tenant Markdown exactly as the renderer's parser does (ADR 0003, "Tenant Markdown"); a
second, smaller parser of ours would disagree with it somewhere, and each disagreement is live
HTML in a twin. They move here from `apps/portal`, which now gets the parser from the engine
(ADR 0006). They do no I/O. Not verified: that they type-check under rule 4's `lib` and `types`;
the scaffold step checks it and comes back to the architect if they do not.

Fixtures: the spec corpus lives in `fixtures/specs/` at the repository root and is read only by
tests and by the `ezdp` CLI in development. Tests may do I/O; library source may not. Expected
outputs (golden model JSON, Markdown twins) live beside the test that owns them, in
`packages/<name>/test/__golden__/`, not in `fixtures/`, so one package's goldens never become
another's input.

## Consequences

- An engine developer and a renderer developer can work in parallel against the types in ADR 0002
  and the bundle in ADR 0003.
- M2's proxy and MCP import `@ezdp/engine` in a server; "Try it" imports the same code in the
  browser. Rule 4 is what makes both possible.
- The publisher is a small package now and becomes the body of the control plane's publish pipeline
  in M4. Its fetch code handles tenant-supplied URLs then, so it falls under security review.

## Alternative rejected

Put spec loading and file writing inside the renderer's build (`apps/portal` reads the spec and
calls the engine). Fewer packages, but it ties publishing to a Next.js build, puts network fetches
of tenant URLs inside the renderer, and gives M4's publish pipeline nothing to reuse.
