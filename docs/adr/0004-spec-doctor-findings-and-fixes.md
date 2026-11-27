# ADR 0004: Spec doctor findings and fixes

Status: accepted, 2026-11-26. Milestone: M1. Revised the same day to apply the security design
review (`docs/reviews/2026-11-26-security-design-review.md`, M7). The re-review
(`docs/reviews/2026-11-26-security-design-re-review.md`) passed it subject to required fixes:
rulings 3, 6 and 7 and the `bindFix` cap. They are applied in this text. Revised 2026-11-27 for
the product decision that guides are generated from the patched spec: the hashes, the published
spec and the rule that a fix never changes an operation id. No security ruling is changed.

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
                                // 'example-missing', 'operation-id-collision', 'ref-unresolved',
                                // 'server-not-callable', 'controlled-header-required'
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
tenant text use own properties only. Reads use `Object.hasOwn` or a `Map`; writes use
`Object.defineProperty` or a `Map`, never assignment with a tenant key. A `__proto__` segment is a
conflict. `constructor` and `prototype` are ordinary names. A test resolves and patches through
all three and asserts `Object.prototype` is unchanged. The overlay stores engine-generated patches
by fix id; clients send a fix id and `inputs` only, never ops.

- `applyFixes` returns a `PatchConflict` for an op whose path has a `__proto__` segment, and
  applies nothing from that patch. It does this for every patch it is given, whoever stored it. A
  path through `constructor` or `prototype` is applied like any other, as an own property.
- `bindFix(fix, inputs)` returns the fix's patch with each supplied input placed, as a JSON string,
  at the position its `inputs[].pointer` names. An input cannot add an op, change a path or supply
  a value that is not a string.
- Each input is at most 2,048 characters. `bindFix` returns `null` when an input is longer, and
  the caller stores nothing and tells the person which input was too long.
- The caller looks a fix up by id in the findings the engine produced on the server for the
  current spec. It never accepts a `SpecPatch` from a browser or an API client.

How a caller applies accepted fixes:

1. The caller stores each accepted fix in the project's **overlay**, in order: the fix id, the
   `inputs` the person supplied, and the patch `bindFix` returned for them. It stores dismissed
   fingerprints too. The engine stores nothing.
2. On every publish: fetch, `parseDocument`, `applyFixes(docs, overlay)`, write the published
   spec and hash it (ADR 0003, "The published spec"), then `buildModel` and `diagnose` on the
   patched documents. Findings already fixed do not reappear.
3. `applyFixes` returns `conflicts` for patches whose `test` fails or whose path is gone. The caller
   shows them as "this fix no longer applies" and drops or re-proposes them. A conflict never
   blocks the other patches.
4. `serializeDocument` returns the patched spec as text with comments and key order kept. The
   publisher writes that text as the published spec, and it is the same text that is offered for
   download or a pull request.

The model carries two hashes of the root document (ADR 0002): `source.fetchedHash`, of the spec as
fetched, before the overlay, and `source.publishedHash`, of the published spec. The guides module
generates from the published spec and puts its hash in `spec.sha256` (guides contract 1.2 and 3).

The order of events is: fetch; `diagnose`; the tenant accepts fixes; publish, which writes the
published spec; the guides module generates from it; the portal ingests the bundle. The published
spec's bytes, and so `publishedHash`, change when the upstream document changes, when a further fix
is accepted, when an accepted fix is removed, and when an accepted fix becomes a conflict and is
no longer applied. Each of these gives existing guides `spec-hash-mismatch`, a warning, until they
are regenerated.

**A fix never changes an identifier.** No fix changes the id of an operation or the key of a
schema. A fix that adds an `operationId`, or replaces a duplicate or empty one, writes exactly
the id that operation has in the model the finding was produced from: its `Operation.id`,
including any `_2` suffix, as the algorithm in contract 1.1 assigned it. That id is by
construction held by no other operation, so on the patched document the operation keeps it as a
declared id and every other operation's id is unchanged. Accepting such fixes for some operations
and not others, or removing one later, also leaves every id as it was. A test runs each
id-writing fix over the fixture corpus and asserts the ids before and after are equal. After the
fix, `idSource` is `'declared'`, and the id no longer shifts if a colliding path is added upstream.

Rules are pure functions `(model, docs) => Finding[]` in a registry inside the engine. The M1 rule
list is for the product manager and engine developer; the areas are auth, servers, examples,
identifiers and structure.

Two findings are fixed here, because the proxy, MCP and the guides contract (4.3) depend on them.
Both are warnings: the portal still builds and every code sample still renders.

- `server-not-callable`: a server the proxy will not send to under ADR 0003's proxy destination
  policy. That is a server URL that is `http://`, localhost or relative, and a server whose
  variables cannot be limited as contract 4.3 requires, such as one with no `enum` that forms or
  follows the last label of the host. "Try it" and MCP are withheld for that server. Samples are
  not affected: they are code for the reader to run, and a sample against `http://localhost`
  renders like any other.
- `controlled-header-required`: an operation that declares a required header parameter whose name
  is on the controlled-header list of contract 4.3. The portal never lets a caller set those
  headers, so it cannot make the call as the spec describes it. "Try it" is withheld for the
  operation, and MCP `call` with it, since both go through the same proxy. OpenAPI already says a
  header parameter named `Accept`, `Content-Type` or `Authorization` is ignored, and the model
  drops those three, so declaring `Authorization` as a parameter does not raise this finding; the
  doctor's auth rules cover that case.

## Consequences

- In M1 the `ezdp` CLI keeps the overlay in a file beside the spec. In M4 the control plane keeps
  it per project. Neither changes the engine. The CLI's file is its owner's to edit; in the control
  plane the stored patches are only ever ones the engine generated, and the dashboard posts a fix
  id and inputs.
- `fingerprint` lets the dashboard remember accepted and dismissed findings between runs.
- The published portal is built from the patched spec, and the guides module generates from that
  same document and pins its hash. Decided 2026-11-27; the rule is in guides contract 1.2 and 3.
- Guides can be generated only after a publish has produced the published spec. Accepting one
  more fix marks the existing guides out of date until they are regenerated.
- A fix in a referenced document, not the root, is applied to the portal but is not in the
  published spec, which is the root document only. This is an open item in contract section 8.

## Alternative rejected

Text edits (line and column ranges with replacement text). They preserve formatting exactly, but
they are tied to one fetch of one file in one format and silently corrupt the spec when it changes
upstream. Also considered: the OpenAPI Overlay specification as the stored form. It targets by
JSONPath, which needs a query engine and can match more than intended. Our patches convert to an
Overlay document mechanically, so it stays available as an export format.
