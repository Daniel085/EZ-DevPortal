# Brief for the Guides Module Session

Paste this into the session that builds the guides module. It is written to stand alone.

## What you are building

A module that takes an OpenAPI 3.x specification and produces developer guides: quickstarts,
concept pages, how-to guides and tutorials. It does **not** render anything. Its only output is a
**guides bundle**: a directory of Markdown files and a JSON manifest.

## Where the output goes

A separate product, EZ-DevPortal, consumes the bundle. EZ-DevPortal is a hosted, multi-tenant SaaS
that generates branded developer portals for other companies from their existing OpenAPI specs. It
owns the API reference, the multi-language code samples, theming to match the customer's site,
search, hosting, `llms.txt`, and a generated MCP server for the customer's API.

Your guides appear inside those portals, next to the API reference, styled by the portal.

## How you are run

Decided on 2026-11-27. **The portal runs your module. The portal's customer does not.** You are
a step in the portal's pipeline, invoked once for one version of one API, and the portal carries
your output to the customer's Git repository as a pull request. Build for that:

- **Inputs:** the bytes of the published spec (constraint 5); optionally the existing bundle
  directory (constraint 8); and the tenant's settings, which are the bytes of that bundle's
  `settings.json` and come from nowhere else (constraint 9). Nothing else varies between runs
  except your own version.
- **Output:** a bundle directory, with `guides.lock.json` in it, and `report.json` if you write
  one. Nothing else: no upload, archive, commit or push. The portal takes the bundle directory
  and discards anything you write beside it, and it ignores your own validation result.
- **No network access.** The step is given none, and no credential. Anything you need is in the
  inputs or shipped with you. A module that calls a service at run time cannot be run.
- **No clock and no randomness in the output** (constraint 6).
- You can be called as a library or as a command. You told us you offer both; the portal will
  call the library function. Two things are still needed from you before the portal can run
  you: **a licence for the module itself**, and **what you give `ajv`**. Ajv compiles a schema
  to JavaScript. Giving it the contract's schemas is fine. Giving it a schema taken from the
  customer's spec is compiling a customer's content to code, which the portal does not allow
  in a step it runs; if you do that, say so, and plan to stop.
- A person may still run you by hand against a static build of a portal. The interface is the
  same.
- A portal may hold several APIs, and later several versions of one. You are not affected: each
  is a separate run with its own spec and its own bundle, and nothing in a bundle refers to
  another.

## The contract

The interface is defined in four files in the EZ-DevPortal repository:

- `docs/contracts/guides-contract.md`: the bundle format, in full
- `docs/contracts/guides-manifest.schema.json`: JSON Schema for the manifest
- `docs/contracts/guides-report.schema.json`: JSON Schema for the optional run report
- `docs/contracts/guides-lock.schema.json`: JSON Schema for the generation record (new in 0.3)

Read the contract before designing anything. It is a draft, now at **v0.3**.

**Version 0.3 is the portal side's answer to your feedback on 0.2.** Section 13 of the contract
decides every item under "On v0.2" in your feedback file, and section 12 lists what changed
and marks what binds you. Re-sync your copy of all four files and set `contractVersion` to
`"0.3"`; a portal on 0.3 rejects `"0.2"`. In short:

- The gap in 4.3 is closed your way: a parameter the portal supplies is never sent by a sample
  and never counted as missing. Cookie parameters are among them.
- A fault in one page now withholds that page (`page-error`) and no longer stops the bundle,
  whoever wrote the page. Twenty-two codes changed severity; your validator must follow.
- Your edit tracking moves out of `report.json` into `guides.lock.json`, with a hash for every
  page. You read nothing from the existing `report.json`.
- A page a person deleted stays deleted (`deleted` in the record).
- `{{unique}}` and `{{unique_1}}` to `{{unique_9}}` exist. `{{idempotency_key}}` and
  `{{unique}}` are valid only inside a `<Sample>` block.
- Settings are an input, and their only source is `settings.json` in the bundle.
- `specProblems` and `extensions` in the report have defined members and limits. Rename yours
  to match, or the report is `invalid-report` and ignored.
- Several `<Steps>` on a page is confirmed.

Parts of 0.3 have not been through the portal's security review yet and may be tightened.

How 0.2 came about: version 0.2 was the portal side's answer to the guides module's feedback on
v0.1. Section 11 of the contract decides every proposal and assumption of that round by number,
and section 10 lists what changed in it, including the corrections the portal's security
review and re-review required, the product decisions of 2026-11-27 (which spec you generate
from, how incomplete pages get finished, that the portal runs you and delivers your output as
a pull request, and that an unfinished page holds back only itself) and the security review
of that day. All of it still holds in 0.3 except where section 12 says otherwise.

If the contract cannot express something the guides need, say so and propose a change. Do not
work around it.

## The constraints that shape your design

1. **Never write API request code.** To show an API call, emit a `<Sample operation="…">` with the
   values to send. The portal generates the code in every language. Hand-written `curl` or SDK calls
   in a guide are a contract violation. Ordinary code blocks are fine for everything else: install
   commands, config files, webhook handlers.
2. **Refer to the spec by identifier.** Operations by `operationId`, schemas by component name.
   Never write URLs to reference pages; use `op:`, `schema:` and `guide:` links.
3. **Content is data.** No raw HTML and no scripts. Only the components listed in the contract. The
   portal is multi-tenant, evaluates nothing in a bundle, and rejects any tag it does not know.
4. **Sample values must be valid.** Inline request values are validated against the operation's
   schema. Prefer named examples already in the spec where they exist. Do not write credentials
   into samples; the portal adds them. There is no credential variable: `{{api_key}}` is not
   available to bundles, and anywhere a variable is recognised it is `unknown-variable`. The names
   `api_key`, `access_token`, `username` and `password` belong to the portal and cannot be
   `capture` names, and neither can a name matching `unique(_[0-9]+)?`. A sample also cannot
   set the headers the portal controls or a name that carries a credential; the list and the
   definition are in section 4.3 of the contract. Where a spec declares such a header as a
   required parameter, leave it out: the portal supplies it, and it does not count as missing.
   For a field that must be new on every run, write `{{unique}}`, or `{{unique_1}}` to
   `{{unique_9}}` where a later step sends the same value again, inside a longer string where
   the field needs more: `"branch_code": "B{{unique_1}}"`. The value is eight digits, always a
   string (section 4.6).
5. **Generate from the published spec, and record its hash.** Your input is not the customer's
   original spec. The portal's spec doctor proposes fixes (missing auth schemes, servers,
   examples, `operationId`s), the customer accepts some, and the portal publishes the patched
   document as a file. That file, the **published spec**, is what you generate from (contract
   section 1.2). It comes from the portal: it is an output of the portal's publish step. The
   portal passes you its bytes when it runs you. You fetch nothing: there is no URL to read it
   from, and you have no network access. A static build writes the file beside the portal's
   other output as `spec/openapi.yaml` or `spec/openapi.json`, and a person running you by hand
   passes that file. Take the bytes as an input and do not build in where they come from. Put
   the SHA-256 of its bytes, exactly as you received them, in the manifest as `spec.sha256`. Do
   not parse and
   re-serialize before hashing. When the customer accepted no fixes the published spec is their
   original document, byte for byte. When the published spec changes, for example because the
   customer accepts one more fix, the portal reports your existing bundle as out of date
   (`spec-hash-mismatch`) until you regenerate from the new file.
6. **Be deterministic and stable.** This was "where you can"; it is now a requirement (contract
   4.7), because every regeneration is shown to a person as a pull request and its difference
   must show only real changes.
   - *Deterministic:* the same inputs give a byte-identical bundle directory, `report.json`
     included. The inputs are the published spec bytes, the existing bundle if given, the
     bytes of its `settings.json` and your version. Nothing from the clock, randomness, locale, environment or
     directory listing order. Leave `generatedAt` out when the portal runs you.
   - *Stable:* a file changes between runs only for a reason in the inputs. When the spec
     changes, a page that does not depend on what changed comes out byte for byte as before,
     with the same slug and the same place in `nav`. No rewrapping, key reordering or whitespace
     changes without cause. `guides.json` changes with every spec change because `spec.sha256`
     does; that is expected.
7. **External links pass one regex.** An `https://` link must match the pattern in section 4.5 and
   contain no `\`: a lowercase ASCII host, an optional port, then printable ASCII only. Write an
   internationalized host in its `xn--` form and percent-encode spaces and non-ASCII characters.
   The regex is all you implement; you need no URL parser.
8. **Regenerating must not revert a person's edits.** The bundle lives in the customer's Git
   repository. A person finishes a `<Todo>` or a `draft` page by editing the page file there,
   and the portal ingests the new commit (contract 4.7). The portal does its part: your output
   reaches the repository only as a pull request, which a person reviews and merges, and the
   portal never commits to the ingested branch. Your part:
   - Accept the existing bundle directory as an optional input. It is the bundle as it stands
     on the branch the portal ingests from, edits included.
   - When it is given, no change a person made to a page since you wrote it is dropped or
     reverted in your output. Emitting an edited page byte for byte as given always conforms.
     Merging new content into an edited page conforms only if every change the person made
     survives.
   - When it is not given (a first run, or before the customer has connected a repository),
     generate in full.

   - Recognise an edited, added or deleted page from `guides.lock.json`, the generation
     record, exactly as the table in contract 5.3 says, and write the record on every run. It
     holds a hash for every page you wrote. With no valid record, keep every existing page and
     the navigation as they are.
   - Do not write again a page a person deleted. Carry its slug under `deleted`.
   - Read nothing from the existing bundle's `report.json`. A person may delete that file.

   Still your design: whether you keep an edited page whole or merge into it; and what you do
   with an edited page that no longer fits the new spec, for example one that names a removed
   operation, provided you keep the person's text and say so in `report.json`. Such a page
   now withholds only itself. The bundle root allows no other file of your own. If you need
   an input beyond the published spec and the existing bundle, ask for it. An edited page is
   held to every rule of the contract, like a generated one, and gets the same finding.
9. **Settings come from the bundle, and nowhere else.** The customer's settings for you are
   the file `settings.json` at the bundle root, at most 64 KB, kept in their repository. The
   portal passes you its bytes unchanged and does not look inside; what it contains is yours
   to define and to document for the customer. Emit the file byte for byte as you were given
   it, never create or change it, and record the SHA-256 of the bytes you used as
   `settingsSha256` in the generation record. With no file, run with no settings. Treat the
   settings as data from the customer. Remember what they do: a setting that shows an `x-`
   field puts its values on public pages, and those fields often hold internal notes, so show
   nothing by default.

## What good output looks like

- A **quickstart** that gets a reader from nothing to a first successful call: get credentials,
  authenticate, make one call, read the response. This matters more than any other page. For
  "get credentials" you write nothing about how keys are issued: the portal shows a "get a key"
  link, from a URL its customer supplies, beside the place a reader enters a key (contract 9).
  Do not leave a `<Todo>` only because the spec does not say how keys are issued; you may still
  list it in `report.json`. No variable or component stands for that link in 0.3.
- **How-to guides** organized around what the reader is trying to do, not around the endpoint list.
  A guide that restates the reference adds nothing.
- **Multi-step flows** that carry values from one call to the next, using `capture`. Only a
  string, number or boolean can be captured, and the portal fills a captured value into a later
  sample or code block only when it is safe to (section 4.6), so capture identifiers, not objects
  or free text. In an ordinary code block that means 1 to 256 characters from
  `A-Z a-z 0-9 _ . : ~ -`, starting with a letter, a digit or `_`.
- **Cross-cutting pages** where the spec supports them: authentication, errors, pagination,
  idempotency, rate limits, webhooks.
- Honest gaps. Specs are often thin. Where the spec does not say something, do not invent it.
  Leave it out, or mark it with `<Todo>` and a page `status` so a human can complete it. Marked
  content shows in the portal's preview and **withholds its own page** from the published
  portal until a person resolves it by editing the page in the bundle's Git repository
  (constraint 8). It does not hold back the rest of the bundle: the other pages are published
  (decided 2026-11-27; contract 4.7). Before the customer connects a repository nobody can edit
  the page, and it stays withheld. So mark what a person must supply, and leave out what is
  merely absent.
- Pages that stand without each other. A withheld page has no URL and no place in navigation,
  and a `guide:` link or `<Card>` `href` that points at it is published as plain text or an
  unlinked card. The portal reports each such link as the warning `link-to-withheld-page`, and
  your validator should too. So a page that readers need, the quickstart above all, should not
  carry a `<Todo>` for something it could leave out, and a published page should still read
  correctly when a page it links to is missing. A fault in one page's content (`page-error`)
  also withholds only that page. A problem of severity `error`, which is now a fault in the
  bundle's structure, stops the whole bundle.

## Specs you should expect

Real specs are frequently incomplete: missing `operationId`s, no examples, sparse descriptions,
undocumented error responses, inconsistent naming. Decide deliberately how the module behaves on
weak input, and report what it could not do. The published spec you receive may have had some of
this repaired by fixes the customer accepted, but do not count on it. Swagger 2.0 is out of scope:
the portal rejects it, so you will not be given one.

Some specs list servers the portal will not call: `http://`, localhost, or a server variable that
could point anywhere. The portal calls `https` servers only. Your samples still render for those
specs; the portal withholds "Try it" and tells its customer through the spec doctor. You do nothing
different.

Where an `operationId` is missing, the portal derives one: the lowercase method, immediately
followed by the path with each character outside `A-Z a-z 0-9` replaced by `_`. No separator is
added between the two; the path's leading `/` becomes the underscore. So `get` and `/payments/{id}`
give `get_payments__id_`. Two paths can produce the same id (`/a-b` and `/a_b`), and real specs
repeat explicit ids, so the contract fixes a collision rule as well. Implement section 1.1 of the
contract exactly, including its ordering, so both projects derive identical identifiers. Both
sides run it on the published spec. A portal fix that adds an `operationId` writes exactly the
derived id, so an id is the same before and after the customer accepts that fix.

Real specs also use ids such as `gists/create`. The contract accepts any id: verbatim in attributes
and frontmatter, percent-encoded in link targets where a character is outside the listed set.

## Definition of done for a first version

- Given a valid OpenAPI 3.0 or 3.1 document, the module writes a bundle that validates against the
  manifest schema and follows every rule in the contract.
- It includes its own validator for the contract rules, so a bundle is checked before it leaves.
- It is tested against at least three public specs of different size and quality.
- It reports, per run, which pages it produced and what it skipped and why. The report may be
  included in the bundle as `report.json` in the shape the contract defines.
- It writes a bundle directory and nothing more. Transport into the portal is the portal's concern.
- It runs with no network access, from the published spec bytes, an optional existing bundle
  and that bundle's `settings.json`.
- Run twice on the same inputs, it writes byte-identical directories.
- Run a second time with a bundle directory that a person has edited as input, it keeps those
  edits; and a page untouched by a spec change is byte-identical before and after.

## Questions the portal side asked in v0.1

All four are answered; see section 8 of the contract. In short: no diagrams, video or widgets in
0.3; one bundle per spec version; localization is out of scope; `tryIt="false"` disables "Try it"
for a sample.

Decided on 2026-11-27 and listed in the same section: guides are generated from the published
spec; incomplete content is resolved by a person in Git, and until then it withholds its own
page and not the bundle; Swagger 2.0 is out of scope; a portal
customer lists the allowed hosts of a server with an open host variable as an `enum` in the
published spec (this does not affect you); the portal runs you and delivers your bundle as a
pull request; the portal passes you the published spec; the portal shows the "get a key" link;
one bundle belongs to one version of one API.

Still open, and listed in the same section: the design of the portal's GitHub App and of
ingestion (milestone M5; not yours), capturing values whose keys are not plain identifiers,
linking to webhook documentation, specs split over several files (the published spec and its
hash cover the root document only), whether a guide can ask for the "get a key" link at a
particular place, a generated value for a number field, a dashboard screen for choosing
extension roles, and whether a generated page should be published before anyone has run it.
