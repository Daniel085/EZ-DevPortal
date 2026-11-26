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

Read the contract before designing anything. It is a draft (v0.1) proposed by the portal side. If
it cannot express something the guides need, say so and propose a change. Do not work around it.

## The constraints that shape your design

1. **Never write API request code.** To show an API call, emit a `<Sample operation="…">` with the
   values to send. The portal generates the code in every language. Hand-written `curl` or SDK calls
   in a guide are a contract violation. Ordinary code blocks are fine for everything else: install
   commands, config files, webhook handlers.
2. **Refer to the spec by identifier.** Operations by `operationId`, schemas by component name.
   Never write URLs to reference pages; use `op:`, `schema:` and `guide:` links.
3. **Content is data.** No raw HTML, no JSX expressions, no imports, no scripts. Only the components
   listed in the contract. The portal is multi-tenant and will reject anything else.
4. **Sample values must be valid.** Inline request values are validated against the operation's
   schema. Prefer named examples already in the spec where they exist.
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
  Leave it out, or mark the page so a human can complete it.

## Specs you should expect

Real specs are frequently incomplete: missing `operationId`s, no examples, sparse descriptions,
undocumented error responses, inconsistent naming. Decide deliberately how the module behaves on
weak input, and report what it could not do.

Where an `operationId` is missing, the portal derives one as `{method}_{path}` with non-alphanumeric
characters replaced by `_`, for example `get_payments__id_`. Use the same rule so identifiers match.

## Definition of done for a first version

- Given a valid OpenAPI 3.0 or 3.1 document, the module writes a bundle that validates against the
  manifest schema and follows every rule in the contract.
- It includes its own validator for the contract rules, so a bundle is checked before it leaves.
- It is tested against at least three public specs of different size and quality.
- It reports, per run, which pages it produced and what it skipped and why.

## Questions the portal side needs answered

These are listed in section 8 of the contract. The most important:

1. Is there content you need that the contract cannot express (diagrams, video, widgets)?
2. Do guides need to span more than one spec version?
3. Is localization in scope?
