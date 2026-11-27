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

- **Inputs:** the bytes of the published spec (constraint 5), and optionally the existing bundle
  directory (constraint 8). Nothing else varies between runs except your own settings and
  version.
- **Output:** a bundle directory, with `report.json` in it if you write one. Nothing else: no
  upload, archive, commit or push.
- **No network access.** The step is given none, and no credential. Anything you need is in the
  inputs or shipped with you. A module that calls a service at run time cannot be run.
- **No clock and no randomness in the output** (constraint 6).
- You can be called as a library or as a command. The portal side has not chosen; tell us which
  you offer, how it is pinned to a version, and the licences of what you depend on.
- A person may still run you by hand against a static build of a portal. The interface is the
  same.
- A portal may hold several APIs, and later several versions of one. You are not affected: each
  is a separate run with its own spec and its own bundle, and nothing in a bundle refers to
  another.

## The contract

The interface is defined in three files in the EZ-DevPortal repository:

- `docs/contracts/guides-contract.md`: the bundle format, in full
- `docs/contracts/guides-manifest.schema.json`: JSON Schema for the manifest
- `docs/contracts/guides-report.schema.json`: JSON Schema for the optional run report

Read the contract before designing anything. It is a draft, now at **v0.2**. Version 0.2 is the
portal side's answer to the guides module's feedback on v0.1: section 11 of the contract decides
every proposal and assumption by number, and section 10 lists what changed, including the
corrections the portal's security review and re-review required before 0.2 was released, the
product decisions of 2026-11-27 (which spec you generate from, how incomplete pages get
finished, and that the portal runs you and delivers your output as a pull request) and the
security review of that day. A module built against v0.1 must re-sync its copy of all three
files and set `contractVersion` to `"0.2"`; a portal on 0.2 rejects `"0.1"`. A module that
synced 0.2 before section 6 read "Decided by the user on 2026-11-27" must sync again. If
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
     included. The inputs are the published spec bytes, the existing bundle if given, your
     settings and your version. Nothing from the clock, randomness, locale, environment or
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

   Still your design, and tell the portal side what you chose: how you tell a page a person
   edited from one you wrote; and what you do with an edited page that no longer fits the new
   spec, for example one that names a removed operation, provided you keep the person's text
   and say so in `report.json`. The bundle root allows no file of your own; `report.json`
   accepts extra members. If you need an input beyond these two, such as your own previous
   output, ask for it. An edited page is held to every rule of the contract, like a generated
   one.

## What good output looks like

- A **quickstart** that gets a reader from nothing to a first successful call: get credentials,
  authenticate, make one call, read the response. This matters more than any other page. For
  "get credentials" you write nothing about how keys are issued: the portal shows a "get a key"
  link, from a URL its customer supplies, beside the place a reader enters a key (contract 9).
  Do not leave a `<Todo>` only because the spec does not say how keys are issued; you may still
  list it in `report.json`. No variable or component stands for that link in 0.2.
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
  editing the page in the bundle's Git repository (constraint 8). Before the customer
  connects a repository nobody can edit it, and the page is withheld. So mark what a person
  must supply, and leave out what is merely absent.

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
- It runs with no network access, from the published spec bytes and an optional existing bundle.
- Run twice on the same inputs, it writes byte-identical directories.
- Run a second time with a bundle directory that a person has edited as input, it keeps those
  edits; and a page untouched by a spec change is byte-identical before and after.

## Questions the portal side asked in v0.1

All four are answered; see section 8 of the contract. In short: no diagrams, video or widgets in
0.2; one bundle per spec version; localization is out of scope; `tryIt="false"` disables "Try it"
for a sample.

Decided on 2026-11-27 and listed in the same section: guides are generated from the published
spec; incomplete content is resolved by a person in Git; Swagger 2.0 is out of scope; a portal
customer lists the allowed hosts of a server with an open host variable as an `enum` in the
published spec (this does not affect you); the portal runs you and delivers your bundle as a
pull request; the portal passes you the published spec; the portal shows the "get a key" link;
one bundle belongs to one version of one API.

Still open, and listed in the same section: the design of the portal's GitHub App and of
ingestion (milestone M5; not yours), capturing values whose keys are not plain identifiers,
linking to webhook documentation, specs split over several files (the published spec and its
hash cover the root document only), and whether a guide can ask for the "get a key" link at a
particular place.
