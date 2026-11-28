# Fixture specs

The corpus of OpenAPI documents that the engine, the spec doctor, the sample generator and the
renderer are tested against. Assembled 2026-11-26.

Rules for this directory:

- **Downloaded files are byte-for-byte as published.** Do not reformat, re-indent or "fix" them.
  Faults in them are part of what they test. `SHA256SUMS` covers every committed file except this
  one and `fetch.sh`; check it with `cd fixtures/specs && sha256sum -c SHA256SUMS`.
- **Every source URL names a commit SHA**, never a branch. To move a pin, change the URL, the hash
  and the row below together, and say why in the commit.
- **Tests never call the real APIs these specs describe.** Build mocks from the specs.
- Specs that are too large to commit, or whose license does not clearly allow redistribution, are
  downloaded by `./fetch.sh` into `large/`, which is gitignored. The script verifies each SHA-256
  and exits non-zero on a mismatch, keeping nothing with a bad hash. Tests that need `large/` must
  say so and must not pass silently when it is missing.
- Upstream license texts are in `licenses/`, as MIT and Apache-2.0 require for redistributed copies.

Operation counts are the number of HTTP method keys under `paths`. Webhooks and callbacks are not
counted.

## Committed, third-party

| File | OpenAPI | What it is there to exercise | Source (pinned URL) | Version and commit | License | Size | Operations | SHA-256 |
|---|---|---|---|---|---|---|---|---|
| `petstore.yaml` | 3.0.4 | Small 3.0 baseline. `apiKey` (header) and `oauth2` (implicit). JSON, XML and form bodies. Shared with the guides module. | [swagger-api/swagger-petstore](https://raw.githubusercontent.com/swagger-api/swagger-petstore/5cb909fc7780bc708151bce0014939acba8b212a/src/main/resources/openapi.yaml) | `info.version` 1.0.30-SNAPSHOT, commit `5cb909fc7780bc708151bce0014939acba8b212a` | Apache-2.0 | 23,165 B | 19 | `65cfe2e8826c81db0eea34c51d18da3a305ae4840f1a778cd63b89d396efb687` |
| `museum.yaml` | 3.1.0 | Small 3.1 baseline, well written. `http` basic, named examples, one webhook. Shared with the guides module. | [Redocly/museum-openapi-example](https://raw.githubusercontent.com/Redocly/museum-openapi-example/2770b2b2e59832d245c7b0eb0badf6568d7efb53/openapi.yaml) | `info.version` 1.2.1, commit `2770b2b2e59832d245c7b0eb0badf6568d7efb53` | MIT | 23,137 B | 8 | `2d88e96a1860382fa86e15af892c50d95ae81d53324ac9b07aa9e6a72a8974aa` |
| `redoc-petstore-3.0.yaml` | 3.0.0 | Renderer torture test: discriminator (`Pet` to `Cat`/`Dog`), `oneOf`, 11 `allOf`, recursive schema (`Pet.friend`), a callback, one operation with no `operationId` among 20 that have one, `x-` extensions, Markdown and HTML in descriptions. | [Redocly/redoc](https://raw.githubusercontent.com/Redocly/redoc/d140213cb6a977cc7376d15e308f0cd63498ed56/demo/openapi.yaml) | tag v2.5.1, commit `d140213cb6a977cc7376d15e308f0cd63498ed56` | MIT | 37,941 B | 21 | `fb65ae71a9591e3bbe2ecafe49ed3a1d9b45b4d9721fd4bc6fd555ae1c0c5c6d` |
| `redoc-petstore-3.1.yaml` | 3.1.0 | The 3.1 form of the same API, for 3.0/3.1 comparison. Adds two webhooks and `operationId`s containing a double quote and a backslash (`deletePetBy"Id`, `delete\PetById`). | [Redocly/redoc](https://raw.githubusercontent.com/Redocly/redoc/d140213cb6a977cc7376d15e308f0cd63498ed56/demo/openapi-3-1.yaml) | tag v2.5.1, commit `d140213cb6a977cc7376d15e308f0cd63498ed56` | MIT | 41,057 B | 23 | `ba77a8ecfc577f02fe41ab24df0a1a765f88d93580df34f5cc6b1a28de39d7ce` |
| `adyen-checkout-v72.yaml` | 3.1.0 | Real 3.1 API with deep schemas: 5 discriminators, `oneOf` with dozens of branches (payment methods), 145 named examples. `apiKey` (header) and `http` basic. Hyphenated `operationId`s (`post-payments-details`). | [Adyen/adyen-openapi](https://raw.githubusercontent.com/Adyen/adyen-openapi/7280e1fdc07c5a2464fe0b268f893df8afaa410c/yaml/CheckoutService-v72.yaml) | `info.version` 72, commit `7280e1fdc07c5a2464fe0b268f893df8afaa410c` | MIT | 846 kB | 31 | `408b91dd12595a34ef04f77e6b9d357b3fe626a0f4ea08a179d0bd6c6e63d93f` |
| `openai.yaml` | 3.0.0 | Mid-sized. Heavy composition: 116 `oneOf`, 45 `anyOf`, 18 `allOf`, 10 discriminators. `http` bearer. 144 of 148 operations have a summary but no description. Hyphenated `operationId`s on 42 operations. Vendor extension `x-oaiMeta`. | [openai/openai-openapi](https://raw.githubusercontent.com/openai/openai-openapi/498c71ddf6f1c45b983f972ccabca795da211a3e/openapi.yaml) | `info.version` 2.3.0 (branch `manual_spec`), commit `498c71ddf6f1c45b983f972ccabca795da211a3e` | MIT | 1.38 MB | 148 | `6a6c681b182002de4ad335fa80214158f2d8f383a418f865c87876c3ed67cad9` |
| `oai-link-example.yaml` | 3.0.0 | Thin spec: no operation has a summary or description, no examples, no security schemes. Also response `links`. | [OAI/OpenAPI-Specification](https://raw.githubusercontent.com/OAI/OpenAPI-Specification/42a9e3d4eddade52363a5c4fac852e80681c2fe5/examples/v3.0/link-example.yaml) | tag 3.1.0, commit `42a9e3d4eddade52363a5c4fac852e80681c2fe5` | Apache-2.0 | 5,280 B | 6 | `4b7b29d7bda1cf95f8c027500c86a9eb3761dfee42f1a8aeb095c5c0b5ccde3b` |
| `oai-callback-example.yaml` | 3.0.0 | No `operationId`. One operation with a callback whose URL is a runtime expression. | [OAI/OpenAPI-Specification](https://raw.githubusercontent.com/OAI/OpenAPI-Specification/42a9e3d4eddade52363a5c4fac852e80681c2fe5/examples/v3.0/callback-example.yaml) | tag 3.1.0, commit `42a9e3d4eddade52363a5c4fac852e80681c2fe5` | Apache-2.0 | 2,158 B | 1 | `42174fc75c21436e3ffd10960c483c4374469059f652c1fdc4542854233ab15d` |
| `oai-petstore-expanded.yaml` | 3.0.0 | An `operationId` containing spaces (`find pet by id`). `allOf` composition. No security schemes. | [OAI/OpenAPI-Specification](https://raw.githubusercontent.com/OAI/OpenAPI-Specification/42a9e3d4eddade52363a5c4fac852e80681c2fe5/examples/v3.0/petstore-expanded.yaml) | tag 3.1.0, commit `42a9e3d4eddade52363a5c4fac852e80681c2fe5` | Apache-2.0 | 5,479 B | 4 | `65d1a5f7ea52cbb220d99d6fbe9125b9c1f9c54caf7303eadd82d774661b2a49` |
| `oai-uspto.yaml` | 3.0.1 | Server URL with variables. Hyphenated `operationId`s. A form-encoded request body. | [OAI/OpenAPI-Specification](https://raw.githubusercontent.com/OAI/OpenAPI-Specification/42a9e3d4eddade52363a5c4fac852e80681c2fe5/examples/v3.0/uspto.yaml) | tag 3.1.0, commit `42a9e3d4eddade52363a5c4fac852e80681c2fe5` | Apache-2.0 | 7,743 B | 3 | `8c171115aa448ea485aedbbe6f17448290aaeefd05d4f04c28edc175549cbc18` |
| `oai-webhook-example.yaml` | 3.1.0 | Webhooks only: a legal 3.1 document with no `paths` key at all. | [OAI/OpenAPI-Specification](https://raw.githubusercontent.com/OAI/OpenAPI-Specification/42a9e3d4eddade52363a5c4fac852e80681c2fe5/examples/v3.1/webhook-example.yaml) | tag 3.1.0, commit `42a9e3d4eddade52363a5c4fac852e80681c2fe5` | Apache-2.0 | 930 B | 0 | `f9301bd9c561f94b7745415ca501a76d5ad6cd2137286f732fd130e48ce720fb` |

## Committed, written in-house

| File | OpenAPI | What it is there to exercise | Source (pinned URL) | Version and commit | License | Size | Operations | SHA-256 |
|---|---|---|---|---|---|---|---|---|
| `synthetic-orders.yaml` | 3.0.3 | No `operationId`s (9 operations), `http` bearer, hostile descriptions (HTML, braces), nested resources, cursor pagination, idempotency keys, almost no descriptions or examples. Shared with the guides module. | [daniel085/ez-devdocs](https://github.com/daniel085/ez-devdocs/blob/437fabbd71c8fb0dfa491fa7fddc8d3db6e5cbbf/fixtures/specs/synthetic-orders.yaml) (private repository) | `info.version` 0.3, commit `437fabbd71c8fb0dfa491fa7fddc8d3db6e5cbbf` | Written for the guides module by the same owner; no third-party license | 4,786 B | 9 | `24ae721a6ef815503ff83f8e2bb2f707c655fe78cff54f32a98019ebb8d4c9eb` |

`synthetic-orders.yaml` is a copy of the guides module's own fixture, so both projects exercise the
same hostile input. It is not a third-party work. If the two copies drift, the guides module's is
the original.

## Committed, written by QA for M1

Written 2026-11-28 for kickoff step 2, before the engine exists. All are in-house, with no
third-party licence. Each holds tenant content as data: nothing in them is executed, and no test
calls a host they name (`example.com`, `tracker.example` and `attacker.example` are reserved
names). `hard-schemas` and `unicode-text` are in m1.md's "all fixtures"; the files under `qa/` are
used only where a criterion names them. Each has a hand-written expected file under `expected/`
(see "The manifest and the expected files" below). Sizes and hashes are in `SHA256SUMS`.

| File | OpenAPI | What it is there to exercise | Criteria | Expected file | Operations |
|---|---|---|---|---|---|
| `hard-schemas.yaml` | 3.1.0 | A discriminated `oneOf` (explicit and implicit mapping) whose variants use `allOf`; `allOf` of three members with a property merged across two and a conflicting `description`; inline `oneOf` with a titled and an untitled member; `anyOf` of a reference, a titled and an untitled member; self-recursion through an array and through a `oneOf` member; mutual recursion (`Department` and `Employee`); `anyOf` with `null` as a control that is not a variant set. | 1, 2, 22, 34, and all-fixture criteria | `expected/hard-schemas.json` | 6 |
| `unicode-text.json` | 3.1.0 | Criterion 33's list: Arabic, Hebrew, Chinese, Japanese, Devanagari, U+2000B, emoji with ZWJ, a flag and a skin-tone modifier, an NFD schema name; U+202E in a description, a JSON body example and a tag name; an unclosed U+2067 in a summary; U+200F in a Hebrew sentence with `API` and `2`; U+2028 in a JSON body example; declared non-ASCII `operationId`s and two derived ids (`post_________`, `get__`); slugs `x`, `x-2`, `x-3`; `maxLength`/`minLength` examples that differ in code points and UTF-16 code units; a required header and a required cookie with non-ASCII examples and two refused multipart part names (non-ASCII, and one holding `=`). First server is the local mock. JSON, not YAML, so that U+2028 is unambiguous to every parser. The bidi controls are raw UTF-8 in the file; the integrity test checks the exact set. | 33, 13, 14, 34, and all-fixture criteria | `expected/unicode-text.json` | 8 |
| `qa/hostile-content.yaml` | 3.0.3 | HTML, script, event handlers and `javascript:` URLs in descriptions, summaries, examples, enum values and names (operation id, tag, schema, property, parameter); in descriptions a `javascript:` link, a `data:` link, a reference link to `javascript:`, an autolink, an HTML block and comment, and a remote image; an `externalDocs` URL of `javascript:`; `{{api_key}}` as literal example text. One construct per description, so its safe form is written by hand. | 19 | `expected/hostile-content.json` | 2 |
| `qa/invalid-schema-and-example.yaml` | 3.0.3 | Four `schema-invalid` keywords (`required` as a string, `minLength` as a string, `items` as a string, `properties` as an array) and four `example-invalid` examples (parameter, media type, schema, named response example); controls that must not be reported (a value violating only `pattern`, a format outside the checked nine, valid examples); one operation no fault touches. | 6 | `expected/invalid-schema-and-example.json` | 4 |
| `qa/request-shape-matrix.yaml` | 3.0.3 | One operation per request shape: path, query and header parameters; JSON, form-urlencoded and multipart bodies; bearer, basic, and API key in a header and in the query; and, beyond criterion 14's list, a declared cookie with an API key in a cookie. First server is the local mock, `http://127.0.0.1:14010`. | 14 | `expected/request-shape-matrix.json` | 11 |
| `qa/host-variables.yaml` | 3.1.0 | One root server per row of ADR 0004's worked-examples table, in order, then a variable with an empty `enum`. Every variable has a `default`. | 29 | `expected/host-variables.json` | 1 |
| `qa/unsatisfiable-schemas.yaml` | 3.1.0 | Eleven schemas that admit no value, each the whole schema of one required parameter or request body, using only keywords the validator checks; four controls that admit a value (an open interval, an unchecked `pattern`, an unchecked format, `email`). | 7 | `expected/unsatisfiable-schemas.json` and `expected/synthesis-failed.json` | 15 |

Generated, not committed: **documents past each parsing limit** (criterion 5), made by
`packages/engine/test/corpus/oversize.ts`: text one code unit over `inputBytes`, empty text with
`bytes` over it (the file not read), nesting one level over `depth`, one node over `nodes` and one
alias over `aliasExpansions`. Each is otherwise a valid document. The limits are ADR 0003's
`defaultLimits`.

## Not committed: `./fetch.sh` downloads these into `large/`

| File | OpenAPI | What it is there to exercise | Source (pinned URL) | Version and commit | License | Size | Operations | SHA-256 |
|---|---|---|---|---|---|---|---|---|
| `large/stripe.json` | 3.0.0 | Very large. 2,124 `anyOf`, 322 `oneOf`, 120 schemas on a reference cycle (expandable objects). `http` basic and bearer. Form-encoded bodies with deep objects. Shared with the guides module. | [stripe/openapi](https://raw.githubusercontent.com/stripe/openapi/a8f2a259ab96578fa3475562e91614d420283530/openapi/spec3.json) | `info.version` 2026-09-30.endive, commit `a8f2a259ab96578fa3475562e91614d420283530` | MIT; not committed because of size | 8.32 MB | 612 | `7cff4cc46d0654101a36a3302f7544640f5f73e4f3cad6f264f0e23c19fa1776` |
| `large/github-ghes.json` | 3.0.3 | Very large. Every `operationId` contains a slash (`gists/create`). No security schemes declared. GitHub Enterprise Server 3.9. Shared with the guides module. | [github/rest-api-description](https://raw.githubusercontent.com/github/rest-api-description/d560905bbf50d79e40d6a006ce2e5834cfd86a31/descriptions/ghes-3.9/ghes-3.9.json) | `info.version` 1.1.4, commit `d560905bbf50d79e40d6a006ce2e5834cfd86a31` | MIT; not committed because of size | 10.04 MB | 908 | `4033d3bb4df0ecc0326c7e67f725860d54c027afb3e722c37ae03c4e75918920` |
| `large/github-api-3.1.json` | 3.1.0 | The largest member, and the large 3.1 case: 276 webhooks, 274 `oneOf`, 260 `anyOf`. Slash `operationId`s. | [github/rest-api-description](https://raw.githubusercontent.com/github/rest-api-description/d560905bbf50d79e40d6a006ce2e5834cfd86a31/descriptions-next/api.github.com/api.github.com.json) | `info.version` 1.1.4, commit `d560905bbf50d79e40d6a006ce2e5834cfd86a31` | MIT; not committed because of size | 14.40 MB | 1281 | `815458acec192fa555b3d2ae66c7e413c165ce28819a551da831fffcd937b62f` |
| `large/clubhouse.yaml` | 3.0.0 | Weak real-world spec: no `operationId`s, no security schemes, 40 of 41 operations without a description. The guides module ran against the JSON rendering of this spec. | [APIs-guru/openapi-directory](https://raw.githubusercontent.com/APIs-guru/openapi-directory/f04b8d0bcd39c52e1cf3ad7a5fe744709832ae49/APIs/clubhouseapi.com/1/openapi.yaml) | `info.version` 1, commit `f04b8d0bcd39c52e1cf3ad7a5fe744709832ae49` | **Unclear; fetch-only.** See below | 41,302 B | 41 | `1a61f68c44c589066b80770b7c66af7f17f4018edb7a1583a37e44ab04af59af` |

**Clubhouse is fetch-only because its license is unclear.** It is an unofficial description of a
private API. The original repository, `zhuowei/ClubhouseAPI`, has no license file. APIs.guru's
README says definitions "acquired from public sources" are held "under the Fair use principle",
and its CC0 grant covers only definitions contributed by their authors. That is not a clear
permission to redistribute, so the file is not committed. The guides module commits it and labels
it CC0; that label should be checked there.

The guides module's copy is the JSON rendering from `api.apis.guru`
(SHA-256 `2a14418d5c6f63ec80b65015dea6611519c57d21e5d37fc3cd5583e595bc139f`, 60,447 bytes), which
is not an immutable URL. The file pinned here is the YAML that rendering is generated from. Both
have 41 operations, but they are not the same bytes and do not parse to identical documents (the
JSON adds `info.x-logo`, and `paths` differ in some way not yet examined). Do not assume
hash-dependent output matches between the two projects for this spec.

Stripe and GitHub Enterprise Server are the same upstream files the guides module downloads, but it
fetches them from moving branches. At the commits pinned here they have 612 and 908 operations,
the counts that module reported.

## Malformed, hand-written

One fault per file, each as small as it can be. `malformed/expected.json` gives the stage at which
each must be caught, the JSON Pointer of the fault, and the finding code, severity and fatality
ADR 0004 assigns it, for tests to assert against. Five are fatal (the three of stage parse,
`missing-openapi` and `unsupported-swagger-2.0`); the other eleven build with findings.

| File | Stage | Fault | Size | SHA-256 |
|---|---|---|---|---|
| `malformed/empty.yaml` | parse | Zero bytes. | 0 B | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `malformed/invalid-yaml.yaml` | parse | Unclosed flow sequence. Not valid YAML or JSON. | 166 B | `9f4beb3aa37bf752ef418f936e9cf79c31d519f773dc7245915f008f22cc57b2` |
| `malformed/invalid-json.json` | parse | Root object never closed. Not valid JSON or YAML. | 174 B | `0b0cbf271db7f194e0ade7962de83d0e0f71153b0112894a95a2ce9a3a6b984d` |
| `malformed/missing-openapi.yaml` | structure | No `openapi` field. | 139 B | `5ce9867253e24de255dd5b6725fbe5970d9fbf0f5cdfd65851dd62abeec6155e` |
| `malformed/missing-info.yaml` | structure | No `info` object. | 98 B | `6cd6626e43ec0d22c71941ca3ea6a5f8dc8b67329ae84455a4cbfe2518e8586b` |
| `malformed/missing-info-title.yaml` | structure | No `info.title`. | 123 B | `ad24643a260987f58ca293656df330affb9d1ffd599e08d985a2f5f10f0dba50` |
| `malformed/missing-paths-3.0.yaml` | structure | No `paths` in a 3.0 document (legal in 3.1). | 98 B | `26fca752e5fec8a40d12e1e493ca7de35a3f0329d8ab57823226ec2e44a5c9aa` |
| `malformed/missing-responses-3.0.yaml` | structure | Operation with no `responses` in a 3.0 document (legal in 3.1). | 140 B | `3b964970389f4e45a2f81b016f4a40dbc5df6decf8b2c7a17073c31e536786b7` |
| `malformed/wrong-type-paths.yaml` | structure | `paths` is an array. | 99 B | `0eac775677fe5085729d4ea2455a303eac12776ac53decf365c61d5e4da31771` |
| `malformed/wrong-type-info-version.yaml` | structure | `info.version` is the number `1.0`, the usual unquoted-YAML mistake. | 167 B | `b061a525748a3f7c89cb4de460469d5083f8d26cd425ccc55e85a7358f0c4767` |
| `malformed/wrong-type-parameters.yaml` | structure | `parameters` is an object keyed by name. | 313 B | `4326674b6fbba1aaec3d2c732524da60921a191e0165155c3d99ccc11373e7f4` |
| `malformed/unsupported-swagger-2.0.yaml` | structure | A Swagger 2.0 document. | 161 B | `6b145330d08152f5eaf4666f97d7455e2a130fd90ae9175075680c125bdd6ecf` |
| `malformed/dangling-ref.yaml` | resolve | `$ref` to a component that does not exist. | 330 B | `e2d9fda0c40c41ef07e1da1884f51a1c71090f06aef4fa675b04c3e41e701266` |
| `malformed/circular-ref.yaml` | resolve | `A` is a `$ref` to `B` and `B` a `$ref` to `A`: a cycle that never reaches a schema. Not the same as a legal recursive schema, which `redoc-petstore-*.yaml` covers. | 416 B | `fdcc2e4b30b6c2f4a243af9cd548505d19292a4df42b37d6f33d96b7eb716426` |
| `malformed/external-ref.yaml` | resolve | `$ref` to a remote URL. The engine does no I/O; it must report this and never fetch it. | 340 B | `56abc6fcd711cc0ac12164e0c8fc63df724a677308ccb787c7cf5c31182fd60e` |
| `malformed/duplicate-operation-id.yaml` | semantic | Two operations share an `operationId`. | 293 B | `4bce02a7e80953741442dd896e9e773209fe9c69f8ac331db2cd32027c7690c7` |

Stages: **parse** means the text is not YAML or JSON; **structure** means it parses but breaks the
shape of an OpenAPI document; **resolve** means a `$ref` cannot be followed; **semantic** means the
document is well-formed but wrong.

## The manifest and the expected files

`corpus.json` lists every fixture spec: its set (`all`, `broken` or `qa`), origin, licence and
licence file, whether it is fetch-only, whether it parses as YAML or JSON, whether its first
server is the local mock, the criteria that name it, and its expected file. The tests in
`packages/engine/test/` discover the specs on disk and fail if one is missing from the manifest,
so no fixture is skipped by accident.

The expected files are written by hand, never taken from engine output, and each value names
the ADR rule it comes from in a `rule` field. They are shared by the engine's tests and, from
kickoff step 4, the publisher's mock tests, which is why they are here and not in a package's
`test/__golden__/` (ADR 0001, Fixtures). Formats:

- **Findings**, in every `expected/*.json` that has a `findings` member: `includes` lists
  findings that must be present with that code and severity at that pointer (`pointer: null`
  means the pointer is not asserted; `pointerAlternatives` are accepted while the question
  named is open); `exactCodes` maps a code to the complete list of places it must be reported,
  no more and no fewer (an entry is a pointer, or `{ pointer, alternatives, subject }`, where a
  `null` pointer counts a finding without placing it). A code not in either is not asserted.
- **Requests** (`request-shape-matrix.json`, `unicode-text.json`): one entry per operation in the
  comparison form of ADR 0005, "How a received request is compared": `method`, `target` (path
  and query), `headers`, `contentType`, `body` (`none`, `json` compared parsed, `form` pairs in
  order, `multipart` parts in order), `mustBeAbsent` and the `status` the mock answers.
- **`synthesis-failed.json`**: for every committed fixture that builds, the complete list of
  `synthesis-failed` findings, each with a written reason its schema admits no value (criterion
  7). A fixture listed with `[]` is expected to have none.
- **`malformed/expected.json`**: the stage, pointer, finding code, severity and whether it is
  fatal, for each of the 16 malformed fixtures, from ADR 0004, "Fatal and degrading faults".

Open questions about expected values are numbered `QA-n` in the files; they are listed in the
report of kickoff step 2 and are to be answered in the ADRs.

## Coverage

| Need | Committed | Fetch-only |
|---|---|---|
| OpenAPI 3.0 | `petstore`, `redoc-petstore-3.0`, `openai`, `oai-link-example`, `oai-callback-example`, `oai-petstore-expanded`, `oai-uspto`, `synthetic-orders`; QA's `hostile-content`, `invalid-schema-and-example`, `request-shape-matrix` | `stripe`, `github-ghes`, `clubhouse` |
| OpenAPI 3.1 | `museum`, `redoc-petstore-3.1`, `adyen-checkout-v72`, `oai-webhook-example`, `hard-schemas`, `unicode-text`; QA's `host-variables`, `unsatisfiable-schemas` | `github-api-3.1` |
| Small, under 20 operations | `museum` (8), `petstore` (19), `synthetic-orders` (9), the `oai-*` files (0 to 6) | |
| Mid-sized | `openai` (148) | `clubhouse` (41) |
| Very large, hundreds of operations | none | `stripe` (612), `github-ghes` (908), `github-api-3.1` (1,281) |
| No `operationId`s | `synthetic-orders` (none of 9), `oai-callback-example` (1 operation), `redoc-petstore-*` (one missing among many) | `clubhouse` (none of 41) |
| Unusual `operationId` characters | `redoc-petstore-3.1` (quote, backslash), `oai-petstore-expanded` (spaces), `adyen-checkout-v72`, `openai`, `oai-uspto` (hyphens) | `github-ghes`, `github-api-3.1` (slashes) |
| Heavy `oneOf` | `openai` (116), `adyen-checkout-v72` (4, with very many branches) | `stripe` (322), `github-api-3.1` (274), `github-ghes` (187) |
| Heavy `anyOf` | `openai` (45) | `stripe` (2,124), `github-api-3.1` (260) |
| `allOf` | `openai` (18), `redoc-petstore-3.0` (11) | `github-api-3.1` (86) |
| Discriminators | `openai` (10), `adyen-checkout-v72` (5), `redoc-petstore-*` (1), `hard-schemas` (1, explicit and implicit mapping) | `github-api-3.1` (6) |
| Recursive schemas | `redoc-petstore-*` (`Pet.friend`), `hard-schemas` (self, through an array, through `oneOf`, and mutual) | `stripe` (120 schemas on a cycle) |
| `apiKey` | `petstore`, `redoc-petstore-*`, `adyen-checkout-v72` (all in a header); `qa/request-shape-matrix` (header, query and cookie) | |
| `http` basic | `museum`, `adyen-checkout-v72` | `stripe` |
| `http` bearer | `openai`, `synthetic-orders` | `stripe` |
| `oauth2` | `petstore`, `redoc-petstore-*` (implicit flow only) | |
| Webhooks (3.1) | `museum` (1), `redoc-petstore-3.1` (2), `oai-webhook-example` (1) | `github-api-3.1` (276) |
| Callbacks | `oai-callback-example`, `redoc-petstore-*` | |
| Thin: sparse descriptions, no examples | `oai-link-example`, `synthetic-orders` | `clubhouse` |
| Malformed | `malformed/` (16 files), `qa/invalid-schema-and-example` | |
| Hostile text | `synthetic-orders`, `redoc-petstore-*` (HTML in descriptions), `qa/hostile-content` | |
| Text outside ASCII, bidi controls | `unicode-text` | |
| Host variables | `oai-uspto`, `qa/host-variables` | |
| Unsatisfiable schemas | `qa/unsatisfiable-schemas` | |

Known gaps:

- **No very large spec is committed.** Scale tests need `./fetch.sh` and network access to
  `raw.githubusercontent.com`.
- **No `openIdConnect`, no `mutualTLS`, and no `oauth2` flow other than implicit.** A spec with
  authorization-code or client-credentials flows is still needed. `apiKey` in a query string and
  in a cookie is now in `qa/request-shape-matrix` only.
- **Mutual recursion** in the committed set is `hard-schemas` only (`Department` and `Employee`);
  among third-party specs it is only in Stripe.
- **No binary multipart part.** The matrix and `unicode-text` send text parts only, because a
  sample run unmodified reads its file from `YOUR_FILE_PATH` (ADR 0005, rule 2).
- **Nothing committed is near 5 MB.** The 5 MB case is Stripe (8.3 MB) or larger.
- **No multi-file spec** (relative `$ref` to sibling files) and no Swagger 2.0 document other than
  the minimal negative fixture.
- The `oneOf`, `anyOf`, `allOf` and discriminator figures count keyword occurrences anywhere in the
  document. The recursion figure counts `components.schemas` entries that can reach themselves by
  `$ref`; recursion through inline schemas would not be counted.

## Sizes

Committed specs: 2,417,434 bytes (2.42 MB) in 19 files: the 12 above, 2,373,804 bytes, and QA's
seven, 43,630 bytes. The 16 malformed specs are counted separately (3,057 bytes). Everything
committed under `fixtures/specs/` apart from this README: 2,528,648 bytes (2.53 MB). `large/` after `./fetch.sh`: 32,797,678 bytes
(32.8 MB) in 4 files.
