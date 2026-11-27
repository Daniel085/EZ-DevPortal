# ADR 0004: Spec doctor findings and fixes

Status: accepted, 2026-11-26. Milestone: M1. Revised the same day to apply the security design
review (`docs/reviews/2026-11-26-security-design-review.md`, M7). The re-review
(`docs/reviews/2026-11-26-security-design-re-review.md`) passed it subject to required fixes:
rulings 3, 6 and 7 and the `bindFix` cap. They are applied in this text. Revised 2026-11-27 for
the product decision that guides are generated from the patched spec: the hashes, the published
spec and the rule that a fix never changes an operation id. No security ruling is changed.
Revised again that day for the product decision on allowed hosts: "The fix for an open host
variable" is added, `Fix.inputs` gains `format` and `list`, and `bindFix` checks them. This
extends what the re-review confirmed for `bindFix` and goes to the security reviewer.
That review (`docs/reviews/2026-11-27-security-review-allowed-hosts-and-published-spec.md`)
passed it subject to required fixes: rulings 1 to 5 and F1. They are applied in this text, and
"The Public Suffix List" is added. Its licence exception was granted by the user on 2026-11-27
and is recorded in ADR 0001 rule 5.
Revised again that day for the user's decisions on live calls and host verification: "withheld"
for a server points to the one rule in ADR 0003, and the verified domain suffix is placed in M4b
beside a pointer to where host verification is to be designed. No finding or fix is changed.
Revised again that day to close gaps a readiness audit found: "Fatal and degrading faults" says
which faults stop a build; `PatchConflict` is defined; `example-invalid`, `webhook-not-rendered`
and `callback-not-rendered` are named; rules take `diagnose`'s options; and the Public Suffix
List snapshot is the one taken when the list is first vendored.
Revised again that day to close gaps a second audit found: "The M1 rule table" lists every
code, its severity and its fix; `SpecPatch` gains the `absent` op, which the "add what is
missing" fixes need; `bindFix` returns `null` for a missing input and `checkFixInputs` says why;
"The overlay file" defines the CLI's file. The `absent` op and the new fixes go to the security
reviewer with the patch code.

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
                                // Every code M1 can produce is in "The M1 rule table".
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
  inputs: FixInput[];           // values the person must supply
  patch: SpecPatch;
}

interface FixInput {
  name: string; label: string;
  pointer: string;              // where the value is placed: an RFC 6901 pointer into this
                                // fix's `patch` object, so it begins `/ops/<n>/value`
  format?: 'host-name' | 'host-suffix';   // closed list. Every value must match. Absent: any string.
  list?: { maxItems: number;    // the input holds several values, one per line (LF). They are
           firstPointer: string };  // placed at `pointer` as an array of strings, and the first
                                    // one at `firstPointer` as a string.
}

interface SpecPatch {
  uri: string;                  // which document
  ops: ({ op: 'test'; path: string; value: Json }      // RFC 6902 subset
      | { op: 'absent'; path: string }                 // ours, not RFC 6902; see below
      | { op: 'add' | 'replace'; path: string; value: Json }
      | { op: 'remove'; path: string })[];
}

interface FixInputIssue {       // returned by checkFixInputs
  name: string;                 // the input's name
  reason: 'missing' | 'unknown' | 'too-long' | 'format' | 'list';
  line?: number;                // for a `list` input: the 1-based line of the value that failed
}

interface PatchConflict {       // returned by applyFixes; nothing of that patch was applied
  patch: number; op: number;    // indexes into the patches given and into that patch's ops
  path: string;
  reason: 'test-failed' | 'path-missing' | 'forbidden-segment';   // the last: a `__proto__` segment
}
```

Severity: `error` blocks publishing (no correct model can be built). `warning` means the portal
builds but calls or samples are likely wrong. `info` is advice. Lines and columns are 1-based.

`location.pointer` is the offending node, or its parent when the fault is a missing key. A
`$ref` fault points at the `$ref` member itself. A parse fault has pointer `''` and its place
in `start` and `end`. This is the convention of `fixtures/specs/malformed/expected.json`, where
a `null` pointer means none is asserted.

### Fatal and degrading faults

One rule: **a fault is fatal only when the engine cannot tell what the root document is.**
Every other fault degrades. The engine throws in neither case.

- Fatal means `buildModel` returns `model: null` and a finding of severity `error`. The two
  always go together: `error` is used for nothing else by `parseDocument` and `buildModel`, and
  `diagnose` never returns one, because it runs only on a model. An `error` in `buildRequest`'s
  `issues` concerns that one request and no build.
- The publisher decides what a fatal finding means: it writes nothing and exits non-zero after
  printing each finding with its line or pointer (criterion 5). To make that possible it writes
  no file before `buildModel` has returned a model. It computes `publishedHash` from bytes in
  memory, and an output directory that already exists is left as it was.
- The fatal faults are these four, a closed list. All concern the root document.

  | Code | Fault | Stage in `expected.json` |
  |---|---|---|
  | `parse-error` | The text is not YAML or JSON, or is empty | parse |
  | `limit-exceeded` | The text is past a parsing limit (ADR 0003, "Budgets") | parse |
  | `not-openapi` | The root is not a mapping, or has neither an `openapi` nor a `swagger` key | structure |
  | `unsupported-version` | `swagger` is present, or `openapi` is not a string naming 3.0.x, 3.1.x or 3.2.x | structure |

- The first two in a document that is not the root are warnings: the document counts as
  missing, and each reference into it is `ref-unresolved`.
- **Everything else degrades** (criterion 6): the build completes, the fault is a `warning`, and
  the model keeps all it can. A node that is missing or of the wrong type becomes the nearest
  empty value the model allows; where there is none, the smallest item that holds it is dropped.

  | Fault | What the model holds |
  |---|---|
  | `info` or `info.title` missing | `title: ''`, `version: ''`; the renderer shows fixed text of ours |
  | A number or boolean where a string is required (`version: 1.0`) | The scalar's source text, `1.0` |
  | `paths` missing in 3.0, or not a mapping | No operations |
  | A path item or operation that is not a mapping | That path or operation is dropped |
  | `parameters` not an array | The operation, with no parameters from that list |
  | A parameter with no `name` or `in`; a response that is not a mapping | That parameter or response is dropped |
  | `responses` missing in 3.0 | The operation, with `responses: []` |
  | A schema keyword of the wrong type (`schema-invalid`) | The schema without that keyword |
  | A schema `$ref` that does not resolve, or to a document not supplied (`ref-unresolved`) | An empty schema node of any type, at the `$ref`'s place |
  | Any other `$ref` that does not resolve (`ref-unresolved`) | The parameter, response, body, header or example is dropped |
  | A cycle of `$ref`s that reaches no schema (`ref-circular`) | Each member is an empty schema node. One finding, at the member whose pointer sorts first, with the others in `related` |
  | An example that violates its schema (`example-invalid`) | Unchanged; the example is kept as declared |
  | A duplicate `operationId` (`operation-id-collision`) | Both operations, with ids by contract 1.1 |
  | Any other field OpenAPI requires that is absent: a server's `url`, a tag's `name`, a security scheme's `type` and the rest | What ADR 0002 says, "Fields OpenAPI requires and real specs omit" |

  A row that names no code is reported as `structure-invalid`. A map key that YAML reads as a
  number or a boolean, such as the response key `200:`, is the key's source text; that is not
  a fault and is not reported.

- So of the 16 fixtures in `fixtures/specs/malformed/`, five are fatal: the three of stage
  `parse`, `missing-openapi` and `unsupported-swagger-2.0`. The other seven of stage `structure`,
  the three of `resolve` and the one of `semantic` build a portal with findings.
- The code each of the 16 must produce, at the pointer `expected.json` already gives. The file's
  `$comment` says codes are not fixed yet; they are now, and QA adds them to it.

  | Code | Fixtures |
  |---|---|
  | `parse-error` | `empty.yaml`, `invalid-yaml.yaml`, `invalid-json.json` |
  | `not-openapi` | `missing-openapi.yaml` |
  | `unsupported-version` | `unsupported-swagger-2.0.yaml` |
  | `structure-invalid` | `missing-info.yaml`, `missing-info-title.yaml`, `missing-paths-3.0.yaml`, `missing-responses-3.0.yaml`, `wrong-type-paths.yaml`, `wrong-type-info-version.yaml`, `wrong-type-parameters.yaml` |
  | `ref-unresolved` | `dangling-ref.yaml`, `external-ref.yaml` |
  | `ref-circular` | `circular-ref.yaml` |
  | `operation-id-collision` | `duplicate-operation-id.yaml` |

  The eleven that build produce other findings as well, since none declares a server or a
  security scheme. The test asserts that a finding with this code is at this pointer, not that
  it is the only one.

Three more codes are fixed here because m1.md or ADR 0003 names their effect. None has a fix.

- `example-invalid`, a warning: a declared example of a parameter, a media type or a schema
  that `validateValue` finds in error (ADR 0003, "Schema validation"). The message names the
  first violated keyword. A keyword that was not checked, such as `pattern`, never causes it.
- `webhook-not-rendered` and `callback-not-rendered`, both info: one per entry of `webhooks`
  and one per callback of an operation, at that entry. M1 gives them no page, navigation entry,
  twin, `llms.txt` line or sample (m1.md, "Out of scope"). The model still holds them (ADR 0002).

A fix is a **JSON Patch against the parsed document**, not a text edit. Every patch begins with
`test` operations asserting what the rule saw, so a stale patch is detected, not misapplied.

`absent` is the one op that is not in RFC 6902. It asserts that the member at `path` does not
exist; it holds too when an ancestor does not exist. A fix that adds something missing begins
with it, because RFC 6902 cannot assert absence and its `add` replaces a member that exists:
without `absent`, a fix that adds an `operationId` would overwrite one the tenant added
upstream later. A failed `absent` is a conflict with reason `test-failed`. `add`, `replace`
and `remove` behave as RFC 6902 says.

Patches are written by the engine and by nothing else. Pointer traversal and every lookup keyed by
tenant text use own properties only. Reads use `Object.hasOwn` or a `Map`; writes use
`Object.defineProperty` or a `Map`, never assignment with a tenant key. A `__proto__` segment is a
conflict. `constructor` and `prototype` are ordinary names. A test resolves and patches through
all three and asserts `Object.prototype` is unchanged. The overlay stores engine-generated patches
by fix id; clients send a fix id and `inputs` only, never ops.

- `applyFixes` returns a `PatchConflict` for an op whose path has a `__proto__` segment, and
  applies nothing from that patch. It does this for every patch it is given, whoever stored it. A
  path through `constructor` or `prototype` is applied like any other, as an own property.
- `bindFix(fix, inputs)` returns the fix's patch with each input placed, as a JSON string,
  at the position its `inputs[].pointer` names. An input cannot add an op, change a path or supply
  a value that is not a string. The one exception is an input the fix declares with `list`: the
  engine splits it and places an array of strings. The fix decides that, not the input.
- Every input a fix declares is required; there is no optional input. `bindFix` returns `null`
  when `inputs` lacks one of them or holds a name the fix does not declare, compared as own
  properties. It never returns a patch with a value left unplaced. An empty string is a value.
  This is how criterion 10's "a fix whose input is not supplied is not applied" is met: the
  caller gets `null`, stores nothing, and the finding remains with the fix and its
  `inputs[].label` in the report.
- Each input is at most 2,048 characters. `bindFix` returns `null` when an input is longer, and
  the caller stores nothing and tells the person which input was too long. For a `list` input the
  cap is on the whole input, all lines together.
- `bindFix` also returns `null` when a value does not match the input's `format`, or a `list`
  input breaks the list rules below. `format` and `list` come from the fix the engine produced,
  never from the client.
- `checkFixInputs(fix, inputs)` is the pure function that makes all of these checks and returns
  one `FixInputIssue` per failure, so a caller can say which input or which line failed.
  `bindFix` returns `null` exactly when it returns at least one issue. A `list` input that
  declares no `format` is reported with reason `list`.
- The caller looks a fix up by id in the findings the engine produced on the server for the
  current spec. It never accepts a `SpecPatch` from a browser or an API client.

How a caller applies accepted fixes:

1. The caller stores each accepted fix in the project's **overlay**, in order: the fix id, the
   `inputs` the person supplied, and the patch `bindFix` returned for them. It stores dismissed
   fingerprints too. The engine stores nothing. The M1 CLI's file is defined in "The overlay
   file".
2. On every publish: fetch, `parseDocument`, `applyFixes(docs, overlay)`, hash the published
   spec (ADR 0003, "The published spec"), then `buildModel` and `diagnose` on the
   patched documents, then write. Nothing is written before `buildModel` returns a model
   ("Fatal and degrading faults"). Findings already fixed do not reappear.
3. `applyFixes` returns `conflicts` for patches whose `test` fails or whose path is gone. The caller
   shows them as "this fix no longer applies" and drops or re-proposes them. A conflict never
   blocks the other patches. The caller maps `PatchConflict.patch` to the fix id it stored and
   passes the result to `buildPortalBundle` as `notApplied` (ADR 0003), so the doctor report
   names the fix (criterion 28).
4. `serializeDocument` returns the patched spec as text with comments and key order kept. The
   publisher writes that text as the published spec, and it is the same text that is offered for
   download or a pull request.

### The overlay file

The M1 CLI's overlay (ADR 0003, "The M1 command line"). One JSON file, UTF-8, two-space
indent, LF line ends, keys in the order below.

```ts
interface OverlayFile {
  overlayVersion: 1;
  accepted: { fixId: string;                  // applied in this order
              inputs: Record<string, string>;
              patch: SpecPatch }[];
  dismissed: string[];                        // fingerprints. Reserved for M4: the M1 CLI
}                                             // writes [] and does not read it.
```

- **Name.** The spec's path plus `.ezdp-overlay.json` (`petstore.yaml.ezdp-overlay.json`),
  beside the spec. `--overlay <file>` names any other file, which is how one spec has both a
  fixes overlay and a mock-server overlay. Where QA keeps its overlays is QA's choice.
- **`patch.uri`** is the root document's `uri`, which in the CLI is the spec's base name, so a
  committed overlay works on any machine.
- **A build applies `patch` as stored.** It does not bind again. `fix accept` writes an entry
  only with a patch `bindFix` returned.
- **A hand-written entry** has a `fixId` that begins `manual:`. A fingerprint begins with its
  finding's code and no code is `manual`, so the two never collide. The file is its owner's to
  edit, and `applyFixes` treats every patch the same, whoever wrote it.
- **The mock-server overlay** (ADR 0005, "The local mock") is one hand-written entry:

  ```json
  { "overlayVersion": 1,
    "accepted": [ { "fixId": "manual:mock-server", "inputs": {},
      "patch": { "uri": "petstore.yaml", "ops": [
        { "op": "test", "path": "/servers/0/url", "value": "https://petstore3.swagger.io/api/v3" },
        { "op": "replace", "path": "/servers/0/url", "value": "http://127.0.0.1:14010/api/v3" } ] } } ],
    "dismissed": [] }
  ```
- A file that is not JSON or not of this shape stops the command with exit code 2 before
  anything is written.

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

Rules are pure functions `(model, docs, options) => Finding[]` in a registry inside the engine,
where `options` is the object `diagnose` was given: `publicSuffixes` and `limits` (ADR 0003).

### The M1 rule table

Every code a build can put in a doctor report in M1; a code that is not here is not emitted. "By" is the
function that reports it: P `parseDocument`, M `buildModel`, D `diagnose`, B
`buildPortalBundle` and what it calls. Which rules offer a fix is scope, and the product
manager may cut one: the cell becomes "None" and the message states what to change.

| Code | Severity | Trigger | Fix | By |
|---|---|---|---|---|
| `parse-error` | error | Not YAML or JSON, or empty | None | P |
| `limit-exceeded` | error | Past a parsing limit, or `bytes` over `inputBytes` (ADR 0003) | None | P |
| `not-openapi` | error | The root is not a mapping, or has neither `openapi` nor `swagger` | None | M |
| `unsupported-version` | error | `swagger` present, or `openapi` not naming 3.0.x, 3.1.x or 3.2.x; at that key | None | M |
| `version-read-as-3.1` | warning | `openapi` names 3.2.x; at `/openapi` | None | M |
| `structure-invalid` | warning | A node OpenAPI requires is missing, or a node has the wrong type ("Fatal and degrading faults") | None | M |
| `ref-unresolved` | warning | A `$ref` that does not resolve, or points to a document not supplied | None | M |
| `ref-circular` | warning | A cycle of `$ref`s that reaches no schema | None | M |
| `ref-siblings-ignored` | info | A 3.0 `$ref` with sibling keys, which are dropped (ADR 0002) | None | M |
| `schema-invalid` | warning | A schema keyword of the wrong type | None | M |
| `schema-keyword-ignored` | info | An assertion keyword the model does not hold (ADR 0003) | None | M |
| `slug-collision` | info | Two items of one pool share a slug (ADR 0002) | None | M |
| `operation-id-missing` | info | An operation with no `operationId`, or an empty one, whose derived id needed no suffix | Patch | D |
| `operation-id-collision` | warning | An operation that did not get the id it asked for: an earlier operation took its declared `operationId`, or its derived id needed a suffix. At the `operationId` member, else at the operation; the operation that holds the id is in `related` | Patch | D |
| `security-schemes-none` | warning | The spec defines no security scheme; at the root | None | D |
| `security-scheme-missing` | warning | A security requirement names a scheme that is not defined; at the requirement | None | D |
| `operation-security-missing` | warning | An operation that declares no `security`, in a spec whose root declares none | Patch, when the spec defines exactly one scheme | D |
| `operation-security-none` | info | An operation whose effective `security` is declared as `[]` | None | D |
| `authorization-parameter-ignored` | warning | A header parameter named `Authorization`, which the model drops (ADR 0002) | None | D |
| `header-parameter-ignored` | info | A header parameter named `Accept` or `Content-Type`, which the model drops | None | D |
| `controlled-header-required` | warning | Below | None | D |
| `servers-missing` | warning | Root `servers` is absent or empty and at least one operation has no server of its own; at the root | Patch with input | D |
| `server-url-placeholder` | warning | A server whose literal host is `example.com`, `example.org` or `example.net`, a name under one of them, or a name whose last label is `example`, `test` or `invalid` | None | D |
| `server-variable-no-default` | warning | A declared server variable with no `default` | Patch, when it has a non-empty `enum` | D |
| `server-not-callable` | warning | Below | Patch with input, for an open host variable only | D |
| `example-missing` | info | A parameter declaration, or the sample media type of a request body declaration, with no named example, no schema `examples`, no `default` and no `enum`, so that a sample value for it is synthesized. One per declaration, by `loc`, however many operations share it through a `$ref` | Patch, when the synthesized value is clean | D |
| `example-invalid` | warning | A declared example with `errors` under `validateValue` | None | D |
| `webhook-not-rendered`, `callback-not-rendered` | info | One per webhook and per callback | None | D |
| `request-invalid` | warning | `buildRequest` could not place a value as the spec describes it: a header name or value RFC 9110 forbids, or two credentials for one header (ADR 0005) | None | B |
| `synthesis-failed` | warning | A synthesized value that has `errors` (ADR 0003, "Schema validation") | None | B |
| `budget-exceeded` | warning | Derived work cut at a budget (ADR 0003, "Budgets") | None | B |
| `schema-allof-conflict` | info | `allOf` members give different values for a keyword (ADR 0003) | None | B |
| `markdown-not-rendered` | info | A description shown as a code block (ADR 0003, "Tenant Markdown") | None | B |

What each patch writes. `O` is the operation's pointer, `V` the variable's and `S` the
declaration's. `safe` and `review` are `Fix.confidence`.

| Code | Confidence | Patch |
|---|---|---|
| `operation-id-missing` | safe | `absent` `O/operationId`, or `test` it against `""` when it is empty; `add` `O/operationId`: `Operation.id` |
| `operation-id-collision` | review | With a declared id: `test` `O/operationId` against it; `replace` it with `Operation.id`. With none: as `operation-id-missing`. |
| `operation-security-missing` | review | `absent` `/security`; `absent` `O/security`; `test` `/components/securitySchemes` against the object seen, which holds one scheme; `add` `O/security`: `[{ "<scheme id>": [] }]` |
| `servers-missing` | review | `absent` `/servers`, or `test` it against `[]`; `add` `/servers`: `[{ "url": "https://{host}", "variables": { "host": { "enum": [], "default": "" } } }]`. One input, `values`: `list` with `maxItems: 32`, `format: 'host-name'`, placed at that `enum` and its first value at that `default`. Its input rules, its label and the caller's URL check are those of "The fix for an open host variable". Title: "Add a server. The hosts are published in the spec, and the first one becomes the default." |
| `server-variable-no-default` | review | `test` `V` against the object seen; `add` `V/default`: the first `enum` value |
| `server-not-callable` | review | "The fix for an open host variable" |
| `example-missing` | review | `absent` `S/example`; `absent` `S/examples`; `add` `S/example`: the value `synthesizeExample` gives. Offered only when that value has no `errors`, no unchecked keyword and was not cut, and, for a parameter, when it has a `schema`. Request side only: no fix ever writes a response example. |

Rules for the table:

- **A warning says what to do.** The `message` of a warning that carries no fix ends with what
  the buyer must supply or change (criterion 10).
- **One fault, one finding, one fix.** Applying a fix must remove the finding that carried it
  and no other (criterion 10), so no two findings share a cause:
  - An operation with no `operationId` whose derived id needed a suffix is reported as
    `operation-id-collision` only, and that finding carries the fix. Its message says the
    operation declares no `operationId`.
  - A variable for which `server-not-callable` offers the allowed-hosts fix is not also
    reported as `server-variable-no-default`: that fix writes its `default`.
  - `diagnose` synthesizes values only to build `example-missing` fixes. It does not report
    `synthesis-failed` or `budget-exceeded` for them; it offers no fix.
  - The doctor report holds one finding per `fingerprint`. `buildPortalBundle` drops a finding
    whose fingerprint is in `report.findings` or that it has already added.
- **A fix adds no finding** when its input is valid. The `servers-missing` fix writes a host
  variable with an `enum`, which is callable, and `server-url-placeholder` reads literal hosts
  only.
- **Not measured: how many findings the large fixtures produce.** The doctor page holds what
  fits in `pageBytes` (ADR 0003), and the test that no fixture yields `budget-exceeded` covers
  that page. If it fails there, the remedy is the architect's: a change to this table, not a
  raised limit.

Two findings are fixed here, because the proxy, MCP and the guides contract (4.3) depend on them.
Both are warnings: the portal still builds and every code sample still renders.

- `server-not-callable`: a server the proxy will not send to under ADR 0003's proxy destination
  policy. That is a server for which any of these holds. "Host clause" means clauses (a) to (c)
  of contract 4.3, "Server variables".
  - Its URL is `http://`, localhost or relative.
  - It has a variable in the scheme, userinfo, query or fragment, or a variable in the URL that is
    not declared under `variables`.
  - It has a variable whose `enum` is empty. An empty `enum` allows no value.
  - It has a variable in the host with no `enum` that does not meet the host clause. That covers
    a variable that ends the host (`https://{host}/v1`, `https://api.{domain}`), one whose label
    is followed by a public suffix or an IP address (`https://{x}example.com`,
    `https://{x}.co.uk`, `https://{x}.github.io`), and one followed by another variable.

  A host variable with an `enum`, and a variable in the port or path, never cause the finding by
  their position. Live calls are withheld for that server (ADR 0003, "Live calls and
  example-response mode"). For a variable that ends the
  host the finding can carry a fix; see the next section. In every other case it carries none.
  Samples are not affected: they are code for the reader to run, and a sample against
  `http://localhost` renders like any other.
- `controlled-header-required`: an operation that declares a required header parameter whose name
  is on the controlled-header list of contract 4.3. The portal never lets a caller set those
  headers, so it cannot make the call as the spec describes it. "Try it" is withheld for the
  operation, and both MCP call tools with it, since all go through the same proxy. OpenAPI already says a
  header parameter named `Accept`, `Content-Type` or `Authorization` is ignored, and the model
  drops those three, so declaring `Authorization` as a parameter does not raise this finding; the
  doctor's auth rules cover that case.

### The fix for an open host variable

Decided 2026-11-27. The allowed values of a host variable that needs an `enum` (contract 4.3;
earlier drafts called them the "tenant-listed set") are not a setting. The tenant lists the
allowed values by accepting a fix on `server-not-callable`, and the fix writes them into the spec
as the variable's `enum`. It is stored in the overlay like any other accepted fix. From then on
the variable has an `enum`, and the rule in 4.3 is met in its ordinary way.

**When the fix is offered.** The finding carries exactly one fix when all of these hold. In every
other case it carries none, and its message says to add an `enum` in the source spec.

- The server URL is absolute and `https`, and its host is not localhost.
- Every variable in the URL is in the host, port or path, and is declared under `variables`.
- The only reason the server is not callable is one variable with no `enum` that takes up whole
  labels at the end of the host: it begins the host or comes straight after a `.`, and the host
  ends where the variable ends. `https://{host}/v1` and `https://api.{domain}` qualify.
  `https://{region}.example.{tld}:8443` qualifies only when `region` has an `enum`; without one,
  `region` is a second reason, because the text after it holds a variable. A variable that is
  part of a label or is glued to one, as in `https://example.co{m}` or
  `https://example.com{suffix}`, does not qualify.
- So no fix is offered for a host variable that fails the host clause from any other position:
  `https://{x}example.com`, `https://{x}.co.uk`, `https://{x}.github.io`. The security review
  accepted this. Such a server needs an `enum` in the source spec.

The position is read from the server URL as the spec writes it, as contract 4.3 says. At most one
variable in a URL can qualify.

**Deciding the host clause.** The engine decides it from the server URL as written and the
Public Suffix List it is given (see "The Public Suffix List").

- Clause (a) at `diagnose` time: the literal characters of the variable's label plus one must be
  at most 63. The value itself is checked when it is substituted.
- Clause (b): the host is the text between `//` and the first `:`, `/`, `?` or `#` after it. If
  that text holds `@`, `[` or `]`, the clause fails.
- Clause (c): the literal text after the label's `.` is lower-cased (ASCII). It must be one or
  more non-empty labels of `a-z`, `0-9` and `-`. Anything else fails the clause; that covers an
  IPv6 literal, a trailing `.`, `_` and non-ASCII text, so an internationalized name is written in
  its `xn--` form. It is an IP address when its last label is a number as the WHATWG host parser
  reads one: digits only, or `0x` and hex digits. It is a public suffix when the list's algorithm,
  with wildcard and exception rules and the default rule `*`, gives the whole text as the suffix.
  By the default rule a single label that is not on the list (`internal`, `localhost`) is a
  public suffix.

**Worked examples.** No variable has an `enum`. The table was written against the list as
published on 2026-11-26. Nothing is vendored yet: `data/` does not exist. The pinned snapshot is
the one taken when the list is first vendored, during the M1 build, and `SOURCE.json` records
it. Before the row test is written the table is re-checked against that snapshot; a row whose
result differs is corrected here by the architect and shown to the security reviewer, who signs
off criterion 29.

| Server URL | Result | Why | Fix |
|---|---|---|---|
| `https://{x}.example.com` | Callable | The label `{x}` is followed by `.example.com`, which holds a registrable domain. | None needed |
| `https://api-{x}.example.com` | Callable | The label is `api-{x}`, followed by `.example.com`. A value of up to 59 characters keeps the label within 63. | None needed |
| `https://{x}example.com` | Not callable | The label is `{x}example`. What follows is `.com`, a public suffix, so a value could name `evilexample.com`. | None |
| `https://{x}.co.uk` | Not callable | `co.uk` is a public suffix (ICANN section). | None |
| `https://{x}.github.io` | Not callable | `github.io` is a public suffix (private section). | None |
| `https://{x}.internal` | Not callable | A single label not on the list is a public suffix by the default rule. | None |
| `https://{region}.{env}.example.com` | Not callable | `env` meets the clause. `region` does not: the text after it holds a variable. | None; `region` needs an `enum` |
| `https://{host}/v1` | Not callable | Nothing follows the label, so clause (b) fails. | Offered; values are `host-name` |
| `https://api.{domain}` | Not callable | Nothing follows the label, so clause (b) fails. | Offered; values are `host-suffix` |
| `https://example.com:{port}/v1` | Callable | There is no host variable. The port rule applies: a value matches `[0-9]{1,5}`. A value the URL parser refuses as a port, above 65535, is not sent. | None needed |

A test asserts every row against the pinned snapshot. When no list is given, the first two rows
are not callable either; see "Strict mode".

**Input.** One input, `values`, declared with `list: { maxItems: 32, ... }`.

- The input is the values separated by LF, one per line. There are 1 to 32 values. No line is
  empty and no value appears twice, compared exactly. The whole input is at most 2,048 characters.
- When the variable is the whole host (`https://{host}/v1`), `format` is `host-name`: each value
  is a full host name of two or more labels, at most 253 characters, matching
  `^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$`.
- When other text or variables come before it in the host (`https://api.{domain}`), `format` is
  `host-suffix`: each value is one or more labels, at most 253 characters, matching
  `^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z][a-z0-9-]{0,61}[a-z0-9]$`.
- In both, a label is 1 to 63 of lowercase letters, digits and `-`, with no `-` first or last, and
  the final label is at least two characters and begins with a letter. Every label is therefore
  inside the `[A-Za-z0-9_-]{1,63}` of contract 4.3. The syntax leaves out a port, userinfo, a
  path, a trailing `.`, `*`, `%`, whitespace, upper case, `_`, non-ASCII (an internationalized
  name is written in its `xn--` form), an IPv6 literal, and every form of IPv4 address, since
  the WHATWG parser reads a host as IPv4 only when its final label is a number. `host-name` also
  leaves out a single-label name such as `localhost`.
- Anything else makes `bindFix` return `null`, and nothing is stored. Values are not trimmed,
  lowercased or otherwise changed: what was typed is what is checked and written.

Rules for every `list` input, required by the security review of 2026-11-27:

- A `list` input must declare a `format`.
- Splitting is on LF only; a value containing CR or any other control character fails.
- `pointer` and `firstPointer` address only the `value` of an `add` op in that fix's own patch.
- The format check is input hygiene, not a security control; the proxy's parsing and address
  vetting are the control.

**The caller's check when a fix is accepted.** After `bindFix` returns a patch and before
anything is stored, the caller takes the values from the array `bindFix` placed in the patch.
For each one it parses `https://<value>/` with the WHATWG `URL` parser and refuses to store the
fix if parsing fails or the parsed host differs from the value, character for character. It does
this for every input whose `format` is `host-name` or `host-suffix`. The caller is the `ezdp`
CLI in M1 and the control plane in M4.

- The caller does this, not `bindFix`. Parsing a URL is pure, but the `URL` class is not part of
  ECMAScript. Its type comes from the DOM or Node typings, which ADR 0001 rule 4 keeps out of the
  engine (`"lib": ["ES2023"]`, `"types": []`), so `new URL(...)` does not compile there.
- Declaring `URL` by hand in the engine is rejected. Rule 4 works because what is not in the
  language does not compile, and one hand-written global would end that. Parsers also differ
  between runtimes, and the review verified Node's only. The accept-time check therefore runs
  in one known runtime, on the server.
- Writing our own WHATWG host parser in the engine is rejected: it needs IDNA processing, and
  the format regexes already admit nothing that needs it.
- Like the format check this is input hygiene. The review found no admitted value that the
  parser changed. The control is the proxy's check on every request (ADR 0003).

**Patch.** `S` is the pointer of the server object and `V` of the variable under it, with the
variable's name escaped as RFC 6901 requires.

1. `test` `S/url` against the URL the rule saw.
2. `test` `V` against the whole variable object the rule saw, which has no `enum`.
3. `add` `V/enum`: the values, as an array of strings in the order given.
4. `add` `V/default`: the first value. An `add` to a member that exists replaces it. OpenAPI 3.1
   requires `default` to be one of the `enum` values, so the first value listed is the default,
   whatever `default` was before. The `test` in step 2 covers the old `default`, so it is
   replaced only if it is what the rule saw.

**Title and label.** The default is where "Try it" sends unless the reader picks another value,
so the fix says which value it will be. The title also says the values are published; see below.

- `title`: "List the allowed hosts for this server. They are published in the spec, and the
  first one becomes the default."
- The input's `label`: "Allowed hosts, one per line. The first becomes the default."

The fix writes nothing else. It changes no operation id and no schema key, and servers are
referred to by index (ADR 0005), so "A fix never changes an identifier" holds. To change the
list, the accepted fix is removed and accepted again with the new values.

**What the values are, for security.** They are tenant input, trusted no more than an `enum` the
tenant wrote in its own spec, and this fix accepts less than such an `enum` may hold. Listing a
host exempts it from nothing. On every request the proxy still takes the value from the `enum`,
parses the substituted URL and applies `https` only, no userinfo and address vetting (ADR 0003,
"Proxy destination policy"). Listing an internal host therefore gains nothing: the request is
refused when its address is vetted. The proxy takes the `enum` from the published model and does
not know or care whether the tenant or the fix wrote it. An `enum` the tenant wrote in its own
spec is not syntax-checked at all. What holds for every value, whoever wrote it, is the proxy's
rule that the parsed host must equal the host built by position (ADR 0003).

**The values are published.** The `enum` is in the published spec, so the guides module sees it,
the reference shows it and anyone who can download the spec can read it. The fix's title says so
("Title and label" above).
Accepting, removing or changing the fix changes the published spec's bytes like any other fix,
and existing guides get `spec-hash-mismatch` until they are regenerated.

**Milestones.**

| Part | Milestone |
|---|---|
| The finding, the host clause and the Public Suffix List snapshot, the fix, `format` and `list` in `bindFix`, the CLI's check of each value with the URL parser, and the CLI's overlay file holding the values | M1 |
| The proxy and MCP refusing a server variable value that is not in the `enum`, and a request whose parsed host is not the host built by position | M2 |
| The dashboard form that collects the values and posts a fix id and `inputs` | M4 |
| A verified domain suffix; see below | M4b, planned |

**Planned, not designed: a verified domain suffix (M4b).** Some tenants give each customer its own
subdomain and cannot list them. For them the tenant would prove control of a domain once, by a
DNS record, and any host under it would be allowed. It depends on domain verification, which
the user moved from M6 to M4b on 2026-11-27 so that proof of domain control is required before a
portal is public. The suffix comes last in M4b and needs its own security review before it is
designed in detail. Until then an `enum` is the only way to make such a server callable.

**Callable is not verified.** This ADR decides whether a server is callable, from the spec
alone. Whether its host is verified for the tenant is the tenant's state, which `diagnose` does
not see, and no ADR defines it yet: ADR 0003, "Host verification: to be designed in M4b", holds
the open points and the user's decision of 2026-11-27 on a host that cannot be verified by DNS.
A host listed by the fix above must be verified like any other. A suffix is verified by DNS
only: the exact-host HTTP challenge deferred there never verifies a suffix. When "Try it" makes
a live call is one rule, in ADR 0003, "Live calls and example-response mode".

### The Public Suffix List

Clause (c) of the host clause needs the Public Suffix List, and the spec doctor decides
`server-not-callable` in M1, so the engine needs the list as data in M1.

**The engine stays pure.** The list is an input, not something the engine reads or fetches, and
it is not compiled into the engine.

```ts
parsePublicSuffixList(text: string): PublicSuffixList      // pure; throws on a malformed list,
                                                           // which is our data, not tenant input
diagnose(model, docs, options: { publicSuffixes: PublicSuffixList | null; limits: Limits }): Finding[]
```

- The caller reads the file and passes its text to `parsePublicSuffixList`. The caller is the
  publisher in M1 and also the proxy in M2, which needs the same answer per request and gets it
  from the same engine function.
- `publicSuffixes` is required. `null` means no list: clause (c) cannot be met, so every host
  variable needs an `enum`. A caller that forgets the list is therefore stricter, never looser.
- The parser and the matcher are our own code, about a hundred lines: rules, wildcards (`*.ck`),
  exceptions (`!www.ck`), the default rule, and both sections, ICANN and private. Rules written
  in Unicode are converted to their `xn--` form by our own RFC 3492 encoder, because the engine
  has no `URL` and no IDNA library. A test in the publisher, where Node's `URL` is available,
  compares the encoder's output with the URL parser's for every rule in the snapshot.
- No npm package is added. The packages that do this (`tldts`, `psl`) carry the same list inside
  them, so they would not avoid its licence; they would hide it, and the exception below covers
  one vendored file, not a dependency.
- Passed in and not compiled in, because: the file is 345 KB and the engine also runs in the
  browser, which never needs the list; the engine package then holds no third-party content; and
  a new snapshot is not an engine release.

**The snapshot.** One directory at the repository root. It is not a package, like `fixtures/`.

```
data/public-suffix-list/
  public_suffix_list.dat   the list, byte for byte as downloaded
  SOURCE.json              url, the file's own VERSION and COMMIT lines, date retrieved, sha256
  LICENSE                  the text of MPL 2.0
```

- Source: `https://publicsuffix.org/list/public_suffix_list.dat` and nowhere else, as the file's
  header asks.
- The file is never edited, filtered or converted to another checked-in form. It is parsed in
  memory each time a process starts.
- Provenance: a test recomputes the SHA-256 of the file and compares it with `SOURCE.json`, and
  checks the worked examples above against it. The security review asked for a provenance check.
- The publisher's build copies the three files unchanged into its package, and the proxy's does
  the same in M2. Nothing fetches the list at run time: a publish or a request must not depend on
  a third-party host, and the list a decision was made with must be the reviewed one.

**Updating.** A script outside library source downloads the file, writes it unchanged and
rewrites `SOURCE.json`. The result is an ordinary pull request, opened monthly by a scheduled
job, whose diff is the list's diff. The examples test and the provenance test run on it. A new
snapshot can change `server-not-callable` for an unchanged spec, in either direction, on the
next publish; it never changes the published spec's bytes or `publishedHash`.

**Licence: exception granted by the user, 2026-11-27.** Read from the file's header on
2026-11-27: the list is under the Mozilla Public License 2.0. ADR 0001 rule 5 permits MIT, ISC,
BSD and Apache-2.0 only. The rule is written for runtime dependencies and the list is a data
file, but we ship it, so the rule's intent covers it. The user allowed this exception, exactly
as worded, and ADR 0001 rule 5 records it. The policy is not widened beyond it:

> One file, `public_suffix_list.dat` from publicsuffix.org, may be vendored and shipped under
> MPL 2.0, as data, byte for byte as downloaded, with its header and the licence text beside it.
> It is not edited, not converted into a checked-in derived file and not compiled into the
> source of any package. MPL-2.0 does not become a permitted licence for dependencies.

Our reading, not legal advice: MPL 2.0 is a file-level licence, an unmodified file shipped with
its notice meets it, and it places no terms on our own code. Keeping the file unmodified is
what keeps the exception this narrow.

**Strict mode: `publicSuffixes: null`.** The publisher passes the vendored list by default, and
in M2 the proxy passes the same snapshot. `null` stays a supported mode, for a caller that does
not carry the list. The host clause then has the effect: "With no `enum`, a variable in the
host is not callable. Every host variable needs an `enum`." This is stricter than the review
requires and needs no list. Its cost is that `https://{tenant}.example.com` loses "Try it" and
MCP until the tenant adds an `enum` in its source spec, since the fix is offered only for a
variable that ends the host, and a tenant with unbounded subdomains has no route until the
verified domain suffix of M4b. The publisher and the proxy of one deployment use the same mode.
Both modes meet the review's rule, so a mismatch is not unsafe, but the spec doctor's findings
would then disagree with what the proxy sends.

**Residual risk, accepted by the security review.** Shared-hosting domains that are not on the
list, and a tenant's own subdomains that serve user content. A stale snapshot adds to the first.

## Consequences

- In M1 the `ezdp` CLI keeps the overlay in a file beside the spec ("The overlay file"). In M4 the control plane keeps
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
- `diagnose` takes the Public Suffix List as input, so its findings depend on the snapshot as
  well as the spec. The same spec and the same snapshot always give the same findings.
- Some servers that were callable under the earlier rule are not now, and have no fix:
  `https://{x}example.com`, `https://{x}.co.uk`, `https://{x}.github.io`, and a host variable
  followed by another variable. They need an `enum` in the source spec.

## Alternative rejected

For allowed hosts: a list in the project's settings that the caller passes to the engine. It
needs new storage and a new settings concept, and the published spec would not show which hosts
the portal calls, so the guides module and readers would see a server the spec does not describe.

Text edits (line and column ranges with replacement text). They preserve formatting exactly, but
they are tied to one fetch of one file in one format and silently corrupt the spec when it changes
upstream. Also considered: the OpenAPI Overlay specification as the stored form. It targets by
JSONPath, which needs a query engine and can match more than intended. Our patches convert to an
Overlay document mechanically, so it stays available as an export format.
