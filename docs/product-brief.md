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
| Guides come from another project | A separate module generates guides from specs. We ingest and render them under `docs/contracts/guides-contract.md`. We do not author or generate guides. |
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
| Proof of domain control before a portal is public | Decided 2026-11-27, built in M4. **Public** means reachable by anyone who is not signed in to our dashboard as a member of that tenant's account: a portal on our host, under the customer's subpath or on a custom domain, its Markdown twins and `llms.txt`, and its MCP endpoint. **Before verifying**, a tenant gets a private preview: the whole portal, branded from any site URL, visible only to signed-in members and not indexable. **Which domain for what:** (1) to make a portal public, the tenant has verified the domain of the website it is branded from; (2) "Try it" and the MCP send only to server hosts under a domain the tenant has verified, and a server on another domain needs its own verification; until then they are withheld for that server and samples still render, the same treatment as a server that is not callable. Hosts listed by the allowed-hosts fix (B) are bound by rule 2 like any other. Nothing from M2 or M3 is offered as a public hosted service before this exists. Basis: product manager's judgment about abuse (a look-alike portal; the proxy as a relay), not research. The verification methods, what counts as "under" a domain, shared-hosting hosts, re-checking and where the check is enforced are for the architect and the security reviewer. |
| Public Suffix List licence exception | Decided 2026-11-27. One file, `public_suffix_list.dat` from publicsuffix.org, is vendored and shipped under MPL 2.0 as data, unmodified, with its licence text beside it. MPL 2.0 does not become a permitted licence for code dependencies; the policy in ADR 0001 is otherwise unchanged. |
| Risky assets use a separate origin | SVG, PDF, JSON and ZIP are served from a per-tenant asset origin. Raster images may be served on the page origin after the portal re-encodes them. |
| Guides use the patched spec | The portal publishes the spec with accepted spec-doctor fixes applied, and guides are generated from that file. The bundle's hash is of its bytes. |
| Guides are edited in Git | A person resolves a `<Todo>` or a draft page by editing the bundle in Git. The portal never edits bundles. Regenerating guides must not overwrite those edits. |
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
2. **M2**: request proxy, "Try it", and the API MCP on top of it
3. **M3**: brand extraction
4. **M4**: multi-tenancy, onboarding, private preview, proof of domain control before a portal is
   public, then verified domain suffixes for server hosts
5. **M5**: guides ingestion, search, docs MCP
6. **M6**: custom domains, billing, analytics. Custom domains reuse M4's domain verification and
   add routing and TLS.

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
- **"Try it" in a private preview.** Default: withheld for a server whose domain is not verified,
  even for a signed-in member, so an unverified trial shows the reference and samples but no live
  call. Loosening it needs the security reviewer. Decide before M4 scope is set.
- **API servers on a domain the tenant cannot verify**, such as a cloud provider's host name.
  Default: not callable through "Try it" or the MCP. Decide before M4 scope is set.
- **An operation that reads but is not `GET`**, such as a `POST` search. Default: it is a write,
  so the tenant must enable it and the agent's client may ask for approval. Decide before M2.
- **Whether to split M4**, and how.
