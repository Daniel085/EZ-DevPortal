# ADR 0003: The engine's public interface and the no-I/O rule

Status: accepted, 2026-11-26. Milestone: M1. Revised the same day to apply the security design
review (`docs/reviews/2026-11-26-security-design-review.md`, H4, M6, M7). The re-review
(`docs/reviews/2026-11-26-security-design-re-review.md`) passed it subject to required fixes: R1,
R2, rulings 2, 3, 4 and 7, the `bindFix` cap and the notes. They are applied in this text.
Revised 2026-11-27 for the product decision that guides are generated from the patched spec: "The
published spec" is added and `buildModel` takes two hashes. No security ruling is changed.
Revised again that day for the product decision on allowed hosts (ADR 0004): the tenant-listed
set is the variable's `enum` after the spec doctor's fix.
Revised again that day to apply the security review of the allowed-hosts fix and the published
spec (`docs/reviews/2026-11-27-security-review-allowed-hosts-and-published-spec.md`): the host
clause (F1), the parsed-host invariant (ruling 5), the Public Suffix List as an input to
`diagnose`, and who may fetch the published spec.

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
//    root and documents are the patched ones when an overlay exists (ADR 0004). The hashes are
//    copied into model.source (ADR 0002).
buildModel(input: { root: ParsedDocument; documents: ParsedDocument[];
                    fetchedHash?: string; publishedHash?: string })
  : { model: ApiModel | null; findings: Finding[] }

// 4. Spec doctor (ADR 0004).
diagnose(model: ApiModel, docs: ParsedDocument[],
         options: { publicSuffixes: PublicSuffixList | null }): Finding[]   // null: no list, so every
                                       // host variable needs an enum (ADR 0004)
parsePublicSuffixList(text: string): PublicSuffixList   // pure; the caller reads the file
bindFix(fix: Fix, inputs: Record<string, string>): SpecPatch | null   // the engine's patch with inputs
                                       // placed; null if an input is over 2,048 characters or fails
                                       // its format or list rules (ADR 0004)
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
| Read or fetch the spec, compute its SHA-256 (`fetchedHash`) | Caller (`publisher`) |
| Write the published spec and compute its SHA-256 (`publishedHash`); see "The published spec" | Caller (`publisher`) |
| Read the Public Suffix List snapshot and pass its text to the engine (ADR 0004) | Caller (`publisher`; in M2 also the proxy) |
| Parse each allowed-host value with the WHATWG `URL` parser when a fix is accepted (ADR 0004) | Caller. `URL` does not compile in the engine (ADR 0001 rule 4). |
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

### The published spec

Guides are generated from the patched spec, not the tenant's original (guides contract 1.2). The
patched spec is therefore an output of publishing, with bytes the guides module can fetch and
hash.

- The publisher writes it on every publish, beside the portal bundle: `spec/openapi.json` when the
  first non-whitespace character of the text is `{`, otherwise `spec/openapi.yaml`. It is not one
  of the `PortalBundle` files, because `buildPortalBundle` sees the model and not the documents.
- Bytes: if `applyFixes` applied no patch to the root document (no overlay, or every patch for the
  root conflicted), the file is the root document's bytes exactly as fetched, and
  `serializeDocument` is not called, because re-serializing YAML does not reproduce its input
  byte for byte. Otherwise the file is `serializeDocument(patched root)` encoded as UTF-8 with no
  byte order mark.
- `publishedHash` is the SHA-256 of the file's bytes. The publisher computes it before `buildModel`
  and passes it in with `fetchedHash`, so it is in `model.json` and the bundle validator can
  compare it with a guides bundle's `spec.sha256` without doing I/O.
- `serializeDocument` is deterministic: the same parsed document and patches give the same text. A
  golden test pins its output for patched fixtures. A change to that output, including one caused
  by upgrading `yaml`, changes `publishedHash` for unchanged input on the next publish and marks
  every tenant's guides `spec-hash-mismatch`, so it is treated as a breaking change of the engine.
- Only the root document is published and hashed. Referenced documents are not, and a spec split
  over several files keeps its `$ref`s as written. Publishing the patched referenced documents is
  an open item in contract section 8 and does not block M1.
- The file is tenant content. It is served as a file with `X-Content-Type-Options: nosniff` and is
  never inlined into a page. It holds everything in the root document, including YAML comments and
  vendor extensions the reference pages do not show.

**Who can read it.** Required by the security review of 2026-11-27.

- *No stripping.* The publisher never removes comments, `x-` fields or anything else from the
  file. Stripping would break the byte-for-byte rule above, and with it `spec.sha256`, and it
  would give false assurance: no filter can know what a tenant considers private.
- *M1, the `ezdp` CLI.* The file is written into the static output directory by default, and
  whoever deploys that directory makes it public. So on every build that writes it the CLI
  prints that the file is public and holds the whole root document, including comments and `x-`
  fields. A flag, `--no-published-spec`, omits the file. With the flag the publisher still
  computes `publishedHash` from the bytes it would have written, so `model.json` is the same with
  and without it, and the person running the build hands the spec to the guides module another
  way.
- *Hosted, recorded now and built in M4.* Public download of the published spec is the tenant's
  explicit choice and is off by default. The guides module fetches it over an authenticated
  path. If any feature hides part of the spec from the portal, the public file is not served.
  The authenticated path is designed with transport in M5 (guides contract 6) and goes to the
  security reviewer first.
- *Origin and headers, hosted.* The hosted portal serves it only from the per-tenant asset
  origin, never the page origin, with `Content-Type` fixed by the file name (`application/json`
  or `application/yaml`, `charset=utf-8`), `nosniff`, `Content-Disposition: attachment`,
  `Content-Security-Policy: default-src 'none'; sandbox`, and no CORS headers. This matches the
  product brief's rule that JSON is served from the per-tenant asset origin, and under subpath
  hosting headers cannot be
  guaranteed through the customer's reverse proxy.
- *Static export.* The file sits beside the pages, and the host must send `nosniff` with it.
  The export cannot set headers itself; the CLI's message says so.

To check at M4, before the hosted portal serves either file:

- `model.json` already carries `extensions` (ADR 0002). If it is publicly fetchable, `x-` fields
  are exposed whatever is decided for the published spec.
- External `$ref` URLs stay as written in the published file and may reveal internal hostnames.

Libraries:

- **The Public Suffix List is data, not a library**, and it is passed to the engine, not shipped
  in it. Its licence, MPL 2.0, is outside ADR 0001 rule 5, and the exception is an open decision
  for the user (ADR 0004).
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
  variable's position. An empty `enum` allows no value. With no `enum`, a variable in the host is
  callable only if: (a) its value matches `[A-Za-z0-9_-]{1,63}` and the label it sits in is at
  most 63 characters; (b) that label is followed by `.` and then literal text to the end of the
  host, with no variable in it; (c) that literal text is not an IP address and is not a public
  suffix under the Public Suffix List, ICANN and private sections, so it contains a registrable
  domain. Any other host variable needs an `enum`, or the server is not callable. The list is a
  pinned snapshot shipped as data (ADR 0004, "The Public Suffix List"). The proxy asks the
  engine, with the same snapshot the publisher used, and does not re-implement the clause.
- The substituted URL is then parsed and vetted: `https` only, no userinfo, and address vetting
  as above. After substitution, the parsed host must equal the host built by position,
  lower-cased; otherwise the request is not sent. The engine returns the host it built by
  position with the URL (ADR 0005); the proxy parses the URL and compares. This holds for every
  server that has a variable, whether a value came from an `enum` or passed a position rule. It
  stops an `enum` value containing `/`, `?`, `#`, `\` or `:` from moving a boundary that the
  position rules for other variables rely on. A spec-authored `enum` is not syntax-checked, so
  this is the check that covers it.
- The allowed values of a host variable that needs an `enum` are the `enum` the tenant adds by
  accepting the spec doctor's fix (ADR 0004; decided 2026-11-27), or one written in the source
  spec. It is in the published spec and so in the model, and the proxy reads it there like any
  `enum`. There is no other set. A listed value is tenant input and is exempt from nothing: the
  substituted URL is parsed and vetted on every request. A verified domain suffix is planned for
  M6 and needs its own security review first (ADR 0004).
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

Also rejected, for the published spec: bundle the root and every referenced document into one
file. It would cover fixes in referenced documents, but it needs a `$ref`-rewriting bundler, and
it changes the bytes of a spec that has no fixes, so the tenant's own document would no longer
hash to `spec.sha256`.
