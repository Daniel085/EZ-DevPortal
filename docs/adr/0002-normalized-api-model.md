# ADR 0002: The engine's normalized API model

Status: accepted, 2026-11-27. Proposed 2026-11-26; it passed the security design review and
re-review of that day unchanged. Revised on acceptance for the product decision that guides are
generated from the patched spec: `source` carries two hashes, and ids are computed on the patched
document. The dropped header parameters, already stated in ADR 0004, are written down here.
Milestone: M1. Longer than other ADRs because two developers code against it in parallel.

## Context

Every part consumes one structure: the renderer, samples, Markdown twins, and in M2 the proxy and
MCP. It must hide the 3.0/3.1 differences, survive serialization (static export, bundles, MCP
responses), and carry stable identifiers that the guides module computes independently.

## Decision

`ApiModel` is plain JSON data: no cycles, no class instances, no functions, no `undefined` holes.
Building it twice from the same input gives byte-identical JSON. It carries `modelVersion: 1`.

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
  character outside `[A-Za-z0-9]` replaced by `_`. `get` + `/payments/{id}` = `get_payments__id_`.
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
- **Slug**: `slug` on operations, tags and schemas is the URL segment. Lowercase, runs outside
  `[a-z0-9]` become `-`, trimmed, same collision rule with `-2`. Ids are for lookup; only slugs
  appear in URLs.

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
  variables: { name: string; default: string; enum?: string[]; description?: Markdown }[] }

interface Tag { id: string; slug: string; name: string; description?: Markdown;
  operationIds: string[]; synthetic: boolean }   // untagged operations go to synthetic tag 'default'

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
  schema?: Schema; content?: MediaType;           // exactly one of the two
  examples: Example[]; ref?: string; loc: Loc }

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
| 3.0 siblings of `$ref` | dropped, with a finding. 3.1 `description` sibling kept on the ref. |
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
