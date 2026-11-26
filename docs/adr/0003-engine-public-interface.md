# ADR 0003: The engine's public interface and the no-I/O rule

Status: accepted, 2026-11-26. Milestone: M1. Revised the same day to apply the security design
review (`docs/reviews/2026-11-26-security-design-review.md`, H4, M6, M7). The re-review
(`docs/reviews/2026-11-26-security-design-re-review.md`) passed it subject to required fixes: R1,
R2, rulings 2, 3, 4 and 7, the `bindFix` cap and the notes. They are applied in this text.

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
bindFix(fix: Fix, inputs: Record<string, string>): SpecPatch | null   // the engine's patch with inputs
                                       // placed; null if an input is over 2,048 characters (ADR 0004)
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
properties only. Reads use `Object.hasOwn` or a `Map`; writes use `Object.defineProperty` or a
`Map`, never assignment with a tenant key. A `__proto__` segment is a conflict. `constructor` and
`prototype` are ordinary names. A test resolves and patches through all three and asserts
`Object.prototype` is unchanged. This binds the `$ref` resolver, `applyFixes` (ADR 0004), the
model's indexes by operation id, schema name and parameter name, and request building. In the
resolver a `$ref` with a `__proto__` segment does not resolve and is reported as `ref-unresolved`.
A schema or property named `constructor` or `prototype` resolves like any other. The engine runs
in a process shared between tenants, so a write to `Object.prototype` would cross tenants.

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
| Fetch external `$ref` targets: loop `listExternalRefs` -> fetch -> `parseDocument` until the set is closed or a cap is reached | Caller, under the spec fetch policy below |
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

## Outbound requests

The engine requests nothing, so the three policies below are enforced by its callers. They are
written here because the fetch loop is defined here and the proxy builds its destinations from the
engine's model. "Address vetting" is shared. "Spec fetch policy" and "Proxy destination policy"
each use it and differ in everything else: one fetches documents and sends no credential, the
other sends an end user's credential and follows nothing.

### Address vetting

Applied to every outbound connection that either policy makes, including each redirect hop of a
spec fetch.

- Resolve the host, then reject any address that is not global unicast, including NAT64 and 6to4
  forms of a blocked IPv4 address.
- The test is "is this address global unicast", not a list of bad ranges. It therefore rejects, at
  least: loopback, RFC 1918, 169.254/16, 100.64/10, 0.0.0.0, multicast, broadcast and reserved
  IPv4 ranges; IPv6 loopback, the unspecified address, ULA, link-local and multicast; and
  v4-mapped addresses. For a NAT64 address (`64:ff9b::/96`) and a 6to4 address (`2002::/16`) the
  IPv4 address inside is taken out and must itself be global unicast.
- A host written as an IP literal is vetted the same way.
- Connect to the vetted address. The connection goes to the address that was checked, not to a
  second lookup of the name.

### Spec fetch policy

Covers the root spec URL and every `$ref`.

- `https` only; `file:` only in the local CLI and only under the root's directory; no userinfo.
- Address vetting, as above, on the first request and on every redirect hop.
- Redirects are re-vetted per hop, maximum 3.
- No credentials or cookies are sent. Tokens for private spec URLs and Git sync are not covered
  by this policy; they need their own reviewed path before either is built.
- Caps: 100 documents, 10 MB each, 50 MB total, 10 s each, 60 s total. Bytes are counted after
  content decoding, so a compressed response is measured as the document it decodes to, and
  decoding stops at the cap.
- Uploaded specs get a synthetic URI. A relative `$ref` in an uploaded spec resolves only against
  other files of the same upload, by lookup; it is never fetched. The lookup is by the synthetic
  URI in the set of uploaded files; a target that is not in the set is a missing document. An
  absolute `https` `$ref` in an uploaded spec is fetched under this policy like any other.

A URL the policy refuses, and a document past a cap, is not fetched. The document is then missing
from the closed set and `buildModel` reports the reference as a finding. The loop stops at the
first cap it reaches, so a server that answers every request with a fresh `$ref` ends it at 100
documents or 60 seconds. The content of a refused URL never reaches a portal.

### Proxy destination policy

Covers every request the M2 proxy sends, for "Try it" and for MCP `call` (guides contract 4.3).
These are requirements on M2's design.

- The portal sends none of its own credentials or cookies. The end user's credential is sent only
  to a destination built from the model's servers. The proxy does not follow redirects; a 3xx is
  returned to the caller.
- The destination is built from the model's servers and nothing else. Server variables are limited
  as contract 4.3 says: a value from the `enum`, or, with no `enum`, a value valid for the
  variable's position, and a variable that forms or follows the last label of the host needs an
  `enum` or a tenant-listed set, or the server is not callable. The substituted URL is then parsed
  and vetted: `https` only, no userinfo, and address vetting as above.
- `https` only, with no exception for development servers. A server that is `http://`, localhost
  or relative is not callable. Plain `http` would put the user's key on the wire in clear, and the
  hosted proxy cannot reach localhost under address vetting in any case. For such a server the
  code samples still render; "Try it" and MCP are withheld and the spec doctor reports
  `server-not-callable` (ADR 0004). A mode in which the reader's browser calls localhost directly
  is a separate design and needs its own security review.
- The final method and path must match an operation the tenant enabled. The controlled-header
  list of contract 4.3 applies, and the proxy strips every `X-Ezdp-` header from inbound requests.
- MCP `call` rejects a parameter the operation does not declare. The proxy and MCP input shape
  excludes `templates` and rejects it (ADR 0005).
- The document caps above are about fetching specs and do not apply here. M2 sets its own limits
  on request and response size, counted after content decoding.
- The end user's credential is passed through for that one request and is never stored or logged.

## Consequences

- The same engine build runs in the publisher, in M2's proxy and MCP, and in the browser.
- The caller's fetch loop is the single place where tenant-supplied URLs are requested for a
  publish. SSRF controls live there, outside the engine, and are address vetting and the spec
  fetch policy above. The proxy is the second place that makes outbound requests, under the proxy
  destination policy.
- Functions that returned a bare value now return it with findings, so a truncated result is never
  mistaken for a complete one.
- Per-page bundle files let the M4 multi-tenant renderer load one small file per request instead of
  the whole model.

## Alternative rejected

`@apidevtools/json-schema-ref-parser` (MIT) or `@scalar/openapi-parser` (MIT) for parsing and
dereferencing. Both resolve references by doing file and HTTP I/O themselves or need it stubbed
out, neither keeps the line and column positions the spec doctor requires, and full dereferencing
is the representation ADR 0002 rejects. What remains to write ourselves is small.
