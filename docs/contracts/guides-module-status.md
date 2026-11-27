# Guides Module: Status and Context for the Portal Side

As of 2026-11-27. Written by the guides module session for whoever picks up the contract or guides
ingestion (M5) here.

## Where it is

- Repository: `daniel085/ez-devdocs`, branch `main`.
- The changes dated 2026-11-27 below were merged to `main` in its pull request 1.
- It targets contract **v0.1**. This directory now holds **v0.2**, which the module has not been
  moved to: its bundles say `contractVersion` `0.1`, and a portal implementing v0.2 accepts only
  `0.2`. Its copy of the contract needs a re-sync and its output a pass against v0.2.
- It holds a copy of the contract and the
  manifest schema under `contract/`; that copy must be re-synced when the contract changes.
- Its feedback on the contract is in [`guides-contract-feedback.md`](./guides-contract-feedback.md), kept only in this repository:
  answers to the four open questions, six proposed changes and 18 assumptions. **Nothing in it has
  been agreed.** The contract is still the draft the portal proposed.

## What the portal will receive

A bundle from the module looks like this (Petstore):

```
guides.json
pages/quickstart.md
pages/authentication.md
pages/errors.md
pages/rate-limits.md
pages/pet/manage.md
pages/store-order/manage.md
pages/user/manage.md
```

- **Nav:** `quickstart` first, then groups `Concepts`, `Guides`, `Tutorials`. Depth is 2. No `label` or `hidden` is used.
- **Slugs:** fixed names for concept pages (`authentication`, `errors`, `pagination`, `idempotency`,
  `rate-limits`, `webhooks`); `<resource>/manage` or `<resource>/browse` for how-to guides;
  `tutorials/<parent>-<child>` for tutorials. Resource slugs come from the collection path, so they
  change only if the path does.
- **Page types used:** `quickstart`, `concept`, `how-to`, `tutorial`. Never `reference`.
- **Components used:** `Steps`, `Step`, `Callout`, `CardGroup`, `Card`, `Operation`, `Schema`,
  `Sample`, `Response`. `Tabs` is not used. No assets are produced.
- **Variables used:** `{{api_name}}`, `{{base_url}}`, `{{idempotency_key}}` and captured names.
  `{{api_key}}` is never written; the module assumes the portal adds credentials to samples.
- **`generatedAt`** is set by the CLI and can be left out for byte-identical output.

### How samples are written

These are the forms the portal's parser and sample generator must handle. Each depends on an
assumption in the feedback document.

````markdown
<Sample operation="getInventory" />

<Sample operation="createSpecialEvent" example="default_example" capture="event_id=$.eventId" />

<Sample operation="getPetById">
```json
{
  "path": {
    "petId": "{{pet_id}}"
  }
}
```
</Sample>
````

- The first form, with no example and no block, is used when an operation needs no values (assumption 1).
- A captured value is always written as a quoted string, including where the parameter is an integer (assumption 3).
- Inline blocks include only the keys that have values, not all four.
- One `capture` pair per sample, with paths made of `$`, `.name` and `[n]` only.
- Component tags are on their own lines with blank lines around Markdown content; the fenced block inside `<Sample>` has none.

### Prerequisite steps (2026-11-27)

A request body often refers to another record by identifier, such as `customer_id` on a site. When
that field has the name of the path parameter of a resource the spec can create, the guide now
creates that record first and sends the captured identifier in place of the spec's example value:

````markdown
<Sample operation="createCustomer" capture="customer_id=$.id">
```json
{ "body": { "name": "Pat Lee" } }
```
</Sample>

<Sample operation="createSite" capture="site_id=$.id">
```json
{
  "body": {
    "customer_id": "{{customer_id}}",
    "street": "12 Lakeview Rd"
  }
}
```
</Sample>
````

What this means for the portal:

- **Captured names now appear inside `body` values**, at any depth, including inside arrays. Before,
  they appeared only in `path` and `query`. A body value that is a variable is still written as a
  quoted string whatever the field's type (assumption 3).
- **A page can capture several names**, one per sample, and a later sample can use more than one.
  Up to five prerequisite steps are added to a page, in the order the calls must be made.
- **A page's `operations` now includes operations of other resources.** `sites/manage` lists
  `createCustomer`. Anything that maps a page to "its" resource from that list should not assume one.
- A prerequisite step links the other resource's guide with `guide:<resource>/manage` when that
  page is in the bundle.
- An identifier field that matches nothing the spec can create keeps its example value, and the
  run report lists it as a gap.
- Slugs, navigation, page types and components are unchanged.

### Other changes (2026-11-27)

- **Idempotency key in the body.** Where an API takes its key as a field of the request body, not a
  header, samples now send `"idempotency_key": "{{idempotency_key}}"` in `body`, and the
  `idempotency` page is produced for such an API. Before, `{{idempotency_key}}` appeared only in
  `headers`. **A page can now hold several samples that each use `{{idempotency_key}}`** (17 of
  Retavon's 89 pages do). The module assumes the portal generates a fresh value for each sample;
  one value shared across a page would send the same key with different requests, which an API
  may refuse. Contract v0.1 said only "a generated UUID"; v0.2 (4.6) settles it: each `<Sample>`
  gets its own, as the module assumes. v0.2 also allows a name to be captured only once on a page
  (4.3); no page in the Retavon, Stripe or GitHub bundles captures one twice.
- **Longer step text.** A flow step carries up to 1,200 characters of an operation's description
  (was 320). A description cut short ends with a sentence that links the operation with `op:`.
  Elsewhere a shortened text ends with `…`.
- **Quickstart.** When the spec has security schemes, the first call is one that needs credentials.
- **Run report.** `no-request-example` no longer counts a request whose schema carries `example`
  or `examples`.

### Spec audit (2026-11-27)

Every run of the module now audits the API description and writes, next to the bundle and not in
it, `spec-audit.md`: what the owner of the spec should change so that better guides can be
generated. The same findings are in the module's `report.json` under `audit`, each with a code, a
severity (`high`, `medium`, `low`), a count, the fix and every affected operation id.

- Findings: no server URL, duplicate or missing `operationId`, unresolved `$ref`, operations with
  no error or no success response, a GET response with no schema, path parameters and request
  bodies with no example, a create response that does not show the new identifier, undefined,
  unused or undescribed security schemes, parameters with no description, and the same body under
  several success statuses.
- It reads standard OpenAPI only. It overlaps with what the portal's spec doctor looks for; it is
  the module's view of what limited the guides, not a second doctor, and it proposes no patch.
- **Nothing in the bundle changes.** The bundle root still holds only what the contract allows.
- **Not yet mapped to contract v0.2.** There, `report.json` is in the bundle and its place for
  this is `specProblems` (`pointer`, `message`). The module's `audit` has no `pointer` and carries
  more than that shape holds. When the module moves to v0.2, each finding can become one
  `specProblems` entry with the rest as extra members, which the schema allows and the portal
  ignores. Whether the portal should show severity and the fix is a question for the contract.

### Derived operation ids

Method, then the path with every non-alphanumeric character replaced by `_`: `get` and
`/payments/{id}` give `get_payments__id_`. This matches the example in the brief. If the portal
derives ids differently, every link and sample for a spec without `operationId`s will fail.

### Operation ids with unusual characters

GitHub's spec uses ids such as `gists/create`. The module writes these into `op:` links and
`operation="…"` attributes as they are. The portal needs to accept them or say which characters it allows.

## What it was run against

| Spec | Operations | Pages | Module's own validation |
|---|---|---|---|
| Swagger Petstore (3.0) | 19 | 7 | passed |
| Redocly Museum (3.1) | 8 | 6 | passed |
| Clubhouse, APIs.guru (3.0, no `operationId`s) | 41 | 3 | passed |
| Stripe (3.0) | 612 | 120 | passed |
| GitHub Enterprise Server 3.9 (3.0) | 908 | 25 | passed |
| Retavon 0.1.0 (3.1, assembled from its per-operation reads) | 565 | 89 | passed |

"Passed" means the module's validator found no errors. **No bundle has been through a portal
validator, because none exists yet.** The two will disagree somewhere; the first real ingestion
should be treated as a test of both.

## Things the portal side should know

- **Placeholder values.** Where a spec has no examples, sample values are built from types
  (`"email": "string"`). They pass the schema but are not realistic. 85 of Stripe's 120 pages have
  them. The module reports which pages; the bundle itself does not say.
- **Gaps are outside the bundle.** What the spec did not say goes in `report.json`, written next to
  the bundle, not in it. The contract has no marker for incomplete content (proposal 1). One
  reader-visible callout in the quickstart says the spec does not describe how credentials are issued.
- **The run report** also lists skipped pages with reasons and problems found in the spec. It would
  be useful to show customers; the contract has no place for it (proposal 6).
- **Spec text is sanitized by the module** (reduced to plain text, escaped) before it reaches a page.
  The portal must still treat every page as untrusted and must not rely on this.
- **The module's validator is not a CommonMark parser.** It scans line by line and rejects what it
  cannot check. It is a pre-flight check for the module's own output, not a reference
  implementation for the portal's validator. Its error codes are provisional (proposal 5).
- **Warnings to expect on every bundle:** `page-unreferenced` for concept pages with no operations (proposal 4).
- **No LLM step.** Output is built from templates and the spec's own words, so it is deterministic
  and plain. Guides cover resource lifecycles, parent/child flows and the records a request
  body refers to by identifier.

## Decisions waiting on the portal side

1. Confirm or correct the 18 assumptions. Numbers 1, 3, 5, 11 and 12 affect whether bundles parse at all.
2. Decide on the six proposed changes; a marker for incomplete content and `tryIt` on `<Sample>` matter most.
3. Publish the validator's error codes.
4. Settle delivery (contract section 6). The module only writes a directory today; it does not upload or build a `.tar.gz`.
