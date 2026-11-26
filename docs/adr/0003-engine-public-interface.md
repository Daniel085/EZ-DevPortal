# ADR 0003: The engine's public interface and the no-I/O rule

Status: proposed, 2026-11-26. Milestone: M1. Revised the same day to apply the security design
review (`docs/reviews/2026-11-26-security-design-review.md`, H4, M6, M7).

## Context

The engine must be a pure library: no network, filesystem, database or clock. Specs still have to
be fetched, external `$ref`s resolved and output written. Diagnostics need line and column, and
spec-doctor fixes patch the spec, so the parser must keep source positions.

## Decision

All engine functions are **synchronous** and take and return plain data. They never throw on bad
tenant input; they return findings (ADR 0004). They throw only on programmer error.

```ts
// Budgets. Every field is required. The engine exports `defaultLimits`; a caller may only lower them.
interface Limits {
  inputBytes: number; depth: number; nodes: number; aliasExpansions: number;   // parsing
  outputNodes: number; outputBytes: number;                                    // derived work, per call
}

// 1. Parse one document. YAML or JSON. Keeps a source map (pointer -> line/column range).
parseDocument(input: { uri: string; text: string }, limits: Limits): ParsedDocument

// 2. Which other documents does this one reference? Absolute URIs, resolved against doc.uri.
listExternalRefs(doc: ParsedDocument): string[]

// 3. Build the model from a closed set of documents. Missing documents become findings.
buildModel(input: { root: ParsedDocument; documents: ParsedDocument[]; sourceHash?: string })
  : { model: ApiModel | null; findings: Finding[] }

// 4. Spec doctor (ADR 0004).
diagnose(model: ApiModel, docs: ParsedDocument[]): Finding[]
bindFix(fix: Fix, inputs: Record<string, string>): SpecPatch      // the engine's patch with inputs placed
applyFixes(docs: ParsedDocument[], patches: SpecPatch[]): { docs: ParsedDocument[]; conflicts: PatchConflict[] }
serializeDocument(doc: ParsedDocument): string

// 5. Requests and samples (ADR 0005).
buildRequest(model, operationId, values: RequestValues | undefined, options: { limits: Limits; /* ... */ })
  : { request: HttpRequest; issues: Finding[] }
renderSample(request: HttpRequest, language: SampleLanguage): Sample

// 6. Projections of the model. The last three are bounded; see "Budgets" below.
getOperation(model, id) / getSchema(model, id)
resolveSchemaView(model, schema, limits: Limits): { node: SchemaNode; findings: Finding[] }   // allOf merged
toJsonSchema(model, schema, { refs: 'keep' | 'inline'; maxDepth: number }, limits: Limits)
  : { schema: Json; findings: Finding[] }                                                    // for M2 MCP
synthesizeExample(model, schema, limits: Limits): { value: Json; findings: Finding[] }       // deterministic

// 7. Everything the renderer needs, as data.
buildPortalBundle(model: ApiModel, options: { languages: SampleLanguage[]; siteUrl?: string; limits: Limits })
  : { bundle: PortalBundle; findings: Finding[] }
```

**Budgets.** `synthesizeExample`, `toJsonSchema`, `resolveSchemaView` and `buildPortalBundle` take
node and byte budgets from `Limits`; `maxDepth` is required; over budget yields a finding and
truncated output. The finding is `budget-exceeded`, a warning, located at the schema or operation
being expanded. Cutting recursion on the second visit to a schema is not a bound: twelve acyclic
schemas with ten properties each, every one referring to the next, expand to 10^12 nodes. The
budget counts nodes and bytes produced, so it bounds that case too. `buildRequest` passes its
`limits` to the example synthesis it does. The budget for `buildPortalBundle` covers the whole
bundle, and each page's share of it is bounded as well.

**Lookups keyed by tenant text.** Pointer traversal and every lookup keyed by tenant text use own
properties only; `__proto__`, `constructor` and `prototype` segments are a conflict; tenant-keyed
maps are `Map` or null-prototype. This binds the `$ref` resolver, `applyFixes` (ADR 0004), the
model's indexes by operation id, schema name and parameter name, and request building. In the
resolver a `$ref` with such a segment does not resolve and is reported as `ref-unresolved`. The
engine runs in a process shared between tenants, so a write to `Object.prototype` would cross
tenants.

`PortalBundle` is a list of files as data, `{ path, mediaType, content }[]`, with `bundleVersion: 1`:

| Path | Content |
|---|---|
| `manifest.json` | versions, navigation tree, page index (slug, title, kind, path) |
| `model.json` | the full `ApiModel`, for the proxy and MCP |
| `pages/<path>.json` | one self-contained page: the operation or schema, the named schemas it reaches, samples per language, examples |
| `search.json` | flat search records (id, kind, title, path, text). Not a library-specific index. |
| `static/<path>.md`, `static/llms.txt` | Markdown twins and `llms.txt` |

Paths in the bundle are relative to the portal root. The engine never bakes in a base path, so
subpath hosting (`host.com/docs`) is the renderer's concern alone.

Who does the I/O:

| Job | Owner |
|---|---|
| Read or fetch the spec, compute its SHA-256 | Caller (`publisher`) |
| Fetch external `$ref` targets: loop `listExternalRefs` -> fetch -> `parseDocument` until the set is closed or a cap is reached | Caller, under the URL policy below |
| Write bundle files | Caller |
| Timestamps, UUIDs, any randomness | Caller passes them in, or they are left out |
| Bound the time a publish may take | Caller. The engine has no clock. |

Publishing runs in a killable per-tenant worker with a time limit. The engine's budgets bound the
size of what it produces; they cannot bound time, because the engine cannot read a clock. The
worker is the control for that, and for anything a budget misses. One tenant's publish must not
share a worker with another tenant's.

Enforcement: ADR 0001 rule 4 (restricted `lib`, no Node types, lint bans), no `async` in the public
interface, and a test that builds the same fixture twice and compares bytes.

Libraries:

- **`yaml`** (ISC, no dependencies) parses YAML and JSON and exposes node ranges, which gives the
  source map, and it can re-serialize a patched document with comments kept. It is the engine's only
  runtime dependency. `Limits` caps alias expansion, depth, node count and input size while parsing,
  and nodes and bytes produced by derived work.
- **`$ref` resolution is our own code**: JSON Pointer lookup across the supplied documents, by own
  properties only, a few hundred lines. See the alternative below.
- **No schema validator dependency.** Where values must be checked against a schema (M2, M5), the
  engine interprets its own normalized schema. Ajv is ruled out because it compiles schemas to
  JavaScript, which is tenant content compiled to code. Tenant `pattern` regexes are not executed
  without a bound; that design goes to the security reviewer when it is needed.

Supported input in M1: OpenAPI 3.0.x and 3.1.x. Swagger 2.0 yields a single `unsupported-version`
error. 3.2 is read as 3.1 with a warning.

## URL policy

The engine requests nothing, so this policy is enforced by its callers. It is written here because
the fetch loop is defined here. It covers the root spec URL and every `$ref`.

- `https` only; `file:` only in the local CLI and only under the root's directory; no userinfo.
- Resolve, then reject loopback, RFC 1918, 169.254/16, 100.64/10, 0.0.0.0, IPv6 ULA and link-local,
  and v4-mapped addresses; connect to the vetted address. The connection goes to the address that
  was checked, not to a second lookup of the name.
- Redirects are re-vetted per hop, maximum 3.
- No credentials or cookies are sent.
- Caps: 100 documents, 10 MB each, 50 MB total, 10 s each, 60 s total.
- Uploaded specs get a synthetic URI. Its scheme is not `https` or `file`, so a relative `$ref` in
  an uploaded spec resolves to a URI the policy refuses.

A URL the policy refuses, and a document past a cap, is not fetched. The document is then missing
from the closed set and `buildModel` reports the reference as a finding. The loop stops at the
first cap it reaches, so a server that answers every request with a fresh `$ref` ends it at 100
documents or 60 seconds. The content of a refused URL never reaches a portal.

The same policy applies to the destinations the M2 proxy and MCP call (guides contract 4.3): the
scheme, userinfo, address and redirect rules as written. The document caps are about fetching
specs. The rule on credentials means the portal adds none of its own; the end user's credential
for the API, passed through for that request, is the one thing sent, and M2's design must say what
happens to it on a redirect.

## Consequences

- The same engine build runs in the publisher, in M2's proxy and MCP, and in the browser.
- The caller's fetch loop is the single place where tenant-supplied URLs are requested for a
  publish. SSRF controls live there, outside the engine, and are the URL policy above.
- Functions that returned a bare value now return it with findings, so a truncated result is never
  mistaken for a complete one.
- Per-page bundle files let the M4 multi-tenant renderer load one small file per request instead of
  the whole model.

## Alternative rejected

`@apidevtools/json-schema-ref-parser` (MIT) or `@scalar/openapi-parser` (MIT) for parsing and
dereferencing. Both resolve references by doing file and HTTP I/O themselves or need it stubbed
out, neither keeps the line and column positions the spec doctor requires, and full dereferencing
is the representation ADR 0002 rejects. What remains to write ourselves is small.
