# Guides Module: Status and Context for the Portal Side

As of 2026-11-27. Written by the guides module session for whoever picks up the contract or guides
ingestion (M5) here. Portal sessions cannot read the module's repository, so this is the account
of what it emits.

## Where it is

- Repository: `daniel085/ez-devdocs`, branch `main`. Generator version `0.2.0`.
- **It targets contract v0.2** as written in this directory, synced at commit `f26100d`. Its
  bundles carry `contractVersion` `"0.2"`. It holds copies of the contract, the manifest schema and
  the report schema under `contract/`, which must be re-synced when any of them changes.
- Its feedback on contract v0.1 is in [`guides-contract-feedback.md`](./guides-contract-feedback.md).
  Section 11 of the contract decides every item; the module now does what each decision says.

## How it is run

The brief asks the module to say what it offers.

- **Both a library and a command.** The library is one pure function,
  `generate(specBytes, { manifestSchema, reportSchema, existing? })`, which returns the bundle's
  files in memory, the manifest, the run report and a validation report. It touches no file,
  network, clock or environment. The command, `node src/cli.ts generate <spec> --out <dir>
  [--existing <bundle-dir>]`, is the only code that reads or writes files.
- **Inputs:** the bytes of the published spec, and optionally the existing bundle. Nothing else.
- **Pinning.** There is no published package yet. Pin by Git commit. It needs Node 22.18 or later
  and has no build step.
- **Dependencies at run time:** `ajv` (MIT), `ajv-formats` (MIT), `yaml` (ISC). The module itself
  declares no licence yet; that is the owner's to choose.
- **Determinism.** No clock in the output unless `--timestamp` is passed by a person. The suite
  checks that every fixture, Stripe and GitHub give byte-identical files on a second run, and
  again when the first run's output is given back as the existing bundle.

## What the portal will receive

A bundle from the module looks like this (Petstore):

```
guides.json
report.json
pages/authentication.md
pages/errors.md
pages/pet/manage.md
pages/quickstart.md
pages/rate-limits.md
pages/store-order/manage.md
pages/user/manage.md
```

- **Nav:** `quickstart` first, then groups `Concepts`, `Guides`, `Tutorials`. Depth is 1. The module
  writes no `label` or `hidden`; it keeps ones a person added (below).
- **Slugs:** fixed names for concept pages (`authentication`, `errors`, `pagination`, `idempotency`,
  `rate-limits`, `webhooks`); `<resource>/manage` or `<resource>/browse` for how-to guides;
  `tutorials/<parent>-<child>` for tutorials. Resource slugs come from the collection path, so they
  change only if the path does.
- **Page types used:** `quickstart`, `concept`, `how-to`, `tutorial`. Never `reference`.
- **Components used:** `Steps`, `Step`, `CardGroup`, `Card`, `Operation`, `Schema`, `Sample`,
  `Response`. `Tabs`, `Callout` and `Todo` are not written. No assets are produced.
- **Never withheld by its own doing.** The module writes no `<Todo>` and no `status`, so every page
  it generates is `ready`. What the spec did not say is left out of the page and listed under
  `gaps` in `report.json`. The quickstart says nothing about how credentials are issued; the gap is
  in the report so the portal's "get a key" link can be checked.
- **Variables used:** `{{api_name}}` and `{{base_url}}` in prose; `{{idempotency_key}}` and captured
  names in sample values. Never in a code block.
- **`generatedAt`** is left out.

### How samples are written

````markdown
<Sample operation="getInventory" />

<Sample operation="createSpecialEvent" example="default_example" capture="event_id=$.eventId" />

<Sample operation="createSite" capture="site_id=$.id">
```json
{
  "body": {
    "customer_id": "{{customer_id}}",
    "idempotency_key": "{{idempotency_key}}",
    "street": "12 Lakeview Rd"
  }
}
```
</Sample>
````

- Form 1 is written only for an operation that needs no values. Form 2 only when the named example
  supplies everything. Form 4, an example plus inline values, is not written yet.
- A variable is always a whole quoted string, including where the schema says integer.
- Inline blocks hold only the keys that have values.
- One `capture` pair per sample; paths use `$`, `.member` and `[index]`. A name is captured once
  per page. `tryIt` is never written.
- **Captured names appear inside `body` values**, at any depth, including inside arrays.
- **Several samples on a page can use `{{idempotency_key}}`**, in `headers` or in `body`, relying on
  4.6: each `<Sample>` gets its own.
- Headers the portal controls and names that carry a credential are never sent, even where the
  spec declares them as required parameters.

### Prerequisite steps

A request body often refers to another record by identifier, such as `customer_id` on a site. When
that field has the name of the path parameter of a resource the spec can create, the guide creates
that record first, captures its identifier and sends it in place of the spec's example value. Up to
five such steps are added to a page, in the order the calls must be made.

- **A page's `operations` includes operations of other resources.** `sites/manage` lists
  `createCustomer`. Anything that maps a page to "its" resource from that list should not assume one.
- A prerequisite step links the other resource's guide with `guide:<resource>/manage` when that
  page is in the bundle.

### Operation ids

Implemented as section 1.1 says, sort order and collision rule included, and tested against the
five examples in its table. An id is written verbatim in attributes and frontmatter and
percent-encoded in link targets. An id that contains `"`, a line break, `<` or `>` is shown as text
and not linked; the last two are the module's own limit, because its validator reads tags line by line.

### The run report

`report.json` is in the bundle, in the shape of 5.2, and passes the report schema.

- `pages`: every page written or skipped, with the reason. The module adds `type`, `title`,
  `operations`, and **`sha256`, the hash of the page as it wrote it** (see the next section).
- `gaps`: what a person should complete.
- `specProblems`: the module's **spec audit**, one entry per finding, most serious first. `message`
  is one line; the extra members are `code`, `severity` (`high`, `medium`, `low`), `title`, `detail`,
  `fix`, `count`, `of`, `unit` and up to 200 affected operation ids in `subjects`. No `pointer` is
  written. It overlaps with what the portal's spec doctor looks for; it is the module's view of
  what limited the guides, and it proposes no patch.
- Also at the top level: `generator`, `contractVersion`, `spec` and `navSha256`.
- Sizes seen: 54 KB for Retavon, 80 KB for Stripe, 61 KB for GitHub, against the 2 MB limit. Arrays
  are cut at 1,000 items, with the number left out recorded under `omitted`.
- The command also writes `spec-audit.md` **beside** the bundle directory, for a person. It is not
  in the bundle and does not reach the portal.

## Regenerating without reverting edits

The contract (4.7) leaves two choices to the module. These are the choices made.

**How an edited page is told from a generated one.** By the `sha256` the module recorded for each
page in `report.json`. Given the existing bundle:

- a page whose bytes do not match its recorded hash was edited by a person;
- a page with no record was added by a person;
- a page whose bytes match was not touched.

No input beyond the existing bundle is needed. **This depends on `report.json` staying in the
bundle in the tenant's repository.** If it is deleted there, the module cannot tell pages apart and
keeps every existing page as it is.

**What happens to each.**

- An edited or added page is emitted byte for byte. Nothing is merged into it, so it does not pick
  up later improvements; the report lists it with `kept: "edited"` on every run.
- An untouched page is regenerated, or removed when the spec no longer supports it.
- **An edited page that no longer fits the spec is kept as the person left it**, for example one
  that names a removed operation. The report says so under `gaps`, naming the code. The module
  does not hide the problem: the bundle then has an `error` on that page, so under section 5 the
  whole bundle is not staged until a person fixes or deletes the page.
- **Navigation.** If `nav` differs from what the module last wrote (`navSha256`), it is the person's:
  their order, groups, labels and `hidden` stand, entries for pages that are gone are removed, and
  new pages are appended to the group for their type. Otherwise the module orders it.
- Assets in the existing bundle are carried over unchanged.
- **A page a person deleted is generated again** if the spec still supports it; the pull request
  shows it as a new file. Deleting a kept page is also the only way to get the generated version
  back: a kept page stays kept on every later run.
- Hashes are recorded for the first 1,000 report entries only. Pages beyond that are treated as
  edited on the next run. No bundle so far has come near that many.

## What it was run against

| Spec | Operations | Pages | Module's own validation |
|---|---|---|---|
| Swagger Petstore (3.0) | 19 | 7 | passed |
| Redocly Museum (3.1) | 8 | 6 | passed |
| Clubhouse, APIs.guru (3.0, no `operationId`s) | 41 | 3 | passed |
| Stripe (3.0) | 612 | 120 | passed |
| GitHub Enterprise Server 3.9 (3.0) | 908 | 25 | passed |
| Retavon 0.1.0 (3.1, assembled from its per-operation reads) | 565 | 89 | passed |

"Passed" means no errors, no blockers and no warnings from the module's validator against v0.2.
**No bundle has been through a portal validator, because none exists yet.** The two will disagree
somewhere; the first real ingestion should be treated as a test of both.

## Things the portal side should know

- **The module's validator is not a CommonMark parser.** It reads pages line by line, uses the
  contract's codes and severities for what it can see, and rejects what it cannot check as
  `unsupported-syntax`. It is a pre-flight check, not a reference implementation. Known gaps: it
  measures nesting by component depth only; it looks up `example` in the sample media type only;
  it does not apply the WHATWG host comparison to external links, which the contract leaves to the
  portal.
- **Its report has the contract's shape** (section 5): `findings` with the severities `error`,
  `blocker` and `warning`, `publishable`, and `withheld`. It reports `todo-present`,
  `page-not-ready` and `link-to-withheld-page` on bundles a person has edited.
- **Stricter with its own output:** a generated page that would draw `api-request-code` is left out,
  though the contract makes that a warning.
- **Placeholder values.** Where a spec has no examples, sample values are built from types
  (`"email": "string"`). They pass the schema but are not realistic. The report marks those pages
  with `placeholderValues: true`.
- **Spec text is sanitized by the module** (reduced to plain text, escaped) before it reaches a
  page. The portal must still treat every page as untrusted and must not rely on this.
- **No LLM step.** Output is built from templates and the spec's own words, so it is deterministic
  and plain. Guides cover resource lifecycles, parent/child flows and the records a request body
  refers to by identifier.
- **Information architecture.** A review of the generated bundles on 2026-11-27 found that at scale
  the navigation is too flat (Stripe has 102 entries in one group), page titles drop the qualifier
  that tells similar resources apart, and steps use generic verbs where the spec has its own. None
  of that is fixed yet. Fixing it will change titles, step titles and navigation grouping, and may
  change slugs; a bundle regenerated after that will differ widely from one generated now.

## Questions and proposals for the portal side

1 and 3 are answered by 0.2 as written (4.7 and 5; 5.2) and are proposals for a later version.
2 and 4 are open. All four, and one gap in 4.3, are recorded in
[`guides-contract-feedback.md`](./guides-contract-feedback.md) under "On v0.2".

1. **An edited page that no longer fits the spec blocks the whole bundle**, because its finding is
   an `error`. The module keeps the person's text, as 4.7 requires, and cannot make the page valid.
   Proposal: a way to withhold only that page.
2. **`report.json` must survive in the tenant's repository** for edits to be recognised. The portal
   never changes a bundle on the ingested branch (section 6), so it cannot protect the file; should
   it say so where it describes the repository (M5)?
3. **Showing the audit's severity and fix text** from `specProblems`, beside the portal's own spec
   doctor findings. Today those are extra members, which the portal ignores.
4. **Should a deleted page stay deleted?** The contract does not mention deletion. Today the module
   generates the page again.
