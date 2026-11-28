# ADR 0002: The engine's normalized API model

Status: accepted, 2026-11-27. Proposed 2026-11-26; it passed the security design review and
re-review of that day unchanged. Revised on acceptance for the product decision that guides are
generated from the patched spec: `source` carries two hashes, and ids are computed on the patched
document. The dropped header parameters, already stated in ADR 0004, are written down here.
Revised again that day for the user's decision that a portal may hold several APIs, and later
several versions of one: "The unit" is added. The shape is unchanged.
Revised again that day to state the order of `content` and `examples`, which ADR 0003's
example-selection rule depends on. The shape is unchanged.
Revised again that day to make the slug rule exact. The shape is unchanged.
Revised again that day after the second audit. One change of shape: a server variable's
`default` is optional. `Tag.id` is defined, and "Fields OpenAPI requires and real specs omit"
says what the model holds for each.
Checked 2026-11-28 against guides contract 0.3 and its security review: portal-supplied
parameters need no change of shape ("Dropped header parameters" says why).
Revised 2026-11-28 for criterion 33 (text in any script): "Identifiers" says "code point"
where it said "character", as contract 1.1 does, and "Text is kept as authored" states that
no Unicode normalization happens anywhere. The shape and every id are unchanged.
Revised again that day for the security review of "Text outside ASCII"
(`docs/reviews/2026-11-28-security-review-text-outside-ascii.md`, F9 and notes): the parser
refuses unpaired surrogates, and ASCII lower-casing is defined. Accepted by the security
re-review of 2026-11-28.
Milestone: M1. Longer than other ADRs because two developers code against it in parallel.

## Context

Every part consumes one structure: the renderer, samples, Markdown twins, and in M2 the proxy and
MCP. It must hide the 3.0/3.1 differences, survive serialization (static export, bundles, MCP
responses), and carry stable identifiers that the guides module computes independently.

## Decision

`ApiModel` is plain JSON data: no cycles, no class instances, no functions, no `undefined` holes.
Building it twice from the same input gives byte-identical JSON. It carries `modelVersion: 1`.

### The unit: one version of one API

Decided by the user on 2026-11-27: a portal may hold several APIs (M4) and later several
versions of one API, and content is keyed by project, API and version from the start.

- One `ApiModel` is built from one spec, meaning one root document and the documents it refers
  to, and describes one version of one API. One spec in, one model and one portal bundle out
  (ADR 0003): that is the **unit**. No engine function takes two specs or merges two models.
- A portal is several units. Composing them is done by the control plane and the renderer, which
  key each unit by (project, API, version). The key is theirs. It is not in the model and not an
  input to the engine, so the same spec gives the same model wherever it is used.
  `info.version` is the spec's own text, for display; it is not the version key.
- **Every id is unique within one unit only**: operation ids, schema ids, tag ids, security
  scheme ids and slugs. The collision rules below run over one unit. Two units of one portal may
  both have `createPayment`. Whatever stores or passes an id outside the unit carries the unit's
  key with it: a tenant setting that names an operation (MCP write enablement, the
  read-as-write override of ADR 0003), a proxy or MCP call, a search record merged across units.
- Nothing in the model is a portal URL. A `slug` is one URL segment below the unit's base, which
  the renderer supplies (ADR 0003, ADR 0006).
- `source.publishedHash` is the hash of this unit's published spec, and one guides bundle
  belongs to one unit (contract section 3).

M1 builds and serves exactly one unit. It needs no key, and nothing in it may assume that the
unit is the whole portal.

### References and recursion

- A `$ref` to a schema is **kept** as a reference node; every referenced schema lives once in
  `model.schemas`. Cycles can therefore only pass through reference nodes, and the model is a tree.
- Every other `$ref` (parameter, response, request body, header, example, path item) is **resolved
  in place**, with the original pointer kept in `ref` for display and de-duplication.
- A schema `$ref` whose target is not `#/components/schemas/{name}` in the root document (another
  file, a nested pointer) is hoisted into `model.schemas` with a synthesized id and
  `synthetic: true`.
- Each named schema has `recursive: boolean`, precomputed. Consumers expand references lazily and
  stop on a `schemaId` already on their stack.

### Identifiers

- **SchemaId**: the key under `components/schemas`, verbatim (`Payment`). Synthesized ids use the
  last pointer segment or file base name, then the collision rule below.
- **OperationId**: the declared `operationId`, verbatim, whatever characters it contains
  (`repos/get` is valid). If absent, derived: lowercase method, then the path template with each
  code point outside `[A-Za-z0-9]` replaced by one `_`. A code point, not a UTF-16 code unit:
  `get` + `/` + U+1F389 (one code point, two code units) is `get__`. `get` + `/payments/{id}` =
  `get_payments__id_`. Contract 1.1 is the normative text and says the same.
- **Collision rule for operation ids**: the algorithm in section 1.1 of
  `docs/contracts/guides-contract.md` is normative, because the guides module must derive
  identical ids. Implement it exactly and test against its worked examples. It runs on the
  patched document, the one `applyFixes` returns (ADR 0004), which is also the document the guides
  module reads (contract 1.2). In summary:
  1. Order all path operations by path template, then by lowercase method, both compared by
     Unicode code point. Document order is not used, so re-ordering keys never changes an id.
  2. Walking that list, an operation keeps its declared `operationId` unless it is empty or an
     earlier operation already took it. Declared ids are all assigned before any derived id.
  3. Every other operation, including one whose declared id was a duplicate, gets the derived
     base id. If that is taken by anything, append `_2`, `_3`, ... and take the first unused.
  4. Every collision is a spec-doctor finding (`operation-id-collision`).
- Synthesized schema ids use the same suffix rule, ordered by source pointer.
- Webhooks share the pool and are assigned after all path operations. Derived webhook id:
  `webhook_` + method + `_` + sanitized name.
- **Slug**: `slug` on operations, tags and schemas is the URL segment. Lowercase, runs of code
  points outside `[a-z0-9]` become `-`, trimmed, same collision rule with `-2`. Ids are for lookup; only slugs
  appear in URLs. Made exact on 2026-11-27, because URLs must be stable (m1.md, criterion 11):
  the source text is `Operation.id`, `Tag.name` or `NamedSchema.id`; lower-casing is ASCII
  only; the result is cut to 120 characters (all ASCII by then, so characters, code points
  and bytes are the same count) and trimmed of `-` again; an empty result is `x`.
  Operations, tags and schemas are three separate pools, since each has its own URL prefix (ADR
  0003). Within a pool, items that share a slug are taken in order of source text by code
  point: the first keeps it and the rest get `-2`, `-3`, the first unused. Each such item is
  reported as `slug-collision`, an info.
- **Tag id**: `Tag.id` is the tag's `name`, verbatim, compared by code point. Tags are named, so
  no collision rule is needed.
  - Declared tags come first, in declared order, with `synthetic: false`. A second declared tag
    with a name already declared is dropped (`structure-invalid`, ADR 0004).
  - A name an operation uses that no declared tag has becomes a tag with that `id` and `name`,
    no description and `synthetic: true`. These follow the declared tags, in order of first
    use: by `model.operations` order, then by position in the operation's `tags`.
  - An operation with no `tags`, or an empty list, belongs to the tag whose id is `default`. If
    no tag of that name exists it is created last, with `name: 'default'` and
    `synthetic: true`; if one exists the operation joins it and the tag is unchanged.
  - `Operation.tags` holds those ids, each once, in authored order. `Tag.operationIds` is in
    `model.operations` order. Webhooks and callback operations get `tags` by the same rule, but
    they neither create an entry in `model.tags` nor appear in `operationIds`.

### Text is kept as authored

Decided 2026-11-28 (criterion 33). Until now this was only implied by "verbatim".

- **No Unicode normalization happens anywhere**: not in the engine, the publisher or the
  renderer, and not to ids, names, slugs' source text, descriptions, examples, enum values or
  path templates. No NFC, NFD, NFKC or NFKD, and no case folding beyond the ASCII lower-casing
  that slugs and the derived id's method use.
- **ASCII lower-casing maps U+0041 to U+005A to U+0061 to U+007A and changes no other code
  point.** It is never `toLowerCase`, `toUpperCase` or a locale variant: in JavaScript
  `"K".toLowerCase()` (U+212A, the Kelvin sign) is `k` and `"ſ".toUpperCase()` is `S`, so
  those would map two strings to one name. The engine has its own function, and ESLint bans
  the four methods in engine source (ADR 0001, rule 4). "Without regard to ASCII case",
  wherever an ADR says it, means this mapping.
- **Unpaired surrogates are refused.** The parser refuses a document in which a string decodes
  to an unpaired surrogate, with a parse error that gives its location. Such text is not
  Unicode, so no rule here can keep it as authored. The finding is `parse-error` (ADR 0004);
  for the root document it is fatal. Otherwise two ids such as `a\uD800` and `a\uD801`
  would differ in the model and be the same (`a` and U+FFFD) in every UTF-8 file.
- **Every comparison of tenant text is by code point** on the text as authored (after the
  JSON or YAML parser has decoded its escapes, which is not normalization). So two names that
  are canonically equivalent but differ in code points are different: a tag named `café`
  with U+00E9 and one written `cafe` + U+0301 are two tags, two navigation groups and two
  pages. Their slugs differ too (`caf` and `cafe`). This is deliberate: an API whose
  server compares names byte for byte treats them as two names, and the reference must not
  claim otherwise. No finding reports it in M1.
- **Lengths of tenant text count code points**: `minLength` and `maxLength` (ADR 0003,
  "Schema validation"), and the 120-character slug cut. Byte budgets in `Limits` are a
  different thing and count UTF-16 code units (ADR 0003, "Budgets").
- Bidi control characters are text like any other in the model and in `model.json`. What a
  page, a twin and a sample do with them is in ADR 0003 ("Twins and `llms.txt`"), ADR 0005
  ("Text outside ASCII") and ADR 0006 ("Direction of tenant text").

### Shape

```ts
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
interface Loc { doc: number; pointer: string }   // index into documents; RFC 6901 pointer
type Extensions = Record<`x-${string}`, Json>;
type Markdown = string;                           // untrusted CommonMark source, never HTML

interface ApiModel {
  modelVersion: 1;
  source: { openapi: string; dialect: '3.0' | '3.1';
            fetchedHash?: string; publishedHash?: string };   // supplied by caller; see "Source hashes"
  documents: { uri: string }[];
  info: { title: string; version: string; summary?: string; description?: Markdown;
          termsOfService?: string; contact?: Json; license?: Json };
  servers: Server[];
  tags: Tag[];                       // declared order, then undeclared in first-use order
  operations: Operation[];           // document order (display order)
  webhooks: Operation[];             // kind: 'webhook'
  schemas: NamedSchema[];
  securitySchemes: SecurityScheme[];
  externalDocs?: { url: string; description?: Markdown };
  extensions: Extensions;
}

interface Server { url: string; description?: Markdown;
  variables: { name: string; default?: string;    // absent when the spec gives none (see below)
               enum?: string[]; description?: Markdown }[] }

interface Tag { id: string; slug: string; name: string; description?: Markdown;
  operationIds: string[]; synthetic: boolean }   // id: see "Identifiers", Tag id

interface Operation {
  id: string; idSource: 'declared' | 'derived'; slug: string;
  kind: 'operation' | 'webhook';
  method: 'get'|'put'|'post'|'delete'|'options'|'head'|'patch'|'trace';
  path: string;                      // template; for webhooks, the webhook name
  summary?: string; description?: Markdown; deprecated: boolean;
  tags: string[];                    // Tag ids, never empty
  parameters: Parameter[];           // path-level merged in; operation wins on (in, name)
  requestBody?: { required: boolean; description?: Markdown; content: MediaType[]; ref?: string; loc: Loc };
  responses: Response[];             // exact codes ascending, then ranges (2XX), then 'default'
  security: SecurityRequirement[];   // effective (operation, else global). [] = no auth.
  servers: Server[];                 // effective (operation, else path, else global)
  callbacks: { name: string; expression: string; operations: Operation[] }[];
  externalDocs?: { url: string; description?: Markdown };
  extensions: Extensions; loc: Loc;
}

interface Parameter { name: string; in: 'path'|'query'|'header'|'cookie'; required: boolean;
  deprecated: boolean; description?: Markdown;
  style: 'matrix'|'label'|'form'|'simple'|'spaceDelimited'|'pipeDelimited'|'deepObject';
  explode: boolean; allowReserved: boolean;       // defaults already applied
  schema?: Schema; content?: MediaType;           // exactly one of the two, always (see below)
  examples: Example[]; ref?: string; loc: Loc }

// `content` arrays and `examples` arrays are in authored order: the order of the keys in the
// source. A singular `example` is the only entry. Declared examples only: the engine never
// puts a synthesized value into `examples`, here or on a Schema.
interface MediaType { mediaType: string; schema?: Schema; examples: Example[];
  encoding: { property: string; contentType?: string; style?: string; explode?: boolean }[] }

interface Response { status: string;              // '200' | '2XX' | 'default'
  description?: Markdown; headers: (Omit<Parameter, 'in'|'name'> & { name: string })[];
  content: MediaType[]; ref?: string; loc: Loc }

interface Example { name: string;                 // map key; singular `example` is named 'default'
  summary?: string; description?: Markdown; value?: Json; externalValue?: string; loc: Loc }

type SecurityRequirement = { schemeId: string; scopes: string[] }[];   // outer array OR, inner AND
type SecurityScheme = { id: string; description?: Markdown; loc: Loc } & (
  | { type: 'apiKey'; in: 'header'|'query'|'cookie'; name: string }
  | { type: 'http'; scheme: string; bearerFormat?: string }
  | { type: 'oauth2'; flows: { flow: 'implicit'|'password'|'clientCredentials'|'authorizationCode';
        authorizationUrl?: string; tokenUrl?: string; refreshUrl?: string;
        scopes: { name: string; description: string }[] }[] }
  | { type: 'openIdConnect'; openIdConnectUrl: string }
  | { type: 'mutualTLS' });
```

### Fields OpenAPI requires and real specs omit

The model holds an empty value or drops the item; it never guesses a value. For each field
OpenAPI requires, this is what the model holds when the spec leaves it out. Each case is a finding; the code is `structure-invalid`
unless another is named (ADR 0004, "Fatal and degrading faults" and the rule table).

| Required by OpenAPI | In the model when absent or of the wrong type |
|---|---|
| `info`, `info.title`, `info.version` | `''` |
| `responses` on an operation; `content` on a request body | `[]` |
| A server's `url` | The server is dropped |
| A server variable's `default` | `default` is absent (`server-variable-no-default`). Nothing else about the variable changes. |
| A tag's `name` | The tag is dropped |
| A parameter's `name` or `in` | The parameter is dropped |
| `required: true` on a path parameter | `required: true` |
| One of `schema` and `content` on a parameter | Neither: `schema` is an empty schema node of any type. Both: `schema` is kept and `content` dropped. |
| A response's `description` | Absent; the field is optional in the model |
| A security scheme's `type`; `name` and `in` for `apiKey`; `scheme` for `http`; `openIdConnectUrl` for `openIdConnect` | The scheme is dropped. A requirement that names it then names an undefined scheme (`security-scheme-missing`). |
| `flows` on `oauth2`; `scopes` on a flow | `[]` |
| `url` on `externalDocs` | `externalDocs` is absent |
| `propertyName` on a discriminator | The discriminator is dropped (`schema-invalid`) |

An `http` scheme's `scheme` is held as written. It is compared with `bearer` and `basic`
without regard to ASCII case (ADR 0003, "The security statement"; ADR 0005).

### Source hashes

Both are SHA-256 in lowercase hex, of the root document only, computed by the caller (ADR 0003).
The model is built from the patched document in either case.

- `fetchedHash`: the bytes of the root document as fetched, before the overlay. It tells the
  caller whether the tenant's document changed upstream.
- `publishedHash`: the bytes of the published spec, which is the patched root document as the
  publisher wrote it out (ADR 0003, "The published spec"). This is the value a guides bundle's
  `spec.sha256` is compared with (contract 1.2 and 3). When no fix was applied to the root
  document the two hashes are equal.

There is no field named `hash`; each consumer names the one it means.

### Dropped header parameters

A parameter with `in: 'header'` whose name is `Accept`, `Content-Type` or `Authorization`,
compared case-insensitively, is not in the model: OpenAPI says such a definition is ignored. It
appears in no `Operation.parameters`, whether declared on the operation or on its path item, so
no sample, request or MCP input carries it. The spec doctor still sees the declaration in the
parsed documents and reports it under its auth rules (ADR 0004).

These three are the only parameters the model drops. Every other parameter the guides contract
calls portal-supplied (4.3) stays in `Operation.parameters` exactly as declared: a header on
the controlled list, a header, query or cookie parameter whose name a security scheme carries
its credential in, and any cookie parameter. The reference page lists them, because the spec
declares them. The model has no field that marks one. Whether a parameter is portal-supplied
follows from data the model already holds: its `in` and `name`, `securitySchemes`, and the
controlled-header list, which is a constant. Whether a credential is placed for it follows
from which entry of `Operation.security` is in effect, which is a choice made per request
and not a fact about the spec. `buildRequest` and the doctor derive both (ADR 0005, ADR
0004). So contract 0.3 changes nothing in this ADR's shape.

### Schemas

```ts
interface NamedSchema { id: string; slug: string; synthetic: boolean; recursive: boolean; schema: SchemaNode }
type Schema = SchemaRef | SchemaNode;
interface SchemaRef { kind: 'ref'; schemaId: string; nullable: boolean;
  description?: Markdown; loc: Loc }              // description: 3.1 sibling override only
interface SchemaNode {
  kind: 'schema';
  types: ('string'|'number'|'integer'|'boolean'|'object'|'array'|'null')[];  // [] = any type
  title?: string; description?: Markdown; format?: string;
  deprecated: boolean; readOnly: boolean; writeOnly: boolean;
  enum?: Json[]; const?: Json; default?: Json; examples: Json[];
  properties: { name: string; required: boolean; schema: Schema }[];          // authored order
  additionalProperties?: boolean | Schema;
  patternProperties: { pattern: string; schema: Schema }[];
  items?: Schema; prefixItems?: Schema[];
  allOf?: Schema[]; oneOf?: Schema[]; anyOf?: Schema[]; not?: Schema;
  discriminator?: { propertyName: string; mapping: { value: string; schemaId: string }[] };
  constraints: { minimum?: number; maximum?: number; exclusiveMinimum?: number;
    exclusiveMaximum?: number; multipleOf?: number; minLength?: number; maxLength?: number;
    pattern?: string; minItems?: number; maxItems?: number; uniqueItems?: boolean;
    minProperties?: number; maxProperties?: number; contentMediaType?: string; contentEncoding?: string };
  extensions: Extensions; loc: Loc;
}
```

Normalization, so consumers see one dialect (3.1 semantics):

| Source | Model |
|---|---|
| 3.0 `nullable: true` | `'null'` added to `types` |
| `oneOf`/`anyOf` of exactly one schema plus `{type: 'null'}` | that schema, made nullable (`SchemaRef.nullable` for a ref) |
| 3.0 boolean `exclusiveMinimum`/`Maximum` | numeric form |
| `type: 'x'` or `type: ['x','null']` | `types` array |
| singular `example` | `examples: [value]` |
| 3.0 siblings of `$ref` | dropped, with a finding (`ref-siblings-ignored`, an info). 3.1 `description` sibling kept on the ref. |
| discriminator without `mapping` | mapping filled in from the `oneOf`/`anyOf` member schema names |
| `allOf` | kept as authored. `resolveSchemaView()` (ADR 0003) returns the merged object for display. |

Line and column are not in the model. `Loc` is a pointer; the parser's source map turns it into a
range for diagnostics (ADR 0004). This keeps large models small.

## Consequences

- The renderer can render any schema with a recursive component and a visited-set; `oneOf`/`anyOf`
  and discriminators arrive explicit, which is where existing tools render badly.
- MCP clients that reject `$ref`, `anyOf` or `oneOf` need a flattened JSON Schema. That is a pure
  projection (`toJsonSchema`, ADR 0003), not a second model.
- Numeric collision suffixes can shift when a colliding path is added. Guides are pinned to
  `publishedHash` and regenerated, so this is acceptable, and collisions are reported for the
  owner to fix. Accepting the doctor's fix that writes the ids into the spec does not shift them
  (ADR 0004) and pins them against later additions.

## Alternative rejected

Fully dereference the spec into an object graph (what `json-schema-ref-parser` produces). It loses
schema names, cannot be serialized when recursive, and duplicates large schemas at every use. Also
rejected for collisions: a hash suffix of method and path. It is stable under additions but
unreadable, and both projects would have to agree on a hash and its encoding.
