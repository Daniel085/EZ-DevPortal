# ADR 0004: Spec doctor findings and fixes

Status: proposed, 2026-11-26. Milestone: M1. Revised the same day to apply the security design
review (`docs/reviews/2026-11-26-security-design-review.md`, M7).

## Context

The spec doctor lints the spec and proposes fixes for auth schemes, servers and examples before
publishing. The customer's spec is usually fetched from a URL or a Git repository we do not own, and
it is fetched again on every publish. A fix therefore has to survive re-fetching, and has to fail
visibly when the spec has changed underneath it.

## Decision

One `Finding` type for everything the engine reports: parse errors, model-building problems and
doctor rules.

```ts
interface Finding {
  code: string;                 // stable, kebab-case: 'servers-missing', 'security-scheme-missing',
                                // 'example-missing', 'operation-id-collision', 'ref-unresolved'
  severity: 'error' | 'warning' | 'info';
  message: string;              // plain text, one or two sentences, no Markdown
  location: { uri: string; pointer: string;
              start: { line: number; column: number }; end: { line: number; column: number } };
  related: Finding['location'][];
  fingerprint: string;          // code + pointer + rule-specific key; stable across runs
  fixes: Fix[];                 // zero or more alternatives; the caller accepts at most one
}

interface Fix {
  id: string;                   // fingerprint + index
  title: string;                // 'Add bearer authentication to 14 operations'
  confidence: 'safe' | 'review';   // safe: mechanical. review: inferred, a person must confirm.
  inputs: { name: string; label: string; pointer: string }[];  // values the person must supply
  patch: SpecPatch;
}

interface SpecPatch {
  uri: string;                  // which document
  ops: ({ op: 'test'; path: string; value: Json }      // RFC 6902 subset
      | { op: 'add' | 'replace'; path: string; value: Json }
      | { op: 'remove'; path: string })[];
}
```

Severity: `error` blocks publishing (no correct model can be built). `warning` means the portal
builds but calls or samples are likely wrong. `info` is advice. Lines and columns are 1-based.

A fix is a **JSON Patch against the parsed document**, not a text edit. Every patch begins with
`test` operations asserting what the rule saw, so a stale patch is detected, not misapplied.

Patches are written by the engine and by nothing else. Pointer traversal and every lookup keyed by
tenant text use own properties only; `__proto__`, `constructor` and `prototype` segments are a
conflict; tenant-keyed maps are `Map` or null-prototype. The overlay stores engine-generated
patches by fix id; clients send a fix id and `inputs` only, never ops.

- `applyFixes` returns a `PatchConflict` for an op whose path has one of those three segments, and
  applies nothing from that patch. It does this for every patch it is given, whoever stored it.
- `bindFix(fix, inputs)` returns the fix's patch with each supplied input placed, as a JSON string,
  at the position its `inputs[].pointer` names. An input cannot add an op, change a path or supply
  a value that is not a string.
- The caller looks a fix up by id in the findings the engine produced on the server for the
  current spec. It never accepts a `SpecPatch` from a browser or an API client.

How a caller applies accepted fixes:

1. The caller stores each accepted fix in the project's **overlay**, in order: the fix id, the
   `inputs` the person supplied, and the patch `bindFix` returned for them. It stores dismissed
   fingerprints too. The engine stores nothing.
2. On every publish: fetch, `parseDocument`, `applyFixes(docs, overlay)`, then `buildModel` and
   `diagnose` on the result. Findings already fixed do not reappear.
3. `applyFixes` returns `conflicts` for patches whose `test` fails or whose path is gone. The caller
   shows them as "this fix no longer applies" and drops or re-proposes them. A conflict never
   blocks the other patches.
4. To hand the fixes back, `serializeDocument` returns the patched spec as text with comments and
   key order kept, for download or a pull request.

`source.hash` in the model is the hash of the spec as fetched, before the overlay.

Rules are pure functions `(model, docs) => Finding[]` in a registry inside the engine. The M1 rule
list is for the product manager and engine developer; the areas are auth, servers, examples,
identifiers and structure.

## Consequences

- In M1 the `ezdp` CLI keeps the overlay in a file beside the spec. In M4 the control plane keeps
  it per project. Neither changes the engine. The CLI's file is its owner's to edit; in the control
  plane the stored patches are only ever ones the engine generated, and the dashboard posts a fix
  id and inputs.
- `fingerprint` lets the dashboard remember accepted and dismissed findings between runs.
- The published portal is built from the patched spec. The guides module generates from the
  original and pins its hash, so the guides contract must say which hash is compared and which
  document guides are generated from. Raised with the contract owner; not decided here.

## Alternative rejected

Text edits (line and column ranges with replacement text). They preserve formatting exactly, but
they are tied to one fetch of one file in one format and silently corrupt the spec when it changes
upstream. Also considered: the OpenAPI Overlay specification as the stored form. It targets by
JSONPath, which needs a query engine and can match more than intended. Our patches convert to an
Overlay document mechanically, so it stays available as an export format.
