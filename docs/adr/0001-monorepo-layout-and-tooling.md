# ADR 0001: Monorepo layout and tooling

Status: accepted, 2026-11-27. Proposed 2026-11-26; it passed the security design review and
re-review of that day unchanged. Milestone: M1. Revised 2026-11-27: rule 5 records the user's
decision on the Public Suffix List. Revised again that day after the second audit: the engine
gains a Markdown parser (rule 5 line below), and rule 2 names the one process boundary between
`publisher` and `portal`.
Revised 2026-11-28 to answer the engine developer's scaffold questions: rule 3 says what "a
single `exports` map" means, and "Dev tooling" and "Scaffold decisions" are added. No rule is
loosened for runtime dependencies. The user allowed a dev-only transitive package under
MPL-2.0 on 2026-11-28 ("Dev tooling"). Revised again that day for the security review of
"Text outside ASCII": a lint ban on case-mapping methods in engine source (rule 4), the
`packageManager` hash and the lifecycle-script rule ("Scaffold decisions").

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
   `no-restricted-imports` backs it up. In M1 that map has exactly one entry, `"."`, in every
   package. A second subpath (`@ezdp/engine/markdown`) is a change to the package's public
   interface and needs an ADR line first. Splitting code into modules inside a package is not:
   ADR 0003's "a module of its own" for the Markdown parser means a source file under
   `src/`, re-exported through `"."`, so that a bundler can drop it (`sideEffects: false`).
4. `engine` and `theme` must run unchanged in Node, a browser and an edge runtime. Their tsconfig
   uses `"lib": ["ES2023"]` and `"types": []`, so `fetch`, `process`, `fs` and DOM types do not
   compile. ESLint bans `Date`, `Math.random`, `console` and `node:*` there. In engine
   source it also bans calls to `toLowerCase`, `toUpperCase`, `toLocaleLowerCase` and
   `toLocaleUpperCase` on any value, because they are not ASCII lower-casing (ADR 0002,
   "Text is kept as authored"); the engine uses its own function. Added 2026-11-28 on the
   security review of "Text outside ASCII"; enforced in `eslint.config.js` (dot and bracket
   access) and tested in `packages/engine/test/lint-bans.test.ts`.
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

**Dev tooling** (decided 2026-11-28). Rule 5 governs runtime dependencies: anything in a
package's `dependencies`, and anything whose code reaches `dist/`, the export or a service. A
development tool is not one, but it is not unlisted either. The workspace's direct
development dependencies are these, all in the root `package.json` and nowhere else unless an
ADR line says so:

| Package | Version | Licence | Use |
|---|---|---|---|
| `typescript` | 6.0.3 | Apache-2.0 | `tsc -b`, type checks |
| `eslint` | 10.15.0 | MIT | Lint, including the rules 1, 3 and 4 bans |
| `typescript-eslint` | 8.73.0 | MIT | TypeScript parser and rules for ESLint |
| `vitest` | 4.1.12 | MIT | Tests |
| `@types/node` | 24.19.3 | MIT | Node types for tests and the publisher only (rule 4) |

- Adding a direct development dependency needs a line here, with its licence, which must be
  one rule 5 permits. Rule 5's "why our own code would not do" does not apply to tools.
- Their transitive packages may carry another OSI-approved licence, because they are never
  shipped. Read from the installed tree on 2026-11-28 (191 packages): all MIT, ISC, BSD or
  Apache-2.0 except `minimatch` and `@isaacs/nonrecursive-glob-match` (BlueOak-1.0.0, a
  permissive licence, through ESLint) and `lightningcss` (MPL-2.0, a direct dependency of
  Vite 8, through Vitest). **Allowed by the user on 2026-11-28:** an MPL-2.0 package is
  permitted as a transitive dev dependency that is never shipped, modified or vendored. This
  does not make MPL-2.0 a permitted licence for runtime dependencies; the decision of
  2026-11-27 stands for those. No Vitest release avoids it: Vitest 5 takes Vite as a peer and
  brings the same package.
- None of them may appear in a package's `dependencies`, in `dist/`, or in the export.
  Preferred, not required: a CI step that lists the production dependency tree's licences
  (`pnpm licenses list --prod`) and fails on one rule 5 does not permit.
- Versions. TypeScript 6.0.3, not 7.x, because `typescript-eslint` 8.73 supports
  `typescript` below 6.1. Vitest 4.x, not 5.x, because 4.x brings its own Vite. Both are
  accepted. Moving to TypeScript 7 waits for `typescript-eslint` to support it; it needs no
  ADR change beyond this table.

**Scaffold decisions** (2026-11-28, confirming the step 1 scaffold):

- **No dependency's lifecycle scripts run.** pnpm 10 runs no dependency build scripts by
  default, and the installed tree has no `preinstall`, `install` or `postinstall` script
  (security review of 2026-11-28, notes). Adding a package to `onlyBuiltDependencies` needs an
  ADR line.

- **Pinning.** `engines.node` is `>=24` with `engine-strict=true` in `.npmrc`;
  `packageManager` is `pnpm@10.34.5` with its integrity hash (`pnpm@10.34.5+sha512.…`, as
  Corepack writes it), so the package manager itself is pinned by content; every dependency, runtime or dev, is an exact version
  (`save-exact=true`); `pnpm-lock.yaml` is committed and CI installs with
  `--frozen-lockfile`. CI runs on Node 24. A Node upper bound is not set: the engine's output
  must not depend on the Node version, and criterion 20's two-machine build is the test of
  that (the engine compares text by code point and never uses `Intl` or `localeCompare`).
- **The portal is a type-check-only placeholder** until kickoff step 6 brings Next.js. It is
  not in the root `tsc -b` references and will not be: Next.js owns its build (ADR 0006, "The
  export command"). It type-checks against the engine's and theme's `dist/` declarations, so
  it is checked after `tsc -b`.
- **The publisher has no `bin` yet.** `ezdp` arrives with kickoff step 5 (ADR 0003, "The M1
  command line").
- **`check`** is `typecheck`, then `lint`, then `test`. `typecheck` runs `tsc -b` first, which
  writes `dist/` for the referenced packages, so cross-package imports in tests resolve
  through each package's `exports` to compiled output. There is no separate build step inside
  `check`, and tests never import another package's `src/`.

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
