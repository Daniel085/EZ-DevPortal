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

## The contract

The interface is defined in two files in the EZ-DevPortal repository:

- `docs/contracts/guides-contract.md`: the bundle format, in full
- `docs/contracts/guides-manifest.schema.json`: JSON Schema for the manifest
- `docs/contracts/guides-report.schema.json`: JSON Schema for the optional run report

Read the contract before designing anything. It is a draft, now at **v0.2**. Version 0.2 is the
portal side's answer to the guides module's feedback on v0.1: section 11 of the contract decides
every proposal and assumption by number, and section 10 lists what changed. A module built against
v0.1 must re-sync its copy of all three files and set `contractVersion` to `"0.2"`; a portal on 0.2
rejects `"0.1"`. If the contract cannot express something the guides need, say so and propose a
change. Do not work around it.

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
   into samples; the portal adds them.
5. **Record the spec hash.** Put the SHA-256 of the exact spec document you generated from in the
   manifest, so the portal can detect guides that are out of date.
6. **Be deterministic where you can.** The same spec and settings should produce the same slugs and
   navigation, so URLs stay stable across regenerations.

## What good output looks like

- A **quickstart** that gets a reader from nothing to a first successful call: get credentials,
  authenticate, make one call, read the response. This matters more than any other page.
- **How-to guides** organized around what the reader is trying to do, not around the endpoint list.
  A guide that restates the reference adds nothing.
- **Multi-step flows** that carry values from one call to the next, using `capture`.
- **Cross-cutting pages** where the spec supports them: authentication, errors, pagination,
  idempotency, rate limits, webhooks.
- Honest gaps. Specs are often thin. Where the spec does not say something, do not invent it.
  Leave it out, or mark it with `<Todo>` and a page `status` so a human can complete it. Marked
  content shows in the portal's preview and blocks publishing until a new bundle resolves it.

## Specs you should expect

Real specs are frequently incomplete: missing `operationId`s, no examples, sparse descriptions,
undocumented error responses, inconsistent naming. Decide deliberately how the module behaves on
weak input, and report what it could not do.

Where an `operationId` is missing, the portal derives one: the lowercase method, immediately
followed by the path with each character outside `A-Z a-z 0-9` replaced by `_`. No separator is
added between the two; the path's leading `/` becomes the underscore. So `get` and `/payments/{id}`
give `get_payments__id_`. Two paths can produce the same id (`/a-b` and `/a_b`), and real specs
repeat explicit ids, so the contract fixes a collision rule as well. Implement section 1.1 of the
contract exactly, including its ordering, so both projects derive identical identifiers.

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

## Questions the portal side asked in v0.1

All four are answered; see section 8 of the contract. In short: no diagrams, video or widgets in
0.2; one bundle per spec version; localization is out of scope; `tryIt="false"` disables "Try it"
for a sample.

Still open, and listed in the same section: transport (for milestone M5), capturing values whose
keys are not plain identifiers, and linking to webhook documentation.
