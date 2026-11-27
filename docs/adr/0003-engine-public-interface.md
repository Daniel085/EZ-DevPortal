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
Revised again that day for two decisions by the user: the Public Suffix List licence exception
is granted (ADR 0001 rule 5, ADR 0004), and the MCP's `call` tool is split into a read tool and
a write tool ("MCP tools: reads and writes").
Revised again that day for four more decisions by the user: the bundle is one unit and its paths
are relative to the unit's base ("One unit per call"); the portal runs the guides module and
passes it the published spec, so no fetch path is built (ADR 0007); a private preview serves
nothing without sign-in ("Who can read it"); and "Reader keys". No security ruling is changed.
The private-preview wording, the reader-key requirements and ADR 0007 have not been to the
security reviewer.
Revised again that day for the user's decision that "Try it" in a private preview shows the
spec's example response and sends nothing, and that the MCP is off there (now "Live calls and
example-response mode"). It adds one rule for M1's page files. Not yet seen by the security
reviewer.
Revised again that day for two further decisions by the user, which replace part of the last
one: a private preview makes live "Try it" calls where the server's host is verified, and a host
the tenant cannot verify by DNS gets no live calls at launch. "Live calls and example-response
mode" now holds the one rule for when the console is live, and "Host verification: to be
designed in M4b" lists what M4b must design. Not yet seen by the security reviewer.

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

**Declared examples stay apart from synthesized values. This binds M1.** An operation's page
file carries each response as the model has it: by status, then by media type, each with its
declared `examples` (name, value) in authored order, and the examples of the media type's
schema. A value the engine synthesized is never written among them. If a page shows a
synthesized value anywhere, it is in a field of its own that says so. M2's example-response
mode ("Live calls and example-response mode") reads declared examples from the page file
in the browser and must be able to tell the two apart without the network.
| `search.json` | flat search records (id, kind, title, path, text). Not a library-specific index. |
| `static/<path>.md`, `static/llms.txt` | Markdown twins and `llms.txt` |

**One unit per call.** `buildModel` takes one spec and `buildPortalBundle` takes one model: one
version of one API, the unit of ADR 0002. A portal with several APIs or versions is several
bundles, composed by the control plane and the renderer and keyed by (project, API, version).
The engine does not see the key. These rules bind M1, so that nothing is redone when M4 adds a
second unit:

- Every `path` in the bundle, and every path in `manifest.json` and `search.json`, is relative
  to the **unit's base**: no leading `/`, no scheme or host, and no project, API or version
  segment. In M1 the unit's base is the portal root; from M4 it is below it. The engine never
  bakes in a base path, so subpath hosting (`host.com/docs`) and the unit's prefix are the
  renderer's concern alone.
- A link that the engine writes inside a file under `static/`, in a twin or in `llms.txt`, is
  relative to the file that contains it, so the files work wherever the unit is mounted. If
  `siteUrl` is given, absolute URLs are built from it, and it is the unit's base URL, not the
  portal's.
- `static/llms.txt`, `search.json`, the navigation tree and `model.json` cover one unit. A
  portal-wide `llms.txt` or search over several units is composed outside the engine, in M4.
- The published spec is per unit: `spec/openapi.json` or `spec/openapi.yaml` beside that unit's
  bundle.
- Ids and slugs are unique within the unit only (ADR 0002).

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
patched spec is therefore an output of publishing, with bytes the guides module is given and
hashes.

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
  explicit choice and is off by default. If any feature hides part of the spec from the portal,
  the public file is not served. The guides module does not fetch the file: the control plane
  runs the module and passes it the bytes (decided 2026-11-27; ADR 0007; guides contract 6). The
  authenticated path this ADR planned is therefore not built.
- *Private preview.* Decided 2026-11-27: a portal is a free private preview until the tenant
  makes it public, which needs a plan and proof of domain control. The product brief calls that
  step "publishing". In this ADR and in the contract, "publish" and "published spec" name the
  publisher's run and its output, not public availability: a private preview has a published
  spec, because its pages and its guides are built from one. While a portal is a private preview
  nothing of it is served to anyone who is not signed in as a member of the tenant's account:
  pages, twins, `llms.txt`, `search.json`, `model.json`, the published spec and files on the
  asset origin. The MCP endpoint is off for everyone, members included. Whether "Try it" makes
  a live call there or runs in example-response mode is decided by one rule ("Live calls and
  example-response mode"). Public download of the published spec
  cannot be switched on in that state. The asset origin is not the dashboard's origin, so a member's session does not
  reach it by itself; how a request to it is authorized in a private preview is designed in M4
  and goes to the security reviewer first. The M1 CLI is unaffected: a static build has no
  private state, which is why it prints its warning.
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
  in it. Its licence is MPL 2.0. The user granted a one-file exception to ADR 0001 rule 5 for it
  on 2026-11-27 (ADR 0004).
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
  by this policy; they need their own reviewed path before either is built. The same holds for
  the GitHub App that proposes guides as pull requests (decided 2026-11-27; ADR 0007): it holds
  write access to tenants' repositories, and its design goes to the security reviewer before it
  starts.
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

Covers every request the M2 proxy sends, for "Try it" and for the MCP's two call tools (guides
contract 4.3; "MCP tools: reads and writes" below).
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
  M4b and needs its own security review first (ADR 0004).
- From M4b the destination host must also be verified for the tenant ("Host verification: to
  be designed in M4b"). Meeting this policy is necessary for a request to be sent and is not
  the whole test: "Live calls and example-response mode" states when the proxy accepts one.
- `https` only, with no exception for development servers. A server that is `http://`, localhost
  or relative is not callable. Plain `http` would put the user's key on the wire in clear, and the
  hosted proxy cannot reach localhost under address vetting in any case. For such a server the
  code samples still render; live calls are withheld ("Live calls and example-response mode")
  and the spec doctor reports `server-not-callable` (ADR 0004). A mode in which the reader's browser calls localhost directly
  is a separate design and needs its own security review.
- The final method and path must match an operation the tenant enabled. The controlled-header
  list of contract 4.3 applies, and the proxy strips every `X-Ezdp-` header from inbound requests.
- Both MCP call tools reject a parameter the operation does not declare. The proxy and MCP input
  shape excludes `templates` and rejects it (ADR 0005).
- The document caps above are about fetching specs and do not apply here. M2 sets its own limits
  on request and response size, counted after content decoding.
- The end user's credential is passed through for that one request and is never stored or logged.

### MCP tools: reads and writes

Decided by the user on 2026-11-27. These are requirements on M2's design; nothing here is built
in M1.

- The MCP exposes four meta-tools, not one per endpoint: find operations, describe an operation,
  call a read operation, call a write operation. They are called `find`, `describe`, `call_read`
  and `call_write` here; M2 fixes the names. The two call tools replace the single `call` tool
  of the earlier design, so that any MCP client can apply its ordinary per-tool approval to
  writes only.
- **Classification.** Each operation belongs to exactly one call tool. The server decides which,
  from the published model, by `Operation.method` (ADR 0002): `get` and `head` are reads; every
  other method is a write, which covers `post`, `put`, `patch`, `delete`, `options` and `trace`.
  The read set is an allowlist of the two methods an agent reads with. `options` and `trace` are
  safe methods in RFC 9110, but an agent has little use for either, and a wrong "write" costs
  one approval where a wrong "read" skips one. The caller supplies no method: `CallValues` has
  none (ADR 0005), so nothing in a request can change the classification.
- **A tenant override, toward write only.** Some APIs change state on `GET`. A tenant must be
  able to mark a read operation as a write. No override moves an operation from write to read:
  the stored form can only name operations to treat as writes and has no value that means
  "read", so missing or damaged override data leaves the method rule in force. Where it is
  stored is an M2/M4 design question. An operation marked this way is a write in every respect
  below.
- **The wrong tool.** A call to a tool the operation does not belong to is refused before any
  request is built or sent, and the result names the tool to use. `describe` says which tool
  calls an operation and, for a write, whether the tenant has enabled it.
- **Writes are off by default.** The tenant enables them per operation, and the server enforces
  that from the published model and the tenant's settings. `call_write` refuses a write the
  tenant has not enabled. The client's approval is added to the tenant's enablement and does
  not replace it. Neither rule is enforced on the client: tool annotations (read-only,
  destructive) are set to match and are hints only.
- Both call tools go through the proxy and meet the whole destination policy above. The
  controlled-header list of contract 4.3 applies to both: `X-HTTP-Method-Override`,
  `X-HTTP-Method`, `X-Method-Override` and the rest are refused, so a read cannot become a write
  on the wire. Both reject a parameter the operation does not declare, and both reject
  `templates`.
- The input of both call tools is an operation id and `CallValues` (ADR 0005). Tool names are
  under 60 characters, and tool input schemas contain no `$ref`, `oneOf`, `anyOf` or `allOf`.
  `CallValues` can be written that way: its keys are fixed, and parameter values and `body` are
  unconstrained JSON.
- There is one classification. Wherever the portal distinguishes writes, including which
  operations a tenant must enable, it uses this one.

### Reader keys

Decided by the user on 2026-11-27. Requirements on M2's design; nothing here is built in M1, and
the security reviewer has not seen it.

- We never issue keys. The reader's key comes from the tenant's own system.
- In M2 the tenant supplies a "get a key" URL as a setting. The portal renders it as a link of
  its own, beside the control a reader pastes a key into and in the reference's authentication
  section (guides contract 9). It is tenant-supplied text: it passes the external link checks of
  contract 4.5 and is rendered as a link, never as markup. It is a setting, not part of the spec
  or the model, so the engine does not see it and `model.json` is the same with and without it.
- The reader pastes a key into "Try it". It is held in the reader's browser only and sent with
  each request the reader makes; the proxy passes it through for that one request and never
  stores or logs it, as the destination policy above says. Nothing of it is in published
  content. Where in the browser it is held is for M2 and the security reviewer: under subpath
  hosting the page shares an origin with the customer's site, so anything kept in web storage is
  readable by that site's scripts.
- Later, a sign-in handoff may pass the reader's key from the tenant's site. It is not designed,
  it must keep "never stored or logged by us", and it needs its own security review.

### Live calls and example-response mode

Decided by the user on 2026-11-27, in three decisions. The first put "Try it" in a private
preview into example-response mode. The other two, the same day, settle when a preview makes
live calls and what happens to a host the tenant cannot verify by DNS; they replace this
section's earlier wording on both points. Requirements on M2's design (the console and the
proxy) and on M4's (the private preview in M4a, host verification in M4b); the first paragraph
under `PortalBundle` above is the only part that binds M1. The security reviewer has not seen
it.

**When the console is live.** This is the one rule. Every other section and document points
here and does not restate it. For an operation and the server the reader selected, "Try it"
sends a request, and the proxy accepts it, only when all of these hold:

1. *The server is callable.* It is `https` and has no `server-not-callable` finding ("Proxy
   destination policy"; ADR 0004).
2. *The host is verified.* The destination host is verified for that tenant ("Host
   verification" below).
3. *The caller may call.* The portal is public; or it is a private preview and the caller is
   signed in as a member of that tenant's account.
4. *The request passes every other rule of the proxy.* The destination is built from the
   model's servers, the address is vetted, the controlled-header list applies, the operation is
   enabled and a write is enabled per operation, and the request is within the rate limits.

Otherwise the console is in example-response mode and makes no request: in place of a live
response it shows an example the spec declares. That is the same in a private preview and in a
public portal, and the same whatever fails under 1 to 3: a host that is not verified, a host
the tenant cannot verify, `http`, localhost, or any other `server-not-callable`. Conditions 1 to
3 are known before the reader runs anything and set the console's mode. Condition 4 is checked
by the proxy on each request; a request that fails it is refused and shown as refused, and no
example stands in for it.

- **One meaning of "withheld".** Where this or another document says "Try it" is withheld for
  a server, it means live calls are withheld and the console is in this mode.
- **To be confirmed with the user: the mode in a public portal.** In a private preview the
  mode is decided. For a public portal this ADR follows the decision as it was relayed on
  2026-11-27, that the console stays in the mode. The product brief records the other reading
  as its default, that on a public portal the console is absent with a reason, and lists the
  point for the user. Scope is the product manager's. Nothing above about when a request is
  sent depends on the answer: it changes only whether a public console that is not live shows
  an example or is not shown, and M2 builds the mode either way.
- **The MCP.** In a private preview the MCP endpoint is off for everyone, members included,
  whatever is verified. The user confirmed this on 2026-11-27. In a public portal the
  MCP's two call tools are withheld for a server that fails condition 1 or 2.
- **A plan.** A plan is needed to make a portal public. It is not needed for live calls in a
  private preview.
- **Rate limits.** Live calls from a private preview are rate-limited. That is a requirement;
  the values, and what they are counted by, are an M4 design question.
- **Sequence.** The private preview is built in M4a and host verification in M4b. In M4a no
  host can be verified, so condition 2 fails for every server: every preview console is in
  example-response mode and the proxy accepts no request for a preview. Live calls in a preview
  begin with M4b, and so does the proxy's authentication of a member.
- **The proxy authenticates a member, for a preview only. New, and for the security
  reviewer.** Condition 3 means the proxy must know that the caller of a preview request is a
  member of that tenant, which nothing before this required. It implies that the proxy can
  check either the tenant's dashboard session or a short-lived token bound to the tenant and
  the member; that this credential is ours, so it is never forwarded to the API (the first
  rule of the destination policy); and that it is asked for only where the portal is a private
  preview. A public portal's readers remain anonymous to the proxy. Which of the two it is, how
  it reaches the proxy's origin and how long it lives are not designed here. M4b designs them
  with the security reviewer.

- **No request.** Running the console in this mode makes no network request: none to the proxy,
  none to the API, none to fetch an example. Everything it shows is already in the page file.
  The request the reader built is shown as it would be sent, from the same `HttpRequest` as the
  sample (ADR 0005), and is not sent.
- **Enforced on the server, not by the page.** The mode is not what keeps a call from being
  made. The proxy decides conditions 1 to 4 on every request, server-side, from the published
  model, the tenant's state and its own authentication of the caller, and from nothing the
  page says about its mode. A page altered to leave the mode reaches a refusal. The MCP
  endpoint does not answer for a private preview.
- **Only declared examples.** The response shown comes from the published model's declared
  examples and from nowhere else: `Response.content[].examples`, and the `examples` of that
  media type's schema (ADR 0002). An example that an accepted spec-doctor fix wrote is in the
  published spec and counts as declared.
- **Nothing synthesized is shown as a response.** `synthesizeExample` output, a value assembled
  from the examples, defaults or enums of a schema's properties, and an `externalValue` are
  never shown in the response's place, under any label. Where the spec declares no example for
  the response, the console says that the spec gives none and shows the response's status,
  description and schema, as the reference page does. A response with no `content` is shown as
  having no body, which is what the spec declares.
- **Which example, when there are several.** One rule, deterministic, implemented once in the
  engine as a pure projection and used by the console, by the reference page and by the guides
  `<Response>` component (contract 4.2), so all three show the same one:
  1. *Status.* The console opens on the first response, in the model's order (exact codes
     ascending, then ranges, then `default`), whose status is an exact code from `200` to `299`;
     if there is none, `2XX`; then `default`; then the first response. The reader may pick any
     other declared response. An example is never borrowed from another status.
  2. *Media type.* Take the response's media types in this order: `application/json`; then
     those whose subtype ends in `+json`, in authored order; then the rest, in authored order
     (the sample media type rule of contract 4.3, applied to the response). Use the first that
     has an example under step 3.
  3. *Example.* The first entry of the media type's `examples`, in authored order, that has a
     `value`. If there is none, the first entry of the `examples` of the media type's schema,
     following a reference to the named schema it points at. Nothing else.
  The reader may switch to another declared example of the same response by name. The default
  is always the one this rule gives.
- **The label is part of the result.** The result states, in the portal's own fixed text, that
  it is an example from the spec and not a response from the API, and that it does not reflect
  the values entered. The label is rendered inside the result, in the same element as the body,
  and is carried into anything copied or exported from it. No theme token can hide, reorder or
  reword it: tokens are data (ADR 0006), none addresses the label, and it takes the same text
  and surface colours as the body it labels, so a theme cannot make it less legible than the
  example itself. No tenant text replaces it: an example's `summary` is shown beside it as text. The status is
  shown as the status the example is for. No timing, size or received headers are shown,
  because nothing was received.
- **Credentials go nowhere.** A credential typed in this mode is used only to show the request
  that would be sent. It is not sent to the proxy, the API or us, and is not logged. Where it
  is held in the browser is the same M2 question as under "Reader keys", with the same answer.
- **Nothing is captured.** A guides `capture` (contract 4.3) reads a real response. An example
  is not one, so the name stays unfilled as if the sample had not been run.
- **Where the console is absent.** The mode replaces only the sending, and only for reasons
  that belong to the server or the caller. `tryIt="false"`, an operation the tenant has not
  enabled, and an operation that requires a controlled header (ADR 0004) belong to the sample
  or the operation: there is no console for them, in either mode, in a preview or a public
  portal.
- **The prompt.** In the mode the console says, in the portal's own fixed text, why it is not
  live. A prompt to verify the domain is shown only to a signed-in member and only for a
  callable server whose host is not verified, so it never promises a live call that
  verification cannot give.
- **Static export is unaffected.** The pages are the same files in both modes. Which mode the
  console runs in for a server is a value the console is given, not a different page, and it is
  not in the model or the page files: verification and preview state are the tenant's state,
  which the engine never sees. How the console of a public portal is given it is an M4b design
  point ("Host verification"). Whatever the console is told, the proxy decides. The M1 CLI has
  no private state and no console.

### Host verification: to be designed in M4b

No ADR yet defines "a verified host" or "under a verified domain". The product brief states
the rule: proof of domain control before a portal is public, live calls only to server hosts
under a domain the tenant has verified, and hosts listed by the allowed-hosts fix bound like
any other. It leaves the design to the architect and the security reviewer. Nothing is designed
here. The M4b design starts from this list and goes to the security reviewer before anything is
built:

- *Verification methods.* A DNS record is the one method at launch. Open: the record, the name
  it sits at, the token, and what binds it to one tenant.
- *What "under a domain" means, given the Public Suffix List.* Which names a tenant may verify
  (never a public suffix, ICANN or private section); whether verifying a name covers every host
  under it or that host alone; how this meets the host clause of the destination policy and the
  verified domain suffix planned in ADR 0004.
- *Re-checking.* How often, what a failed check does, when verification lapses, and what a
  lapse does to a public portal and to live calls.
- *Shared-hosting hosts.* Domains where strangers are given hosts and which are not on the
  Public Suffix List (the residual risk ADR 0004 records), and a cloud provider's host names.
- *Where enforcement sits.* The proxy, on every request, from the tenant's state. Open: how an
  unverified server is reported to the tenant, since `diagnose` is pure and does not know the
  tenant's state; how the console is given its mode; two tenants that verify the same name.
- *Authenticating a member at the proxy* for a private preview (the section above).

**Decided 2026-11-27: a host the tenant cannot verify by DNS**, such as a cloud provider's host
name. At launch the tenant is advised to put the API on a domain it controls. Otherwise there
are no live calls for that server: the console stays in example-response mode and the MCP's
call tools are withheld for it. Samples render as for any server.

**Deferred, not designed: an exact-host HTTP challenge** as a second verification method. It
waits until customers ask for it and needs its own security review before it is designed. The
constraints already known: it verifies one exact host and never a suffix; the token is served
at a fixed path at the root of that host; redirects are not followed; the check repeats, and
verification lapses when it fails; a host where strangers can publish at arbitrary paths is
refused.

**Rejected by the user: manual approval by us** of a host the tenant cannot verify.

Alternative rejected: show a value generated from the schema under a distinct label such as
"generated from the schema". The user's decision is that the console does not invent a
response, and a generated body beside a real status reads as the API's behaviour whatever the
label says.

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
