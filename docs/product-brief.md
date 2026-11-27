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
| Open host variables | Decided 2026-11-27: "B now, C later". A server such as `https://{host}/v1` with no listed values is not callable, so "Try it" and MCP are withheld for it. **B:** the spec doctor's finding for an uncallable server carries a fix that takes the allowed host values as input and stores them in the spec patch like any other fix. Once it is accepted the server is callable for those hosts. **C, planned for M4b** (moved from M6 on 2026-11-27): a verified domain suffix. The tenant proves control of a domain once and any host under it is allowed. It uses the domain verification M4b builds, comes last in M4b, needs its own security review first, and is the first thing cut from M4b. |
| Free private preview, pay to publish | Decided 2026-11-27. The preview is built in M4a and publishing in M4b. This is the one definition of the private preview. Anyone who signs in can supply a spec URL and a site URL and get, at no charge, a **private preview**: the whole portal, branded from any site URL, visible only to signed-in members of that tenant's account and not indexable. **The private preview is the free trial**; there is no other. **Nothing of a preview is readable without sign-in**: not its pages, Markdown twins or `llms.txt`, and not the published spec or the per-tenant asset origin, which have their own URLs (ADR 0003, "Who can read it"). Its MCP is off. Its "Try it" runs in example-response mode (the row after next), except for a server whose host the tenant has verified, where it makes live calls (the row after that; from M4b). **Publishing**, which is making the portal public as the next row defines it, needs both a plan and domain verification. **A plan is required to go public, not to make live calls in a preview.** **Until M6 builds billing we set a tenant's plan by hand**; the gate itself is built in M4b. |
| Proof of domain control before a portal is public | Decided 2026-11-27, built in M4b. **Public** means reachable by anyone who is not signed in to our dashboard as a member of that tenant's account: a portal on our host, under the customer's subpath or on a custom domain, its Markdown twins and `llms.txt`, and its MCP endpoint. **Before verifying**, a tenant has the private preview defined in the row above. **Which domain for what:** (1) to make a portal public, the tenant has verified the domain of the website it is branded from; (2) "Try it" and the MCP send only to server hosts under a domain the tenant has verified, and a server on another domain needs its own verification; until then they are withheld for that server and samples still render, the same treatment as a server that is not callable, except in a private preview, where "Try it" runs in example-response mode for that server (next row) and the MCP is off whatever is verified. Hosts listed by the allowed-hosts fix (B) are bound by rule 2 like any other. Nothing from M2 or M3 is offered as a public hosted service before this exists. Basis: product manager's judgment about abuse (a look-alike portal; the proxy as a relay), not research. The verification methods, what counts as "under" a domain, re-checking and where the check is enforced are for the architect and the security reviewer. A host the tenant cannot verify by DNS is decided in the row "API hosts that cannot be verified by DNS". |
| "Try it" in a private preview: example-response mode | Decided 2026-11-27, and narrowed the same day by the next row. In a private preview, for any server that is not both callable and on a host the tenant has verified, the console works but sends nothing: **no request leaves the browser**. It returns the example response the spec declares for the operation, **clearly labelled as an example**, with a prompt to verify the domain for live calls. **Where the spec declares no example for a response, the console says so and invents nothing**; the values we synthesize for request samples are not used as a response. **The MCP is off in a private preview.** This closes the question of rule 2 in a preview without loosening it: nothing is sent to an unverified server. **Ownership:** M2 builds the mode in the console (the example shown, its label, the no-example message, no request sent), since it is console behaviour and needs only the M1 model; M4a makes it the state of every private preview and keeps the MCP off. In M4a the console states that live calls need a verified host and offers no action, because verification does not exist until M4b; M4b turns that statement into the prompt that starts verification (product manager's scope, so that no M4a story depends on M4b). Not decided, with a default in "Open product decisions": which example is shown when an operation has several responses. |
| Live calls in a private preview | Decided by the user 2026-11-27. **A private preview allows live "Try it" calls to a server whose host the tenant has verified; for any other server it is in example-response mode** (previous row). This overrides any assumption that every preview is example mode. **Timing:** the preview is M4a and verification is M4b, so in M4a every preview is in example-response mode, and live calls in a preview begin when M4b ships verification. **A plan is required to go public, not to make live calls in a preview**; verifying a domain needs no plan. **The MCP stays off in a private preview**, verified or not: an MCP endpoint an agent can reach is "public" by the definition two rows up, and the user's decision names live calls, not the MCP. That is the product manager's reading and is listed in "Open product decisions" for the user to confirm. **Abuse exposure, for the security reviewer and the architect:** an account that has paid nothing can send requests through our proxy. The bounds are that live calls in a preview are for signed-in members of that tenant only, to verified hosts only, and rate-limited. The limit's values, how the proxy checks membership (on a public portal its callers are anonymous), and whether a verified host name that resolves to someone else's address is a route around "verified hosts only" (inference, not checked) are theirs to settle before M4b. The member's own API credential is still passed through and never stored. |
| API hosts that cannot be verified by DNS | Decided by the user 2026-11-27, for a host such as a cloud provider's API gateway or app-hosting host name. **At launch (M4b):** the documented answer is to put the API on a domain the customer controls and verify that domain as normal. Where they do not, there are no live calls for that server: samples render, "Try it" and the MCP are withheld for it, and in a private preview "Try it" stays in example-response mode. The tenant is told this, and what to do, when verifying and at the moment of going public. **Deferred, built only if customers ask:** an exact-host HTTP challenge as a second verification method. It would verify one exact host and never a suffix, and needs its own security review. **Rejected:** manual approval by us. No evidence: how many customers are affected is not known, and no option was checked with a customer. |
| Public Suffix List licence exception | Decided 2026-11-27. One file, `public_suffix_list.dat` from publicsuffix.org, is vendored and shipped under MPL 2.0 as data, unmodified, with its licence text beside it. MPL 2.0 does not become a permitted licence for code dependencies; the policy in ADR 0001 is otherwise unchanged. |
| Risky assets use a separate origin | SVG, PDF, JSON and ZIP are served from a per-tenant asset origin. Raster images may be served on the page origin after the portal re-encodes them. |
| Guides use the patched spec | The portal publishes the spec with accepted spec-doctor fixes applied, and guides are generated from that file. The bundle's hash is of its bytes. |
| Guides are edited in Git | A person resolves a `<Todo>` or a draft page by editing the bundle in the customer's Git repository. We offer no editor for a bundle and change one only by proposing a pull request (next row). Regenerating guides must not overwrite those edits. |
| Guide bundles reach the customer's repository by pull request | Decided 2026-11-27. **Once a repository is connected**, our GitHub App proposes the generated bundle as a pull request on the customer's repository; they review, edit and merge; the portal ingests from that repository. A regeneration arrives as a pull request too, so a person reviews the diff and hand edits are not overwritten silently. **Before a repository is connected**, we generate and hold the guides, read-only: there is nowhere to edit, so a page that contains a `<Todo>` or is not marked ready stays unpublished (next row). The App has write access to customer repositories, which needs a security review before it is designed. **Ownership:** M4c builds the App, connecting a repository and the ability to open a pull request; M5 builds everything specific to guides (see Milestones). Contract sections 4.7 and 6 predate this and are the architect's to amend. |
| An incomplete guide page withholds only itself | Decided 2026-11-27, built in M5. A page that contains a `<Todo>`, or whose status is not ready, is withheld; **the rest of the bundle publishes**. This holds whether we hold the bundle or it is in the customer's repository. **A link to a withheld page renders as plain text**, not as a link. This replaces "one `<Todo>` blocks the whole bundle" in contract 4.7, which the architect is amending. Inference, not part of the decision: a withheld page also has no Markdown twin, `llms.txt` entry or search result. What happens to its navigation entry is the architect's and UX's. |
| Reader keys: a link in M2, a handoff later, no accounts | Decided 2026-11-27. **M2, with "Try it":** the customer supplies a "get a key" URL; the quickstart and authentication pages link to it; the reader pastes a key into "Try it", where it is held in their browser only and never stored by us. **Later, a paid-tier feature, in no milestone yet:** a sign-in handoff, where the customer's site passes the signed-in reader's keys to the portal so samples show the reader's own key. **Cut:** us issuing or managing developer accounts and keys. That is an API management product and out of scope. Evidence for the link: the guides module reports that a spec does not say how a key is issued. |
| Multiple and versioned APIs | Decided 2026-11-27. **M4d:** several APIs in one portal with a product switcher, one spec and one guide bundle per API. Because portals go public in M4b, before the switcher exists, the public URL shape must already allow a second API by then (see Milestones). **Later, in no milestone yet:** versions of one API with a version switcher, each version with its own spec and guides. The data model is shaped for both from the start: content is keyed by project, API and version. M1 is unaffected, since the engine takes one spec in. |
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
4. **M4**, in four parts, built in this order (decided 2026-11-27; detail below):
   - **M4a, tenancy and private preview**: sign-in, projects, fixes in the dashboard, the free
     private preview with nothing readable without sign-in, "Try it" in example-response mode
     in every preview, MCP off
   - **M4b, going public**: the gate on publishing (a plan set by hand, and proof of domain
     control), public portals on our host and under a subpath, live "Try it" and MCP for
     verified servers, live "Try it" in a private preview for a verified server (members only,
     rate-limited, no plan needed, MCP still off), telling a tenant what to do about a host it
     cannot verify by DNS, suspend, abuse intake, then verified domain suffixes last
   - **M4c, the Git connection**: the GitHub App (connect a repository, spec sync, open a pull
     request), private spec sources, behaviour when the source breaks
   - **M4d, more APIs and operating**: multiple APIs per portal with a product switcher,
     rollback, team members and roles, operator tooling
5. **M5**: running the guides module, guides held by us before a repository is connected, bundle
   and regeneration pull requests, guides ingestion from the customer's repository, search, docs
   MCP
6. **M6**: custom domains, billing, analytics. Custom domains reuse M4b's domain verification and
   add routing and TLS. Billing replaces plans set by hand.

**The M4 split** (the user decided on 2026-11-27 that M4 is split; the parts are the product
manager's scope). Every M4 story is in exactly one part; the list is in
`docs/product/user-stories.md`, "The M4 split".

| Part | At the end of it | Needs | Why in this place |
|---|---|---|---|
| **M4a** | **Demoable, and the free trial.** Anyone can sign in, give a spec URL and a site URL, and see their own branded portal privately, with a console that shows example responses. Nothing is public and nothing can be sold. | M1 to M3 | No public surface, so no verification and no abuse process are needed. Not reading the published spec or the asset origin without sign-in is in this part, because the preview is where that rule applies. |
| **M4b** | **Sellable.** A tenant with a plan and a verified domain has a public portal on our host or under their subpath, with live "Try it" and MCP. A tenant without a plan that has verified a server's host has live "Try it" in its private preview. We can suspend a tenant and take an abuse report. | M4a | Everything that must be true the first time a stranger can reach a portal is in one part, so the minimum for running a public service is never deferred. The verified domain suffix is last and the first thing to cut. |
| **M4c** | **Sellable as "stays correct without effort".** A tenant connects a repository through the GitHub App and the portal republishes when the spec changes. | M4a; the App's security review | Kept small and on its own because M5's bundle and regeneration pull requests need the App. It does not depend on M4b, so it may be built alongside it. It must be complete before that part of M5. |
| **M4d** | **Sellable to larger customers, and cheaper for us to run.** Several APIs in one portal, rollback, team members and roles, support and upgrade tooling. | M4b | Needed to keep and grow customers, not to get the first one. It gates nothing in M5 and may run alongside it. It holds no "must" story. |

Two conditions the order creates. Content is keyed by project, API and version from M4a, and the
public URL shape must allow a second API before M4b publishes anything; otherwise M4d changes
public URLs that readers have saved. That is the architect's to settle before M4b. And the plan
gate in M4b works with plans set by hand until M6.

**Later, in no milestone:** versions of one API, the sign-in handoff for reader keys (paid tier),
static export, and an exact-host HTTP challenge for API hosts that cannot be verified by DNS.
The trigger for the last is customer demand: it is built only if customers ask, verifies one
exact host and never a suffix, and needs its own security review first.

**Who owns what for guides in Git** (decision of 2026-11-27):

| Part | Owner |
|---|---|
| The GitHub App: install, choose a repository, disconnect; its permissions and their security review | M4c |
| Reading a connected repository and republishing the spec when it changes | M4c |
| Opening a pull request on a customer's repository, first used for the patched spec | M4c |
| Running the guides module for a tenant, and running it again when the published spec changes | M5 |
| Holding generated guides before a repository is connected | M5 |
| Withholding a page that is not ready, wherever the bundle is held, and rendering links to it as plain text | M5 |
| Proposing a bundle, and each regeneration, as a pull request, using M4c's App | M5 |
| Ingesting a merged bundle from the repository, validating, previewing and publishing it | M5 |

M5's pull requests and its ingestion from a repository depend on M4c's App. Guides held by us do
not, so M5 can start once M4a exists.

**Effect on size** (product manager's judgment, not an estimate from the developers): M4 is
materially larger (multiple APIs, an App with write access where sync alone needed read access,
the plan gate). M5 is materially larger: it was ingestion of a bundle someone else produced and is
now also operating the generator, storing its output and proposing pull requests. M2 is not
materially larger by the key link (one configured URL and a link); it also gains the console's
example-response mode, which is small and sends nothing.

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

To confirm with the user. Both follow from the two decisions of 2026-11-27 on unverifiable hosts
and live calls in a preview; each has a default that stands meanwhile.

- **The MCP in a private preview whose server host is verified.** The user's decision allows
  live "Try it" calls there and does not mention the MCP. Default, as the product manager's
  reading: the MCP stays off in every private preview, because an MCP endpoint an agent can
  reach is "public" by our definition, and public needs a plan. Confirm before M4b scope is set.
- **A server on an unverifiable host, on a public portal.** The decision says "Try it" and the
  MCP are withheld and that "Try it" stays in example-response mode. Default reading: withheld
  with a reason on a public portal, example-response mode in a private preview. The other
  reading puts example-response mode on public portals, which is the third item below and new
  scope for M2.

Raised by the decisions of 2026-11-27. Each has a default that stands until someone objects.

- **Which example the console shows** when an operation documents several responses or several
  named examples, and what counts as a declared example. For UX and the architect. Default: the
  first documented success response; only examples the spec declares; nothing synthesized.
- **Example-response mode outside a preview.** Default: no. On a public portal a server that is
  not callable or not verified keeps "Try it" withheld with a reason. Using the mode there would
  be new scope for M2.
- **Where the "get a key" link shows in M2.** The quickstart is a guide and arrives in M5; M1 has
  no authentication page. Default: M2 shows the link in "Try it" and wherever the reference
  states the credential; the quickstart carries it from M5.
- **Does review by pull request replace "regenerating must not overwrite edits"?** Default: no.
  The guides module still keeps a person's edits, and the pull request is a second check.
