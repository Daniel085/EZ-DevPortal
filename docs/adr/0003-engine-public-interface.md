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
Revised again that day to close gaps a readiness audit found: `defaultLimits` has values and the
local CLI's document cap differs from the fetch cap ("Budgets", "Spec fetch policy"); the bundle's
files, page types and URL scheme are defined ("The portal bundle"); the schema validator is M1
work and tenant `pattern`s are never executed ("Schema validation"); `buildPortalBundle` takes
the doctor's findings; the thresholds of criterion 23 are confirmed ("Performance"). The raised
cap, the new `Limits` fields and the `pattern` decision go to the security reviewer.
Revised again that day to close gaps a second audit found: "Tenant Markdown" says how a
description is written so that no twin or page holds live HTML, and the engine gains a Markdown
parser; "The M1 command line" defines `ezdp`; `selectResponseExample` and `checkFixInputs` are
named; `parseDocument` takes the file's size; "Build order in M1" is added. "Tenant Markdown",
its two fixed bounds and the new dependency go to the security reviewer.
Revised 2026-11-28 for three decisions by the user. The doctor report is private by default: it
is built into a report directory outside the export, `ezdp build` prints where, and
`--public-report` includes it deliberately ("The doctor report is private", "The portal bundle",
"The M1 command line"). `example-missing` offers no fix (ADR 0004), so `diagnose` no longer
synthesizes values. The fetch cap per document is 16 MiB, the same as the local cap ("Spec fetch
policy"); that changes a figure the security reviewer set and is to be confirmed when M4 is
designed. The first and the third go to the security reviewer.

## Context

The engine must be a pure library: no network, filesystem, database or clock. Specs still have to
be fetched, external `$ref`s resolved and output written. Diagnostics need line and column, and
spec-doctor fixes patch the spec, so the parser must keep source positions.

## Decision

All engine functions are **synchronous** and take and return plain data. They never throw on bad
tenant input; they return findings (ADR 0004). They throw only on programmer error. Which
findings stop a build is in ADR 0004, "Fatal and degrading faults".

```ts
// Budgets. Every field is required. The engine exports `defaultLimits` (values under "Budgets")
// and clamps each field it is given to that default, so a caller can only lower them.
interface Limits {
  inputBytes: number; depth: number; nodes: number; aliasExpansions: number;   // parsing, per document
  outputNodes: number; outputBytes: number;                                    // derived work, per value
  pageSchemas: number; pageBytes: number; bundleBytes: number;                 // buildPortalBundle
}

// 1. Parse one document. YAML or JSON. Keeps a source map (pointer -> line/column range).
//    Opaque apart from these two fields. A parse fault is in `findings`, never thrown.
interface ParsedDocument { readonly uri: string; readonly findings: Finding[] }
parseDocument(input: { uri: string; text: string;
                       bytes?: number },   // the file's true size, when the caller knows it
              limits: Limits): ParsedDocument

// 2. Which other documents does this one reference? Absolute URIs, resolved against doc.uri.
listExternalRefs(doc: ParsedDocument): string[]

// 3. Build the model from a closed set of documents. Missing documents become findings.
//    root and documents are the patched ones when an overlay exists (ADR 0004). The hashes are
//    copied into model.source (ADR 0002). `findings` includes the documents' own parse findings.
//    `model` is null exactly when a finding has severity 'error' (ADR 0004).
buildModel(input: { root: ParsedDocument; documents: ParsedDocument[];
                    fetchedHash?: string; publishedHash?: string })
  : { model: ApiModel | null; findings: Finding[] }

// 4. Spec doctor (ADR 0004).
diagnose(model: ApiModel, docs: ParsedDocument[],
         options: { publicSuffixes: PublicSuffixList | null;   // null: no list, so every host
                    limits: Limits }): Finding[]               // variable needs an enum (ADR 0004)
parsePublicSuffixList(text: string): PublicSuffixList   // pure; the caller reads the file. The
                                       // result is opaque.
checkFixInputs(fix: Fix, inputs: Record<string, string>): FixInputIssue[]   // [] means usable (ADR 0004)
bindFix(fix: Fix, inputs: Record<string, string>): SpecPatch | null   // the engine's patch with inputs
                                       // placed; null exactly when checkFixInputs returns an issue:
                                       // an input missing, unknown, over 2,048 characters, or
                                       // failing its format or list rules (ADR 0004)
applyFixes(docs: ParsedDocument[], patches: SpecPatch[]): { docs: ParsedDocument[]; conflicts: PatchConflict[] }
serializeDocument(doc: ParsedDocument): string

// 5. Requests and samples (ADR 0005).
buildRequest(model, operationId, values: RequestValues | undefined, options: { limits: Limits })
  : { request: HttpRequest; values: SampleValue[]; issues: Finding[] }   // values: where each
                                       // filled-in value came from ("The portal bundle")
renderSample(request: HttpRequest, language: SampleLanguage): Sample

// 6. Projections of the model. All but the first two are bounded; see "Budgets" below.
getOperation(model, id) / getSchema(model, id)
resolveSchemaView(model, schema, limits: Limits): { node: SchemaNode; findings: Finding[] }   // allOf merged
toJsonSchema(model, schema, { refs: 'keep' | 'inline'; maxDepth: number }, limits: Limits)
  : { schema: Json; findings: Finding[] }                             // for the M2 MCP; not built in M1
synthesizeExample(model, schema, limits: Limits): { value: Json; findings: Finding[] }       // deterministic
validateValue(model, schema: Schema, value: Json, limits: Limits): ValueCheck   // "Schema validation"
selectResponseExample(model, operationId: string, status?: string): ResponseExample | null
                                       // "Which example, when there are several"; built in M1

// 6a. Tenant Markdown ("Tenant Markdown"). All four are pure and take no limits.
parseMarkdown(text: string): MarkdownRoot                 // the one parser configuration; mdast `Root`
sanitizeMarkdown(text: Markdown): { text: Markdown; fallback: boolean }   // the safe form
escapeMarkdownText(text: string): string                  // any string as inert Markdown text, one line
linkDestinationAllowed(destination: string): boolean

// 7. Everything the renderer needs, as data. `report` is what the doctor page shows: every
//    finding the caller holds so far (from buildModel and diagnose) and the fixes not applied.
//    The returned findings are only the ones this call adds; the doctor page shows both.
buildPortalBundle(model: ApiModel,
                  report: { findings: Finding[]; notApplied: NotAppliedFix[] },
                  options: { languages: SampleLanguage[]; siteUrl?: string; limits: Limits })
  : { bundle: PortalBundle; findings: Finding[] }
```

**Budgets.** `synthesizeExample`, `toJsonSchema`, `resolveSchemaView`, `validateValue` and
`buildPortalBundle` take node and byte budgets from `Limits`; `maxDepth` is required; over budget
yields a finding and truncated output. The finding is `budget-exceeded`, a warning, located at the schema or operation
being expanded. Cutting recursion on the second visit to a schema is not a bound: twelve acyclic
schemas with ten properties each, every one referring to the next, expand to 10^12 nodes. The
budget counts nodes and bytes produced, so it bounds that case too. `buildRequest` passes its
`limits` to the example synthesis it does. The budget for `buildPortalBundle` covers the whole
bundle, and each page's share of it is bounded as well.

`defaultLimits`. A byte figure is counted as string length in UTF-16 code units, which the engine
can measure without an encoder and which is never more than the UTF-8 byte count; the caller
checks the true size of a file before it decodes it. The caller does not make the finding. It
passes the size as `bytes`, and `parseDocument` reports `limit-exceeded` without parsing when
`bytes`, or the text's length, is over `inputBytes`. A caller that sees from the size on disk
that a file is over the cap passes `text: ''` with `bytes` and never reads the file. So the
engine is the one emitter of `limit-exceeded`, as of every finding. "Largest fixture" was
measured on `fixtures/specs/` on 2026-11-27.

| Field | Default | What is counted | Largest fixture |
|---|---|---|---|
| `inputBytes` | 16,777,216 (16 MiB) | The document's text | 14,401,584 bytes (`large/github-api-3.1.json`) |
| `depth` | 64 | Nesting of maps and sequences | 27 (`large/stripe.json`) |
| `nodes` | 500,000 | Every map, sequence and scalar value; keys are not counted; a subtree reached through an alias is counted each time | 279,102 (`large/github-api-3.1.json`) |
| `aliasExpansions` | 1,000 | Alias nodes in the document | 2 (`openai.yaml`) |
| `outputNodes` | 10,000 | Per value: JSON values in one synthesized example; schema nodes in one view or one `toJsonSchema` result; keyword evaluations in one `validateValue` call | Estimate |
| `outputBytes` | 1,048,576 (1 MiB) | The serialized JSON of that one value or view | Estimate: the largest inline schema, `GET /emojis` in the GitHub fixtures, is 166 KB as written |
| `pageSchemas` | 32 | Named schemas inlined in one page file ("The portal bundle") | Not a truncation; see below |
| `pageBytes` | 2,097,152 (2 MiB) | One file under `pages/`, one twin, or `report/doctor.json` | Estimate |
| `bundleBytes` | 536,870,912 (512 MiB) | The sum of all files' `content` | Estimate |

- `synthesizeExample` and `validateValue` also nest no deeper than `depth`.
- Past a parsing limit, parsing stops and the document has a `limit-exceeded` finding; for the
  root document that is fatal (ADR 0004). Past a derived budget, the value is cut and the finding
  is `budget-exceeded`.
- The twelve-schema case under these values: its synthesized example is cut at 10,000 nodes; a
  page file holds each of the twelve named schemas once, because a reference stays a reference
  (see `SchemaSection`); and the renderer never expands a reference while rendering (ADR 0006,
  rule 7). A test builds that spec and asserts the bundle is under 1 MB.
- The four parsing values are set from measurement. The five derived values are estimates, because
  no code exists. A test asserts that no fixture, committed or fetched, yields `limit-exceeded`
  or `budget-exceeded`. If one does, the value is changed in this table, not in code, and the
  change is shown to the security reviewer. `pageSchemas` is tuned downward only, on Stripe.

**Lookups keyed by tenant text.** Pointer traversal and every lookup keyed by tenant text use own
properties only. Reads use `Object.hasOwn` or a `Map`; writes use `Object.defineProperty` or a
`Map`, never assignment with a tenant key. A `__proto__` segment is a conflict. `constructor` and
`prototype` are ordinary names. A test resolves and patches through all three and asserts
`Object.prototype` is unchanged. This binds the `$ref` resolver, `applyFixes` (ADR 0004), the
model's indexes by operation id, schema name and parameter name, and request building. In the
resolver a `$ref` with a `__proto__` segment does not resolve and is reported as `ref-unresolved`.
A schema or property named `constructor` or `prototype` resolves like any other. The engine runs
in a process shared between tenants, so a write to `Object.prototype` would cross tenants.

### The portal bundle

`PortalBundle` is a list of files as data. JSON files are written with object keys in the order
the types declare them, so the same model gives the same bytes.

```ts
interface PortalBundle { bundleVersion: 1; files: BundleFile[] }   // sorted by path, by code point
interface BundleFile { path: string; mediaType: string; content: string }
```

| Path | Type | Content |
|---|---|---|
| `manifest.json` | `Manifest` | Versions, navigation, the index of pages |
| `model.json` | `ApiModel` | The full model, for the proxy and MCP in M2. The M1 renderer does not read or export it. |
| `pages/<page path>.json` | `PageData` | One public page. Everything that page shows is in this one file. |
| `static/<page path>.md` | Markdown | The twin of an operation, tag or schema page |
| `static/llms.txt` | Markdown | The index of twins for this unit |
| `report/doctor.json` | `DoctorPage` | The doctor page. Private. |
| `report/doctor-report.json` | `DoctorReport` | The machine-readable doctor report, complete. Private. |

The first path segment says who may read a file. `pages/` and `static/` are public: they become
the export. `report/` is private and never reaches the export unless the person running the
build asks ("The doctor report is private"). `manifest.json` and `model.json` are build inputs.

`search.json` is not a bundle file in M1: m1.md puts search of any kind in M5. Its shape is
fixed now so M5 adds a file and changes none: `SearchRecord[]`, flat records, not a
library-specific index.

**Pages and paths.** A page path is relative to the unit's base and is built from slugs (ADR
0002), never from ids. These are all the pages M1 has. Webhooks and callbacks get none (ADR 0004,
`webhook-not-rendered`). The first four are the public pages. The doctor page is private: its
page file is `report/doctor.json`, it is in neither `Manifest.pages` nor `Manifest.nav`, and
its page path is used only where the report is built or included.

| Kind | Page path | One per | Twin |
|---|---|---|---|
| `home` | `index` | unit | No. `llms.txt` is the agent's entry point. |
| `tag` | `tags/<Tag.slug>` | `model.tags` entry | Yes |
| `operation` | `operations/<Operation.slug>` | `model.operations` entry | Yes |
| `schema` | `schemas/<NamedSchema.slug>` | `model.schemas` entry | Yes |
| `doctor` | `doctor` | unit | No. Private; not in `llms.txt`. |

**Fragments.** Each is fixed text of ours plus a status or a slug, so none is raw tenant text.

| Content | Fragment |
|---|---|
| Sections of an operation page | `parameters`, `request-body`, `responses`, `security`, `samples` |
| One response on an operation page | `response-` + the status in lower case: `response-200`, `response-4xx`, `response-default` |
| A named schema shown on an operation or schema page | `schema-` + `NamedSchema.slug` |

**Stability (criterion 11).** A page path depends only on its own slug and a fragment only on a
status or a slug, so rebuilding an unchanged spec gives the same URLs. Adding an operation
changes an existing URL in one case only: the new operation takes the id or the slug an existing
one had, under the collision rules of contract 1.1 and ADR 0002. Both are reported
(`operation-id-collision`, `slug-collision`). Those two operations are not "unrelated" in
criterion 11's sense.

**Types.** `Operation`, `Parameter`, `Response`, `Server`, `SecurityScheme`, `SchemaNode` and
`Markdown` are the model's (ADR 0002); `Sample` and `SampleLanguage` are ADR 0005's; `Finding` is
ADR 0004's. Where a page file holds a model type, every inline `SchemaNode` in it, at any depth,
is the merged view `resolveSchemaView` returns, so no `allOf` is left; a `SchemaRef` stays a
reference.

```ts
type PageKind = 'home' | 'tag' | 'operation' | 'schema' | 'doctor';

interface Manifest {
  bundleVersion: 1; modelVersion: 1;
  title: string; version: string;      // info.title and info.version, for display
  languages: SampleLanguage[];         // as passed to buildPortalBundle; the first is the default
  nav: NavGroup[];                     // one per Tag in model order, then one of kind 'schemas' if any
  pages: PageRef[];                    // every public page, sorted by path; never the doctor page
}
interface NavGroup { kind: 'tag' | 'schemas'; title: string; page?: string; items: NavItem[] }
interface NavItem { title: string; page: string; method?: Operation['method']; deprecated: boolean }
interface PageRef { path: string; kind: PageKind; title: string; description: string }

type PageData = HomePage | TagPage | OperationPage | SchemaPage;   // the files under `pages/`
interface PageBase { path: string; title: string; truncated: boolean }

interface HomePage extends PageBase { kind: 'home';
  info: ApiModel['info']; servers: Server[]; securitySchemes: SecurityScheme[];
  externalDocs?: ApiModel['externalDocs'];
  tags: { title: string; page: string; description?: Markdown; operations: number }[] }

interface TagPage extends PageBase { kind: 'tag'; name: string; description?: Markdown;
  operations: OperationSummary[] }
interface OperationSummary { id: string; page: string; method: Operation['method']; path: string;
  title: string; deprecated: boolean }

interface OperationPage extends PageBase { kind: 'operation';
  operation: Pick<Operation, 'id' | 'idSource' | 'method' | 'path' | 'summary' | 'description'
                           | 'deprecated' | 'servers' | 'externalDocs'>;
  tags: { title: string; page: string }[];
  parameters: Parameter[];                    // name, type, required, default, enum, constraints
  requestBody?: Operation['requestBody'];
  responses: Response[];                      // every one, in model order: codes, ranges, 'default'
  security: SecurityStatement;
  samples: Sample[];                          // one per manifest language, in that order
  sampleValues: SampleValue[];
  schemas: SchemaSection[]; schemaLinks: SchemaLink[] }

interface SchemaPage extends PageBase { kind: 'schema'; schema: SchemaSection;
  schemas: SchemaSection[]; schemaLinks: SchemaLink[] }

interface SchemaSection { id: string; slug: string; recursive: boolean;
  node: SchemaNode }                          // the named schema's merged view
interface SchemaLink { schemaId: string; slug: string;
  onPage: boolean }                           // true: '#schema-<slug>'. false: page 'schemas/<slug>'

interface SecurityStatement {                 // criterion 4
  alternatives: CredentialUse[][] }           // outer OR, inner AND, in model order. []: the spec
                                              // declares no credential for this operation. An empty
                                              // inner list: calling with no credential is allowed.
interface CredentialUse { schemeId: string;
  type: SecurityScheme['type'] | 'undefined'; // 'undefined': the spec does not define the scheme
  in?: 'header' | 'query' | 'cookie'; name?: string;   // the exact name: 'X-API-Key', 'Authorization'
  prefix?: string;                            // 'Bearer ', 'Basic ', with its space
  scopes: string[] }

interface SampleValue {                       // criterion 7
  in: 'path' | 'query' | 'header' | 'cookie' | 'body'; name: string;   // '' for the body
  origin: 'example' | 'default' | 'enum' | 'synthesized';
  unchecked: string[] }                       // for a synthesized value: keywords of its schema that
                                              // were not checked, such as 'pattern'

interface DoctorPage extends PageBase { kind: 'doctor';      // `report/doctor.json`; path 'doctor'
  counts: { warning: number; info: number };  // of the whole report, also when `truncated`
  findings: Finding[]; notApplied: NotAppliedFix[];
  synthesized: { operationId: string; page: string; values: SampleValue[] }[] }
interface DoctorReport { reportVersion: 1; findings: Finding[]; notApplied: NotAppliedFix[];
  synthesized: DoctorPage['synthesized'] }
interface NotAppliedFix { fixId: string; path: string; reason: PatchConflict['reason'] }   // ADR 0004

interface SearchRecord { id: string; kind: PageKind; title: string; path: string; text: string }   // M5
```

No `PageRef`, `NavItem` or `SearchRecord` is ever of kind `doctor` or names the doctor page.

Rules, each one sentence a builder would otherwise have to guess:

- **Titles.** An operation's title is its `summary`, else the method in upper case, a space and
  the path. A schema's is its id, a tag's its name, the home page's `info.title`.
  `PageRef.description` is the first line of the item's description source, with white space
  collapsed and cut at 200 characters; empty if there is none. It is plain text, not Markdown:
  the renderer shows it as text, and `llms.txt` writes it through `escapeMarkdownText`.
- **Navigation.** A tag group lists the tag's operations in `Tag.operationIds` order; an
  operation with several tags is in each group and has one page. The `schemas` group lists the
  schema pages in model order.
- **Named schemas on a page.** `schemas` holds named schemas the page's content refers to,
  nearest first: those referred to directly, then those they refer to, breadth-first, ties in
  order of first reference, each once, until there are `pageSchemas` of them. `schemaLinks` has
  one entry for every schema id referred to anywhere in the file, saying whether it is on the
  page. Stripe is why there is a bound and why schema pages exist: every Stripe operation reaches
  about 1,060 named schemas (1.2 MB as written), while no GitHub operation reaches more than 62.
- **The security statement** is computed by the code that places credentials in `buildRequest`
  (ADR 0005), so a page and its samples cannot disagree. `apiKey`: `in` and `name` from the
  scheme, no prefix. `http` `bearer`, `oauth2` and `openIdConnect`: header `Authorization`,
  prefix `Bearer `. `http` `basic`: header `Authorization`, prefix `Basic `. Any other `http`
  scheme: header `Authorization`, and the scheme as written plus a space. `mutualTLS` and
  `undefined`: no `in`, `name` or `prefix`. `bearer` and `basic` are matched without regard to
  ASCII case. For `basic` the statement also says, in fixed text of ours, that the value after
  the prefix is the Base64 of `username:password`; how a request carries it is ADR 0005, "Basic
  authentication".
- **Variant names (criterion 1).** A `oneOf` or `anyOf` member that is a reference is named by
  the target's `title`, else its id; an inline member by its `title`, else `Option` and its
  1-based position. Twins and HTML both use this.
- **`allOf` merging.** Members are merged in order: `properties` by name, a property in several
  members being merged the same way; `required` is the union; for any other keyword that
  members give different values, the first is kept and `schema-allof-conflict`, an info, is
  reported.
- **Samples.** `samples` are `renderSample` of one `buildRequest(model, id, undefined, { limits })`, and
  `sampleValues` is that call's `values`. The only synthesized values in any page file are
  inside `samples`, and `sampleValues` identifies each. A value's `origin` is `example`,
  `default` or `enum` only when the whole value was taken unchanged from that place in the spec;
  a body assembled from parts is `synthesized`.
- **The doctor page and report.** `findings` is `report.findings` followed by the findings this
  call adds, sorted by severity (warning before info), then `location.uri`, `location.pointer`,
  `code` and `fingerprint`, by code point. `synthesized` lists each operation that has a
  `synthesized` sample value, with those values only. The report file is complete; the page
  holds the findings that fit in `pageBytes`, in that order. Both are under `report/` and are
  private ("The doctor report is private"). No file under `pages/` or `static/` holds a
  `Finding`, a fix or a link to either of them.
- **Over `pageBytes`.** The page is reduced in this order until it fits, `truncated` is set and
  `budget-exceeded` is reported: drop `schemas` entries from the end (they become links); drop
  the `value` of declared examples from the last to the first; drop `samples` code. Reaching
  `pageSchemas` is not truncation and is not reported. Past `bundleBytes`, no further page is
  written, and the pages left out are named in one `budget-exceeded` finding.

**Twins and `llms.txt` (criterion 17).** A twin is built from its page file and nothing else.

- An operation's twin, in this order: `# ` title; the method and path in a code span; the
  description; `## Security`, the statement in fixed sentences of ours; `## Parameters`;
  `## Request body`; `## Responses` with one `### ` per status; `## Example request`, the cURL
  sample in a fenced block, whatever `languages` holds; `## Schemas`, one `### ` per entry of
  `schemas`. A schema is written as a nested list: name, type, required, default, every enum
  value, constraints, description. A schema that is not on the page is a link to its twin.
- A tag's twin lists its operations as links to their twins. A schema's twin is the `## Schemas`
  part alone.
- A description is written in its safe form, the `Markdown` string of the page file, which
  `sanitizeMarkdown` produced ("Tenant Markdown"). It is never the text as authored. Inside a
  list item, every line of it after the first is indented to the item's content column. Every
  other tenant string is written in a code span or fenced block whose fence is longer than any
  run of backticks inside it, or through `escapeMarkdownText`. There is no HTML of ours and no
  navigation.
- `llms.txt`: `# ` and `info.title`; `> ` and `info.summary` if there is one; `## Tags`, a list
  of the tag twins; then one `## ` per tag listing its operations, each operation under its
  first tag only; then `## Schemas`. Each entry is `- [title](link): description`, so every twin
  is listed exactly once. The doctor page and `doctor-report.json` are never listed, also when
  `--public-report` puts them in the export.
- Links are relative to the file that holds them: `operations/get-pet.md` from `llms.txt`,
  `../schemas/pet.md` from an operation's twin.

**Declared examples stay apart from synthesized values. This binds M1.** An operation's page
file carries each response as the model has it: by status, then by media type, each with its
declared `examples` (name, value) in authored order, and the examples of the media type's
schema. A value the engine synthesized is never written among them. If a page shows a
synthesized value anywhere, it is in a field of its own that says so. M2's example-response
mode ("Live calls and example-response mode") reads declared examples from the page file
in the browser and must be able to tell the two apart without the network.

**One unit per call.** `buildModel` takes one spec and `buildPortalBundle` takes one model: one
version of one API, the unit of ADR 0002. A portal with several APIs or versions is several
bundles, composed by the control plane and the renderer and keyed by (project, API, version).
The engine does not see the key. These rules bind M1, so that nothing is redone when M4 adds a
second unit:

- Every `path` in the bundle, and every path in `manifest.json`, in a page file and in
  `search.json`, is relative to the **unit's base**: no leading `/`, no scheme or host, and no
  project, API or version segment. The unit's base is the base path followed by the unit
  prefix. Both are settings of the build in M1, empty by default (ADR 0006, "Units"), so an M1
  export can already sit below the portal root (criterion 21). The engine never bakes in
  either, so subpath hosting (`host.com/docs`) and the unit's prefix are the renderer's concern
  alone.
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
| Fetch external `$ref` targets: loop `listExternalRefs` -> fetch -> `parseDocument` until the set is closed or a cap is reached | Caller, under the spec fetch policy below. Not in M1: the CLI reads one file. |
| Decide that a build fails, and write nothing when it does (ADR 0004, "Fatal and degrading faults") | Caller (`publisher`) |
| Write bundle files | Caller |
| Timestamps, UUIDs, any randomness | Caller passes them in, or they are left out |
| Bound the time a publish may take | Caller. The engine has no clock. |

Publishing runs in a killable per-tenant worker with a time limit. The engine's budgets bound the
size of what it produces; they cannot bound time, because the engine cannot read a clock. The
worker is the control for that, and for anything a budget misses. One tenant's publish must not
share a worker with another tenant's.

Enforcement: ADR 0001 rule 4 (restricted `lib`, no Node types, lint bans), no `async` in the public
interface, and a test that builds the same fixture twice and compares bytes.

### Tenant Markdown

Decided 2026-11-27, after the second audit. No twin may contain HTML and hostile spec text must
be inert in pages and twins (criteria 17 and 19), so a description is never copied as written.
The engine rewrites it once into a **safe form**, and the page and the twin are both made from
that one string.

- **One parser, owned by the engine.** `parseMarkdown` is `mdast-util-from-markdown` with four
  GFM extensions (tables, task lists, strikethrough, footnotes) and without autolink literals.
  The renderer parses with this function and has no Markdown parser of its own (ADR 0006), so
  the tree the engine checked is the tree the renderer gets.
- **The safe form** is Markdown whose parse by `parseMarkdown` has no `html` node, no `image`
  or `imageReference`, no `definition` or `linkReference`, and no `link` whose destination
  fails `linkDestinationAllowed`. `sanitizeMarkdown` reaches it by rewriting the source text at
  each node's range:

  | Construct in the source | Written as |
  |---|---|
  | Raw HTML, block or inline: a tag, a comment, `<script>`, a processing instruction, a declaration, CDATA | The same characters with each `<` written `&lt;`. It shows as the text that was typed. |
  | An autolink, `<https://…>` or `<name@example.com>` (a `link` whose source begins with `<`) | Its `<` written `&lt;`. Text, not a link. A bare URL was never a link. |
  | An inline link whose destination is allowed | Unchanged |
  | A reference link whose definition's destination is allowed | The inline form, `[text](destination)`, with `(` and `)` in the destination written `%28` and `%29`. The title is dropped. |
  | A link of either form whose destination is refused: `javascript:`, `data:`, `http:`, any other scheme, a relative or absolute path | Its link text alone. The destination and the title are dropped. |
  | An image of either form, whatever its source | `escapeMarkdownText` of its alt text. Never an image, so no remote host is contacted. The source is dropped. |
  | A link reference definition | Removed, so a description's meaning never depends on text outside it |
  | Anything else, including code spans, code blocks and `{{…}}` | Unchanged. A `<` inside code is already text. |

- **Repeat until nothing is found.** A rewrite can expose a new construct: text that was
  inside an HTML block becomes Markdown, and a code fence can move. So `sanitizeMarkdown`
  parses, rewrites and parses again until a parse finds nothing to rewrite. The last parse is
  the proof that the result is the safe form.
- **Fallback.** Three cases are not rewritten: text longer than 65,536 code units, which is
  not parsed; a tree nested deeper than 32, counted as contract 4.1 counts it; and text that
  still needs a rewrite after 8 passes. Each is returned as one fenced code block holding the
  text as authored, with a fence longer than any run of backticks in it, and `fallback: true`.
  `buildPortalBundle` then reports `markdown-not-rendered`, an info, at the item. The bounds are
  fixed and are not `Limits` fields, so the page and the twin agree whatever limits a caller
  passes.
- **Closed.** If the result ends inside a fenced code block that has no closing fence, one is
  appended, so a description cannot swallow what follows it in a twin.
- **`linkDestinationAllowed`** takes the destination as CommonMark yields it, after escapes and
  character references. Three forms pass. (1) `https:`: it matches the regex of contract 4.5,
  has no `\`, and the last label of its host is not a number (digits only, or `0x` and hex
  digits, as in ADR 0004's clause (c)), which is the one form that regex admits and a URL
  parser rewrites. (2) `mailto:`: it matches
  `^mailto:[A-Za-z0-9._%+-]+@[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$`. (3) An in-page anchor:
  `^#[A-Za-z0-9_-]{1,120}$`. The engine has no `URL`; the renderer also parses an `https:`
  target and shows one it refuses as text (ADR 0006).
- **`escapeMarkdownText`** is for a tenant string that is not Markdown and is not put in code:
  a title, a summary, a name, an image's alt text. Line ends and tabs become one space and the
  ends are trimmed. A backslash is put before each of `` \ ` * _ [ ] < > & ~ | ``, and, at the
  start of the string only, before `#`, `+`, `-` or `=`, and before the `.` or `)` that
  follows leading digits.
- **Where it is applied.** `buildPortalBundle` puts the safe form in every `Markdown` field of
  every page file, and a twin copies the field from its page file. `model.json` keeps the text
  as authored: `Markdown` in the model stays untrusted (ADR 0002), and an M2 consumer of the
  model calls `sanitizeMarkdown` or shows the text as text.
- **Speed.** A text with no `<`, no `[` and no run of three backticks or tildes is already in
  the safe form and need not be parsed. Results may be remembered per distinct text within one
  `buildPortalBundle` call.
- **Tests.** For every fixture and QA's hostile-content fixture: each twin, parsed by
  `parseMarkdown`, has no `html`, `image`, `imageReference` or `definition` node, and each
  `link` in it either is one the engine wrote to another twin or passes
  `linkDestinationAllowed`; `sanitizeMarkdown` of a safe form returns it unchanged; and a test
  in the portal, where `URL` exists, asserts that the renderer keeps every link the engine
  kept in the fixtures.
- **Known difference.** Footnote labels are kept as written. A twin that holds two
  descriptions using the same label shows the first definition for both; the page parses each
  description by itself.

Alternatives rejected. A small scanner of our own that escapes `<` outside code: it has to
find code spans and blocks exactly as CommonMark does, and where it is wrong a live tag
remains. Escaping every `<`, code included: sound without a parser, but `` `List<Pet>` `` would
show a backslash. Carrying the description in the page file as a syntax tree, not text: it
removes the renderer's parse, but it is a larger change to the page types than M1 should take
now, and page files grow.

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

### The doctor report is private

Decided by the user on 2026-11-28. The doctor report lists a spec's defects. It is for the
buyer, not the reader, so it is not part of the public output unless the person running the
build asks for it. This replaces the earlier position that the doctor report and page are in
the public static export. It goes to the security reviewer in that item's place.

- **What is private.** The two files under the bundle's `report/`: the doctor page and
  `doctor-report.json`. Nothing else holds a `Finding` or a fix.
- **The report directory.** Every build that succeeds writes both to a report directory outside
  the export directory: the page as HTML, built by the renderer, and the JSON file. Its place
  is fixed: the `--out` path with any trailing separator removed, plus `.ezdp-report`
  (`--out site` gives `site.ezdp-report`). `--report-dir <dir>` names another place. Its
  layout is the export's, so a file server that serves it at the base path shows the page.
  `U` is the unit prefix, and is nothing when the prefix is empty:

  | File in the report directory | Content |
  |---|---|
  | `U/doctor-report.json` | The `DoctorReport`, complete |
  | `U/doctor/index.html`, and whatever else the Next.js build writes for that page | The doctor page |
  | `_next/…` | A copy of the app's build assets, so the page has its styles and scripts |

- **The command says where it is.** `ezdp build` prints the report line on every build that
  succeeds ("The M1 command line", "The report line"). `ezdp doctor` remains the way to see
  findings without building; it writes nothing.
- **Including it on purpose.** `--public-report` also puts `U/doctor/` and
  `U/doctor-report.json` in the export, at the URLs of ADR 0006, "Where each file is". The
  report directory is still written, and the command prints to standard error that the
  export now holds the list of the spec's defects.
- **No public page links to it**, with or without `--public-report`: no navigation entry, no
  link on the home page or any other page, no line in `llms.txt`, no twin. With
  `--public-report` the page is reached by its URL. Without the option nothing in the export
  shows that a report exists. A link from the portal when the report is included is not
  designed; it would make the public pages depend on the option.
- **The doctor page's own links.** It links to `doctor-report.json` and to the operation pages
  in `synthesized`. The second kind resolves only where the report is served together with
  the export, which is what `--public-report` gives.
- **Reader-facing facts stay on the public pages they concern.** An operation page still says
  plainly that the spec declares no credential (`SecurityStatement` with no alternatives,
  criterion 4), shows a response with no declared example as having none, and carries
  `sampleValues`. These are page content that `buildPortalBundle` derives from the model.
  They are not findings, they are not taken from the doctor report, and they do not depend on
  whether the report is included.
- **A test.** A fixture with findings is built with and without `--public-report`. Without
  it, no file in `--out` contains the `fingerprint` of any finding in the report, `--out` has
  neither `U/doctor/` nor `U/doctor-report.json`, and both exist in the report directory.
  With it, both are in `--out` too, and no other file in `--out` links to them or contains a
  fingerprint.
- **Hosted, recorded now and built in M4.** The portal origin and the asset origin never serve
  a file from `report/`. The dashboard shows the report to signed-in members of the tenant's
  account. Publishing it is not offered until it has been designed and reviewed.
- **What the default does not protect.** The report directory is a sibling of `--out`. A person
  who deploys the directory that holds both publishes the report. The CLI cannot see that;
  `--report-dir` is how the report is put elsewhere.

### The M1 command line

`ezdp` is the publisher's binary (ADR 0001). `<spec>` is one local file. M1 has these commands
and no others.

| Command | What it does |
|---|---|
| `ezdp build <spec> --out <dir>` | The full build of criterion 23: the engine pass, the bundle, the static export, the published spec and the report directory. Prints the report line. |
| `ezdp doctor <spec>` | The engine pass up to `diagnose`. Prints each finding with its fix ids and their inputs; `--json` prints the `Finding[]`. Writes nothing. It shows the findings of `buildModel` and `diagnose`; those only `buildPortalBundle` adds (ADR 0004, "By" B) are in a build's report. |
| `ezdp fix accept <spec> <fix-id>` | Stores one accepted fix in the overlay file (ADR 0004, "The overlay file") |
| `ezdp fix accept <spec> --all` | Stores the first fix of every finding that has one |
| `ezdp fix remove <spec> <fix-id>` | Removes that entry from the overlay file |

| Option | On | Meaning |
|---|---|---|
| `--out <dir>` | `build`, required | The export directory. Replaced as a whole when the build succeeds; untouched when it fails. |
| `--overlay <file>` | all | The overlay file. Default: the spec's path plus `.ezdp-overlay.json`, used if it exists. A file named here that does not exist is an error, except for `fix accept`, which creates it. |
| `--base-path <path>` | `build` | Where the portal is mounted. Default: empty (ADR 0006, "Units"). |
| `--unit-prefix <path>` | `build` | Where this unit sits below the base path. Default: empty. |
| `--no-published-spec` | `build` | Omits `spec/` from the export ("Who can read it") |
| `--report-dir <dir>` | `build` | The report directory ("The doctor report is private"). Default: the `--out` path plus `.ezdp-report`. Replaced as a whole when the build succeeds; untouched when it fails. |
| `--public-report` | `build` | Also puts the doctor page and `doctor-report.json` in the export. Without it the export holds neither. |
| `--bundle-dir <dir>` | `build` | Also keeps the bundle files there, `model.json` and `report/` included, so it is private too. Without it they are in a temporary directory that is removed. |
| `--portal-dir <dir>` | `build` | The portal app. Default: `apps/portal` under the workspace root, found by walking up from the CLI's own file to `pnpm-workspace.yaml`. |
| `--input <name>=<value>` | `fix accept <fix-id>` | One input. Repeating a name joins the values with LF in the order given, which is how a `list` input is written. |
| `--inputs <file>` | `fix accept` | JSON: `{ "<fix-id>": { "<name>": "<value>" } }`. The way to supply inputs with `--all`. |

`ezdp build`, in order. The dependency rule of ADR 0001 holds: the publisher imports only the
engine and starts the portal as a process.

0. Check the options. The report directory, `--out` and `--bundle-dir` are compared as
   absolute paths: if the report directory is `--out`, is inside it or contains it, if `--bundle-dir`
   is `--out` or inside it, or if a path holds a control character, the command exits 2 and
   writes nothing.
1. Check the file's size, read it, read the overlay. The root document's `uri` is the file's
   base name (`petstore.yaml`), never a path, so reports, `model.json` and overlay files are
   the same on every machine (criterion 20). `fetchedHash` is the SHA-256 of the file's bytes.
2. The engine pass: `parseDocument`, `applyFixes`, the published spec's bytes and
   `publishedHash` in memory, `buildModel`, `diagnose` with the vendored Public Suffix List,
   `buildPortalBundle` with all eight languages in the order of `SampleLanguage` and no
   `siteUrl`. On a fatal finding: print the findings, write nothing, exit 1.
3. Write the bundle files to a temporary directory outside `--out`, or to `--bundle-dir`.
4. Run the portal's export command as a child process (ADR 0006, "The export command"), giving
   it the bundle directory, an empty export directory and an empty report directory, both
   temporary and beside the bundle, the base path and the unit prefix. It writes the public
   pages, the build assets and everything under `static/` to the first, and the doctor page
   and `doctor-report.json` to the second. The export directory it returns holds no doctor
   file.
5. Unless `--no-published-spec`, write the published spec into that export directory at
   `<unit prefix>/spec/openapi.json` or `.yaml`. The publisher does this, not the portal: the
   file is not a bundle file and the portal never reads it.
6. With `--public-report`, copy `<unit prefix>/doctor/` and
   `<unit prefix>/doctor-report.json` from the temporary report directory into the export
   directory at the same paths.
7. Replace `--out` with the export directory and the report directory with the temporary one,
   print the notices and the report line, exit 0.

- **Exit codes.** 0: built. 1: a fatal finding in the spec (criterion 5). 2: anything else,
  such as a bad option, an unreadable file, a malformed overlay, a refused input or a failed
  export. Nothing in `--out` or in the report directory changes unless the exit code is 0.
- **Findings are printed** one per line to standard error: severity, code, `uri:line:column`,
  the JSON pointer, the message. The published-spec notice and the `--public-report` notice
  go to standard error too.
- **The report line.** On exit code 0, `ezdp build` writes exactly one line to standard output
  and nothing else there:

  ```
  ezdp: report <visibility> warnings=<n> info=<n> path=<file>
  ```

  `<visibility>` is `private`, or `public` with `--public-report`. The two counts are
  `DoctorPage.counts`, in decimal. `<file>` is the absolute path of `doctor-report.json` in
  the report directory; it is the last field and runs to the end of the line, so it may hold
  spaces. The doctor page is `doctor/index.html` beside that file. Fields are separated by one
  space and the line ends with LF. For example:
  `ezdp: report private warnings=3 info=12 path=/work/site.ezdp-report/doctor-report.json`.
  On any other exit code no report is written and the line is not printed; the findings are
  on standard error.
- **`fix accept`.** Run the engine pass with the current overlay; look the fix up by id in its
  findings; call `checkFixInputs` and, on any issue, print it, store nothing and exit 2; call
  `bindFix`; for each input whose `format` is `host-name` or `host-suffix`, make the URL check
  of ADR 0004 on every value and store nothing if one fails (criterion 31); append the entry
  and write the file. With `--all`, a fix whose inputs are not all in `--inputs` is skipped and
  printed with the names of the inputs it needs; its finding stays (criterion 10).
- **Not in M1:** a server, a watch mode, a strict-mode flag (`publicSuffixes: null` is tested
  through the engine), `siteUrl`, and any command that dismisses a finding.

Rejected: a top-level package that depends on both `publisher` and `portal` and holds the
command. The portal is an app, not a library, so the dependency would only be a way to find a
directory, and it would break "nothing depends on `portal`" for a process launch. The hosted
pipeline in M4 publishes without a Next.js build and must not inherit one.

Libraries:

- **The Public Suffix List is data, not a library**, and it is passed to the engine, not shipped
  in it. Its licence is MPL 2.0. The user granted a one-file exception to ADR 0001 rule 5 for it
  on 2026-11-27 (ADR 0004).
- **`yaml`** (ISC, no dependencies) parses YAML and JSON and exposes node ranges, which gives the
  source map, and it can re-serialize a patched document with comments kept. `Limits` caps alias expansion, depth, node count and input size while parsing,
  and nodes and bytes produced by derived work.
- **`mdast-util-from-markdown`** and four GFM extension pairs (all MIT) parse tenant Markdown.
  It is the engine's second runtime dependency; the licence line and the reason are in ADR
  0001, rule 5, and the use is "Tenant Markdown". It is in a module of its own and the package
  is marked free of side effects, so a browser bundle that imports only the request code does
  not carry it.
- **`$ref` resolution is our own code**: JSON Pointer lookup across the supplied documents, by own
  properties only, a few hundred lines. See the alternative below.
- **No schema validator dependency.** Values are checked against a schema by `validateValue`,
  which interprets the engine's own normalized schema. It is M1 work; see "Schema validation".
  Ajv is ruled out because it compiles schemas to JavaScript, which is tenant content compiled
  to code.

### Schema validation

M1 needs it twice: the doctor reports a declared example that violates its schema (criterion 6),
and every synthesized value is checked against its schema (criterion 7). M2 and M5 reuse it.

```ts
interface ValueCheck {
  errors: ValueIssue[];      // a keyword the value violates. Valid means: none.
  unchecked: ValueIssue[];   // a keyword that applies and was not evaluated
  truncated: boolean;        // the budget ran out; the result is incomplete
}
interface ValueIssue { pointer: string;      // into the value, RFC 6901
                       keyword: string; schema: Loc }   // the schema node that holds the keyword
```

- **Checked in M1**, with 3.1 semantics on the normalized `SchemaNode` (ADR 0002): `types`,
  `enum`, `const`, `properties` and `required`, `additionalProperties`, `items`, `prefixItems`,
  `allOf`, `oneOf`, `anyOf`, `not`, a `SchemaRef` and its `nullable`, `minimum`, `maximum`,
  `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`, `minLength` and `maxLength` in code
  points, `minItems`, `maxItems`, `uniqueItems`, `minProperties`, `maxProperties`. That is every
  validation keyword in the fixtures except `pattern`, `patternProperties` and those the model
  does not hold, all three covered below.
- **`format`** is checked for a closed list, each by a hand-written check of ours that runs in
  time linear in the value: `date`, `date-time`, `email`, `uri`, `uuid`, `hostname`, `ipv4`,
  `int32`, `int64`. `synthesizeExample` writes a value of the right form for each of them. Any
  other format is `unchecked`, and its synthesized value is a plain string.
- **`pattern` and `patternProperties` are never executed in M1.** The engine does not compile a
  regular expression from tenant text anywhere: no `new RegExp` and no `RegExp(...)` with an
  argument that is not a literal of ours, by a lint rule on `packages/engine` and a test. A
  JavaScript regular expression has no time bound, and the engine has no clock to stop one. A
  value's conformance to `pattern` is reported as `unchecked`, never as valid or invalid. Where
  a schema has `patternProperties`, a property not named in `properties` is `unchecked` too,
  and so is `additionalProperties` for it. A bounded matcher is not designed; if a later
  milestone needs one it goes to the security reviewer first. This settles the question the
  first review left open, and the security reviewer confirms it at the code gate.
- **Keywords the model does not hold** are not evaluated, and a value is never rejected because
  of one. For the assertion keywords of JSON Schema 2020-12 that ADR 0002 leaves out (`if`,
  `then`, `else`, `contains`, `minContains`, `maxContains`, `propertyNames`, `dependentRequired`,
  `dependentSchemas`, `unevaluatedProperties`, `unevaluatedItems`, `additionalItems`),
  `buildModel` reports `schema-keyword-ignored`, an info, at the keyword. Any other unknown key
  is ignored without a finding; an `x-` key goes to `extensions`. `discriminator` is not an
  assertion: the `oneOf` or `anyOf` beside it decides.
- **Three results, not two.** A schema with an unchecked keyword and no violated one is
  "unknown". `oneOf`, `anyOf` and `not` combine pass, fail and unknown by Kleene logic, and an
  unknown outcome is reported in `unchecked`, not in `errors`. So a pattern that was not run
  never makes a valid example look invalid.
- **Bounds.** Each keyword evaluation counts against `outputNodes`; nesting stops at `depth`;
  a pair of schema id and value pointer already on the stack is unknown. Past any of them
  `truncated` is true.
- **Use in M1.** `diagnose` reports `example-invalid`, a warning, for a declared example of a
  parameter, a media type or a schema that has `errors` (ADR 0004). `synthesizeExample` checks
  its own result: with `errors`, it still returns the value and reports `synthesis-failed`, a
  warning, at the schema, since some schemas admit no value. The `unchecked` keywords of a
  synthesized sample value are carried in `SampleValue.unchecked`.

### Performance

Criterion 23's thresholds, confirmed with what each one measures. The reference machine is a
4-core, 16 GB Linux CI runner.

| Threshold | Verdict | Reason |
|---|---|---|
| Engine pass under 60 seconds, on `large/github-ghes.json` and `large/stripe.json` | Confirmed | Measured on 2026-11-27 with `yaml` 2.9.1 on Node 22, 4 cores: parsing with the source map takes 2.0 s, 1.7 s and 2.3 s for the two fixtures and `large/github-api-3.1.json`. ADR 0001 requires Node 24, so these figures are indicative only and are measured again on Node 24 before criterion 23 is marked. Nothing else exists to measure, and the rest is linear in the model. |
| Full build within 5 minutes, same two fixtures | Confirmed as a target, not measured | About 1,600 and 2,150 pages, which is 7 pages a second. If Stripe misses it, lower `pageSchemas` before asking for a longer time. |
| New: the engine pass runs in Node's default heap, with no `--max-old-space-size` | Added | Parsing the three large fixtures in one process reached 1.2 GB resident, on Node 22 as above; to be measured again on Node 24. A pass that needs a raised heap would not fit a per-tenant worker. |

- The engine pass is `parseDocument`, `applyFixes`, `buildModel`, `diagnose` and
  `buildPortalBundle` in one process, timed by the test around the calls. It excludes reading
  and writing files.
- The full build is one `ezdp build` command from start to a complete export directory ("The
  M1 command line"): the engine pass, writing the bundle, the static export with highlighting,
  which the command runs as a child process, and the published spec. It excludes installing
  dependencies, `fetch.sh` and the sample toolchains of criteria 13 and 14.
- Criterion 24's page weight is in ADR 0006, "Page weight".

### Build order in M1

The order the engine's functions are built in, by what each needs. The kickoff's step order
follows this table.

| Step | Built | Needs |
|---|---|---|
| 1 | `parseDocument` with limits and the source map, `$ref` resolution, `buildModel` and the operation-id algorithm, `getOperation`, `getSchema`, `applyFixes`, `serializeDocument` | Nothing |
| 2 | `resolveSchemaView`, `validateValue`, `synthesizeExample`, `selectResponseExample` | 1 |
| 3 | The spec doctor: `diagnose` and the rule table, `parsePublicSuffixList`, `checkFixInputs`, `bindFix` | 1 and 2: `example-invalid` needs `validateValue`. `diagnose` does not call `synthesizeExample`: `example-missing` is decided from what the declaration holds, and it has no fix (ADR 0004). |
| 4 | `buildRequest`, `renderSample` and the eight emitters | 1 and 2 |
| 5 | `buildPortalBundle`: page files, twins, `llms.txt`, and the doctor page and report under `report/` | 1 to 4, and the Markdown functions |
| Any time | `parseMarkdown`, `sanitizeMarkdown`, `escapeMarkdownText`, `linkDestinationAllowed` | Nothing. The renderer needs `parseMarkdown` from the start of its work. |

- Steps 3 and 4 do not depend on each other.
- The local mock (ADR 0005) is test code that uses functions of steps 1 and 2 only, so it is
  written after step 2 and not before the engine exists. The tests that run samples against it
  (criterion 14) need step 4, and the mock-server builds (criteria 18 and 25) need the CLI.
- `toJsonSchema` is not built in M1.

Supported input in M1: OpenAPI 3.0.x and 3.1.x. Swagger 2.0 yields a single `unsupported-version`
error. 3.2 is read as 3.1 with a warning, `version-read-as-3.1`.

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
- Caps when fetching: 100 documents, 16 MiB each (16,777,216 bytes), 50 MB total (50,000,000),
  10 s each, 60 s total. Bytes are counted after
  content decoding, so a compressed response is measured as the document it decodes to, and
  decoding stops at the cap. The per-document cap is `defaultLimits.inputBytes`, so a publisher
  that fetches passes the default and no lower figure.
- **The per-document cap was raised from 10 MB (10,000,000 bytes) on 2026-11-28, by the user's
  decision**, so that the hosted and the local cap are one figure and anything that builds
  locally also builds hosted. The other four caps are the security review's figures,
  unchanged. This changes a figure the security reviewer set. What bounds the cost of a
  larger document is not its byte count: it is the `nodes`, `depth` and `aliasExpansions`
  limits while parsing ("Budgets") and the killable per-tenant worker with its time limit.
  The reviewer is to confirm the figure when M4 is designed; until then no code fetches. A
  cap per plan is a later option and is not designed.
- **Local files in the CLI have the same per-document cap, `defaultLimits.inputBytes`.** The
  evidence for 16 MiB: two fixtures that criteria 3, 13 and 23 must build are over 10 MB,
  `large/github-ghes.json` at 10,037,279 bytes and `large/github-api-3.1.json` at 14,401,584,
  and 16 MiB is the next round figure above the larger. Of the other caps, 100 documents and
  50 MB in total apply to local files. The time caps do not, since nothing is fetched.
- In M1 the CLI reads exactly one file, because m1.md's input is one document already bundled.
  It follows no `$ref` to another document, local or remote: the document is missing from the
  set and the reference is `ref-unresolved`. Reading sibling files and fetching arrive with
  ingestion in M4.
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
proxy) and on M4's (the private preview in M4a, host verification in M4b). Two parts bind M1:
the paragraph "Declared examples stay apart from synthesized values" under "The portal bundle",
and `selectResponseExample` below, which M1 builds because the local mock answers with it (ADR
0005). The security reviewer has not seen it.

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
- **The mode in a public portal.** Decided by the user on 2026-11-28: wherever live calls are
  not allowed, in a private preview or on a public portal, the console is in this mode and
  shows the reason. The console is never absent.
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
  media type's schema (ADR 0002). No fix writes an example into the spec: `example-missing` has
  none and no fix has ever written a response example (ADR 0004), so a declared example is
  always one the spec's owner wrote.
- **Nothing synthesized is shown as a response.** `synthesizeExample` output, a value assembled
  from the examples, defaults or enums of a schema's properties, and an `externalValue` are
  never shown in the response's place, under any label. Where the spec declares no example for
  the response, the console says that the spec gives none and shows the response's status,
  description and schema, as the reference page does. A response with no `content` is shown as
  having no body, which is what the spec declares.
- **Which example, when there are several.** One rule, deterministic, implemented once in the
  engine as the pure function `selectResponseExample` and used by the console, by the reference
  page, by the guides `<Response>` component (contract 4.2) and by M1's local mock, so all show
  the same one:

  ```ts
  selectResponseExample(model, operationId: string, status?: string): ResponseExample | null
  interface ResponseExample {
    status: string;                    // the response chosen by step 1, or the one asked for
    mediaType?: string;                // absent: the response has no content
    example?: { name?: string;         // the `examples` key; absent for a schema's example
                value: Json };         // absent: the spec declares no example for this response
  }
  ```

  It returns `null` when the operation is unknown, has no response, or has none with the
  status asked for. With no `status` it applies step 1. When no media type has an example,
  `mediaType` is the first in step 2's order.
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
