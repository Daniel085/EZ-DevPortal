# EZ-DevPortal Product Brief

Shared context for everyone working on this project, including the agents in `.claude/agents/`.
Keep it short and current. When a decision changes, change it here.

## Product

A hosted, multi-tenant SaaS that generates branded developer portals for other companies from their
existing OpenAPI specs. The quality bar is Stripe, Twilio and Vonage.

A customer supplies a spec URL and their website URL. They get a portal that looks native to their
site, with an API reference, multi-language code samples, a "Try it" console, and an MCP server
that lets AI agents call their API.

## Decisions made

| Decision | Detail |
|---|---|
| Hosted SaaS | We host the portals. Customers do not self-host by default. |
| Static export stays possible | A later enterprise tier. Core pages must not depend on per-request server logic. |
| Subpath hosting | `host.com/docs` by reverse proxy is the headline hosting mode. It makes the page same-origin with the customer's site, so their licensed fonts load without us hosting them. |
| Guides come from a separate module, which we run | A separate project, the guides module, generates guides from the published spec. Decided 2026-11-27: we run it for every tenant, and a customer installs nothing. The portal still writes no guide content: it ingests and renders bundles under `docs/contracts/guides-contract.md`. This replaces "we do not author or generate guides", which left open who ran the generator. |
| Guide content is data | Restricted Markdown with a closed component set. No MDX, raw HTML or scripts. Tenant content is never executed. |
| Guides never contain API request code | They name an operation and values; the portal renders the sample in every language. |
| API MCP is a headline feature | Not an add-on. Built on the same request proxy as "Try it". |
| MCP tool design | Four meta-tools: find operations, describe an operation, call a read operation, call a write operation. Not one tool per endpoint. Decided 2026-11-27: the call tool is split so that an MCP client can require its user's approval for writes only. The server refuses a write operation sent to the read tool. Default until the architect defines it: a read is `GET` or `HEAD`, everything else is a write. |
| MCP and proxy credentials | The end user's own credentials, passed through per request, never stored by us. |
| MCP writes | Read-only by default. Write operations are enabled by the tenant per operation, enforced server-side. |
| Spec repair is core | A "spec doctor" lints the spec and proposes fixes for auth schemes, servers and examples before anything is published. |
| Sample languages | Eight in M1: cURL, JavaScript, Python, Go, Java, C#, PHP, Ruby. |
| OpenAPI versions | 3.0 and 3.1. A 3.2 document is read as 3.1. Swagger 2.0 is rejected with a clear message. |
| Operation ids | Declared ids are used verbatim. Missing ones are derived by the rule in section 1.1 of the guides contract, which is normative for both projects. |
| Credentials are placed only by the portal | Guides and specs cannot name the reader's credential. Only the sample generator places it. |
| Proxy and MCP are `https` only | For a server on `http://` or localhost, samples still render but "Try it" and MCP are withheld, with a spec-doctor finding. |
| Open host variables | Decided 2026-11-27: "B now, C later". A server such as `https://{host}/v1` with no listed values is not callable, so "Try it" and MCP are withheld for it. **B:** the spec doctor's finding for an uncallable server carries a fix that takes the allowed host values as input and stores them in the spec patch like any other fix. Once it is accepted the server is callable for those hosts. **C, planned for M4** (moved from M6 on 2026-11-27): a verified domain suffix. The tenant proves control of a domain once and any host under it is allowed. It uses the domain verification M4 now builds, comes after it, and needs its own security review first. |
| Free private preview, pay to publish | Decided 2026-11-27, built in M4. This is the one definition of the private preview. Anyone who signs in can supply a spec URL and a site URL and get, at no charge, a **private preview**: the whole portal, branded from any site URL, visible only to signed-in members of that tenant's account and not indexable. **Publishing**, which is making the portal public as the next row defines it, needs both a plan and domain verification. Whether "Try it" runs in a preview is open (see open decisions). |
| Proof of domain control before a portal is public | Decided 2026-11-27, built in M4. **Public** means reachable by anyone who is not signed in to our dashboard as a member of that tenant's account: a portal on our host, under the customer's subpath or on a custom domain, its Markdown twins and `llms.txt`, and its MCP endpoint. **Before verifying**, a tenant has the private preview defined in the row above. **Which domain for what:** (1) to make a portal public, the tenant has verified the domain of the website it is branded from; (2) "Try it" and the MCP send only to server hosts under a domain the tenant has verified, and a server on another domain needs its own verification; until then they are withheld for that server and samples still render, the same treatment as a server that is not callable. Hosts listed by the allowed-hosts fix (B) are bound by rule 2 like any other. Nothing from M2 or M3 is offered as a public hosted service before this exists. Basis: product manager's judgment about abuse (a look-alike portal; the proxy as a relay), not research. The verification methods, what counts as "under" a domain, shared-hosting hosts, re-checking and where the check is enforced are for the architect and the security reviewer. |
| Public Suffix List licence exception | Decided 2026-11-27. One file, `public_suffix_list.dat` from publicsuffix.org, is vendored and shipped under MPL 2.0 as data, unmodified, with its licence text beside it. MPL 2.0 does not become a permitted licence for code dependencies; the policy in ADR 0001 is otherwise unchanged. |
| Risky assets use a separate origin | SVG, PDF, JSON and ZIP are served from a per-tenant asset origin. Raster images may be served on the page origin after the portal re-encodes them. |
| Guides use the patched spec | The portal publishes the spec with accepted spec-doctor fixes applied, and guides are generated from that file. The bundle's hash is of its bytes. |
| Guides are edited in Git | A person resolves a `<Todo>` or a draft page by editing the bundle in the customer's Git repository. We offer no editor for a bundle and change one only by proposing a pull request (next row). Regenerating guides must not overwrite those edits. |
| Guide bundles reach the customer's repository by pull request | Decided 2026-11-27. **Once a repository is connected**, our GitHub App proposes the generated bundle as a pull request on the customer's repository; they review, edit and merge; the portal ingests from that repository. A regeneration arrives as a pull request too, so a person reviews the diff and hand edits are not overwritten silently. **Before a repository is connected**, we generate and hold the guides, read-only: there is nowhere to edit, so a page that contains a `<Todo>` or is not marked ready stays unpublished. The App has write access to customer repositories, which needs a security review before it is designed. **Ownership:** M4 builds the App, connecting a repository and the ability to open a pull request; M5 builds everything specific to guides (see Milestones). Contract sections 4.7 and 6 predate this and are the architect's to amend. |
| Reader keys: a link in M2, a handoff later, no accounts | Decided 2026-11-27. **M2, with "Try it":** the customer supplies a "get a key" URL; the quickstart and authentication pages link to it; the reader pastes a key into "Try it", where it is held in their browser only and never stored by us. **Later, a paid-tier feature, in no milestone yet:** a sign-in handoff, where the customer's site passes the signed-in reader's keys to the portal so samples show the reader's own key. **Cut:** us issuing or managing developer accounts and keys. That is an API management product and out of scope. Evidence for the link: the guides module reports that a spec does not say how a key is issued. |
| Multiple and versioned APIs | Decided 2026-11-27. **M4:** several APIs in one portal with a product switcher, one spec and one guide bundle per API. **Later, in no milestone yet:** versions of one API with a version switcher, each version with its own spec and guides. The data model is shaped for both from the start: content is keyed by project, API and version. M1 is unaffected, since the engine takes one spec in. |
| Security review is recorded | Design reviews are kept in `docs/reviews/`. |
| Themes are data | Design tokens as CSS variables. A brand extractor reads the customer's site and produces tokens, with a manual override editor. |

## Architecture

One TypeScript monorepo with four parts:

1. **Engine**: a pure library with no I/O. OpenAPI in; normalized model, reference pages, code
   samples, search index, Markdown twins and spec-doctor findings out.
2. **Renderer**: one multi-tenant Next.js app. Resolves hostname to tenant, loads published content
   and theme, serves cached pages.
3. **Brand extractor**: a headless-browser service that turns a site URL into design tokens.
4. **Control plane**: dashboard, auth, projects, spec upload and Git sync, publish pipeline, request
   proxy, MCP endpoints, custom domains, billing.

## Milestones

1. **M1**: engine, spec doctor, reference, samples, Markdown twins and `llms.txt`
2. **M2**: request proxy, "Try it", the API MCP on top of it, and the customer's "get a key" link
3. **M3**: brand extraction
4. **M4**: multi-tenancy, onboarding, the free private preview, the gate on publishing (a plan and
   proof of domain control), multiple APIs per portal with a product switcher, the GitHub App
   (connect a repository, spec sync, open a pull request), then verified domain suffixes for
   server hosts
5. **M5**: running the guides module, guides held by us before a repository is connected, bundle
   and regeneration pull requests, guides ingestion from the customer's repository, search, docs
   MCP
6. **M6**: custom domains, billing, analytics. Custom domains reuse M4's domain verification and
   add routing and TLS.

**Later, in no milestone:** versions of one API, the sign-in handoff for reader keys (paid tier),
static export.

**Who owns what for guides in Git** (decision of 2026-11-27):

| Part | Owner |
|---|---|
| The GitHub App: install, choose a repository, disconnect; its permissions and their security review | M4 |
| Reading a connected repository and republishing the spec when it changes | M4 |
| Opening a pull request on a customer's repository, first used for the patched spec | M4 |
| Running the guides module for a tenant, and running it again when the published spec changes | M5 |
| Holding generated guides before a repository is connected, and withholding pages that are not ready | M5 |
| Proposing a bundle, and each regeneration, as a pull request, using M4's App | M5 |
| Ingesting a merged bundle from the repository, validating, previewing and publishing it | M5 |

M5's pull requests depend on M4's App. Guides held by us do not, so M5 can start without it.

**Effect on size** (product manager's judgment, not an estimate from the developers): M4 is
materially larger (multiple APIs, an App with write access where sync alone needed read access,
the plan gate). M5 is materially larger: it was ingestion of a bundle someone else produced and is
now also operating the generator, storing its output and proposing pull requests. M2 is not
materially larger: one configured URL and a link.

M4 is larger than one milestone. A proposal to split it into three is in
`docs/product/user-stories.md`, "Proposal: splitting M4". It is not decided.

User stories for all six milestones, with what is covered and what no milestone owns yet, are in
`docs/product/user-stories.md`.

## What the research found

Researched 2026-11-26. Confidence reflects source quality; several figures were seen only in search
summaries.

| Finding | Evidence | Confidence |
|---|---|---|
| Docs are missing or out of date | Postman: lack of documentation was the top obstacle to using an API, 52–55% each year 2020–2023. SmartBear 2023: 52% of providers say docs are out of sync with the API. | High |
| The spec itself is wrong | Study of 50 real APIs (arXiv 2507.16044): 62% of failed calls traced to missing or incorrect security schemes, 47% to undocumented headers or token prefixes. About 19 lines of spec fixes per API raised tool success from 76.5% to 99.9%. | Medium |
| Examples are absent or do not run | One analysis found 87% of specs lack parameter examples. | Medium |
| Errors, enums and edge cases are undocumented | Recurring developer complaints. No survey data. | Low |
| Poor search and discovery | Postman 2025: 34% cannot find existing APIs. | Medium |
| `oneOf`/`anyOf` render badly | Open bugs in Swagger UI, Redoc and ReadMe. | Medium |
| Agent safety worries buyers | Postman 2025: 51% worry about unauthorized or excessive agent calls. | Medium |
| `llms.txt` is rarely fetched | Ahrefs, 137,000 domains: 97% of files had zero requests. Per-page Markdown and MCP carry the agent traffic. | Medium |

**Table stakes**, shipped by every leading tool: OpenAPI-driven reference, "Try it" console,
multi-language snippets, custom domain, Git sync, AI search, `llms.txt` and Markdown page variants,
a docs-search MCP.

**Open differentiators:** an API MCP with real safety controls, spec repair, samples tested against
the API, full white-label at lower price tiers.

**Known MCP client limits:** Cursor caps at 40 tools and 60-character tool names and rejects `$ref`
and `anyOf` in tool schemas. Some clients reject `oneOf` and `allOf`.

**An API MCP alone is not a differentiator.** ReadMe, Stainless and Speakeasy already ship one. Ours
has to win on safety and reliability.

## Open product decisions

- **Whether readers see that a sample uses synthesized values.** M1 default: buyers only.
- **Multi-file specs:** a fix accepted in a `$ref`'d file reaches the portal but not the guides
  module, because the published spec covers the root document only. Does not block M1.
- **An operation that reads but is not `GET`**, such as a `POST` search. Default: it is a write,
  so the tenant must enable it and the agent's client may ask for approval. Decide before M2.

Open with the user, not decided. Decide each before M4 scope is set.

- **(a) Whether to split M4.** Options: (1) one M4; (2) three parts: M4a tenancy and private
  preview, M4b going public, M4c staying correct and operating. The decisions of 2026-11-27 add
  to the question: multiple APIs has no part yet, and M5's pull requests need the GitHub App,
  which the proposal puts in M4c.
- **(b) "Try it" in a private preview against an unverified server.** Options: (1) withheld, the
  current default, so a free preview shows the reference and samples but no live call; (2)
  allowed for signed-in members of the tenant only, which loosens rule 2 of domain control and
  needs the security reviewer; (3) withheld, and the preview shows something else in its place,
  such as the exact request that would be sent and an example response from the spec.
- **(c) An API on a domain the customer cannot verify**, such as a cloud provider's host name.
  Options: (1) accept that it has no "Try it" or MCP, the current default; samples still render;
  (2) a different proof that works for one exact host, to be designed by the security reviewer;
  (3) the customer puts the API behind a host name on a domain they can verify. Option 3 is the
  product manager's suggestion and has not been checked with any customer.

Raised by the decisions of 2026-11-27. Each has a default that stands until someone objects.

- **Pay to publish arrives before billing.** Publishing is M4 and billing is M6. Default: M4
  builds the gate and we set a tenant's plan by hand; M6 adds self-serve payment.
- **Withholding a guide page, not the bundle.** Guides held by us publish page by page; contract
  4.7 blocks a whole bundle on one `<Todo>`. Default: page by page only while we hold the guides;
  after a repository is connected, 4.7 as written. What a link to a withheld page does is
  undesigned. For the architect.
- **Where the "get a key" link shows in M2.** The quickstart is a guide and arrives in M5; M1 has
  no authentication page. Default: M2 shows the link in "Try it" and wherever the reference
  states the credential; the quickstart carries it from M5.
- **Does review by pull request replace "regenerating must not overwrite edits"?** Default: no.
  The guides module still keeps a person's edits, and the pull request is a second check.
