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

The interface is defined in three files in the EZ-DevPortal repository:

- `docs/contracts/guides-contract.md`: the bundle format, in full
- `docs/contracts/guides-manifest.schema.json`: JSON Schema for the manifest
- `docs/contracts/guides-report.schema.json`: JSON Schema for the optional run report

Read the contract before designing anything. It is a draft, now at **v0.2**. Version 0.2 is the
portal side's answer to the guides module's feedback on v0.1: section 11 of the contract decides
every proposal and assumption by number, and section 10 lists what changed, including the
corrections the portal's security review and re-review required before 0.2 was released and the
product decisions of 2026-11-27 (which spec you generate from, and how incomplete pages get
finished) and the security review of that day (where the published spec can be fetched from). A module built against v0.1 must re-sync its copy of all three files and set
`contractVersion` to `"0.2"`; a portal on 0.2 rejects `"0.1"`. A module that synced 0.2 before
2026-11-27 must sync again. If
the contract cannot express something the guides need, say so and propose a change. Do not work
around it.

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
   `capture` names. A sample also cannot set the headers the portal controls; the list is in
   section 4.3 of the contract.
5. **Generate from the published spec, and record its hash.** Your input is not the customer's
   original spec. The portal's spec doctor proposes fixes (missing auth schemes, servers,
   examples, `operationId`s), the customer accepts some, and the portal publishes the patched
   document as a file. That file, the **published spec**, is what you generate from (contract
   section 1.2). It comes from the portal: it is an output of the portal's publish step. A static
   build writes it beside the portal's other output as `spec/openapi.yaml` or
   `spec/openapi.json`, unless the person running the build omits it and hands you the same
   bytes another way. A hosted portal does not offer it for public download by default, so do
   not assume a public URL: you will fetch it over an authenticated path that is not designed
   yet (milestone M5). Take the bytes as an input and do not build in where they come from. Put
   the SHA-256 of its bytes, exactly as you received them, in the manifest as `spec.sha256`. Do
   not parse and
   re-serialize before hashing. When the customer accepted no fixes the published spec is their
   original document, byte for byte. When the published spec changes, for example because the
   customer accepts one more fix, the portal reports your existing bundle as out of date
   (`spec-hash-mismatch`) until you regenerate from the new file.
6. **Be deterministic where you can.** The same spec and settings should produce the same slugs and
   navigation, so URLs stay stable across regenerations.
7. **External links pass one regex.** An `https://` link must match the pattern in section 4.5 and
   contain no `\`: a lowercase ASCII host, an optional port, then printable ASCII only. Write an
   internationalized host in its `xn--` form and percent-encode spaces and non-ASCII characters.
   The regex is all you implement; you need no URL parser.
8. **Regenerating must not overwrite a person's edits.** The bundle lives in a Git repository.
   A person finishes a `<Todo>` or a `draft` page by editing the page file there, and the portal
   ingests the new commit; the portal never edits a bundle (contract 4.7). So when you run again
   on a bundle that people have edited, including after the published spec changed, their edits
   must survive. How you do that is your design: tell the portal side what you chose. An edited
   page is held to every rule of the contract, like a generated one.

## What good output looks like

- A **quickstart** that gets a reader from nothing to a first successful call: get credentials,
  authenticate, make one call, read the response. This matters more than any other page.
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
  content shows in the portal's preview and blocks publishing until a person resolves it by
  editing the page in the bundle's Git repository (constraint 8).

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
- Run a second time over a bundle directory that a person has edited, it keeps those edits.

## Questions the portal side asked in v0.1

All four are answered; see section 8 of the contract. In short: no diagrams, video or widgets in
0.2; one bundle per spec version; localization is out of scope; `tryIt="false"` disables "Try it"
for a sample.

Decided on 2026-11-27 and listed in the same section: guides are generated from the published
spec; incomplete content is resolved by a person in Git; Swagger 2.0 is out of scope; a portal
customer lists the allowed hosts of a server with an open host variable as an `enum` in the
published spec (this does not affect you).

Still open, and listed in the same section: transport (for milestone M5: how a commit of the
bundle reaches the portal, and the authenticated path by which you fetch the published spec when
the portal is hosted),
capturing values whose keys are not plain identifiers, linking to webhook documentation, and
specs split over several files (the published spec and its hash cover the root
document only).
