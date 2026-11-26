# Guides Module: Status and Context for the Portal Side

As of 2026-11-26. Written by the guides module session for whoever picks up the contract or guides
ingestion (M5) here.

## Where it is

- Repository: `daniel085/ez-devdocs`, branch `claude/hopeful-darwin-fuei2f`, commit `89e086a`. Not merged, no pull request.
- It targets contract **v0.1** as written in this directory. It holds a copy of the contract and the
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
  and plain. Guides cover resource lifecycles and parent/child flows only.

## Decisions waiting on the portal side

1. Confirm or correct the 18 assumptions. Numbers 1, 3, 5, 11 and 12 affect whether bundles parse at all.
2. Decide on the six proposed changes; a marker for incomplete content and `tryIt` on `<Sample>` matter most.
3. Publish the validator's error codes.
4. Settle delivery (contract section 6). The module only writes a directory today; it does not upload or build a `.tar.gz`.
