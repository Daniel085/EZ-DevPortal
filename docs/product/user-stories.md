# User Stories: M1 to M6

Status: first full pass, 2026-11-27. Owner: product manager. No code exists yet. Updated the same
day for four decisions by the user: eleven proposals for M1 criteria adopted, which amended two
criteria and added five (31 in all), the Public Suffix List
licence exception, the MCP call tool split into read and write, and proof of domain control before
a portal is public, built in M4. Updated again that day for four more: we run the guides module
and deliver bundles by pull request; reader keys (a link in M2, a handoff later, accounts cut); a
free private preview and pay to publish; multiple APIs in M4 and versions later. Updated a third
time that day for three more: M4 is split into four parts; "Try it" in a private preview runs in
example-response mode and the MCP is off there; an incomplete guide page withholds only itself.
Updated a fourth time that day for the last two questions open with the user: what happens to an
API host that cannot be verified by DNS, and live "Try it" calls in a private preview for a
verified server. Updated on 2026-11-28 for four more decisions by the user: the doctor report is
private by default (M1 criterion 32, new, so `m1.md` has 32 criteria); `example-missing` offers
no fix; the fetch cap per document is 16 MiB; and one rule for the console, which is in
example-response mode wherever live calls are not allowed, on a public portal as in a private
preview, and is never absent. Statuses, counts, conflicts and questions below reflect all
seventeen.

Sources read: `docs/product-brief.md`, `CLAUDE.md`, `docs/milestones/m1.md`,
`docs/milestones/m1-build-kickoff.md`, `docs/contracts/guides-contract.md` (sections 1.2, 4.7, 5,
6, 8, 9), `docs/contracts/guides-module-status.md`, ADRs 0003 to 0006 and both files in
`docs/reviews/`.

## Do we have all the user stories?

**No.** Before this file there were none written as stories, and the plan covered two kinds of
user. This pass finds 13 actors and 154 stories:

| Status | Count | Meaning |
|---|---|---|
| **C** covered | 23 | An M1 acceptance criterion already checks it. |
| **P** planned | 86 | Named in a decision, ADR, contract section or milestone title, but with no acceptance criteria yet. It would probably get built; what "done" means is not written. |
| **N** new | 43 | Nothing in the current plan would have caused it to be built. |
| **X** cut | 2 | Decided not to be built. The row says why. |

Before the decisions of 2026-11-27 the counts were 129 stories: 18, 55 and 56. What moved with the
first four decisions: SM-3, SM-5, SM-8 and SM-9 from planned to covered (M1 criteria 8, 10, 28, 29,
31); AH-4, OP-3, OP-4, EV-1 and SU-8 from new to planned; SU-19 added as planned. That gave 130:
22, 57 and 51.

What moved with the second four: EV-2, SU-15, DW-10, GM-5, RD-6, RD-15 and RD-26 from new to
planned; RD-6 from M4 to M2; SU-15 from no milestone to M4. Twelve stories added: ten planned
(EV-8, SU-20, SU-21, SU-22, SC-12, DW-11, DW-12, DW-13, RD-27, RD-28), one new (OP-13) and one cut
(RD-29). That gave 142: 22, 74, 45 and 1 cut.

What moved with the third three: five stories added, all planned (EV-9, RD-30, RD-31, SC-13,
OP-14); OP-1 and OP-2 from new to planned, because the split requires suspend and abuse intake in
the part where portals go public; DW-4 rewritten, since it assumed one `<Todo>` blocks a whole
bundle; and every M4 story given one of M4a to M4d. Other stories placed in a part by judgment
stay new: a place in the split is not a decision to build each one. That gave 147: 22, 81, 43
and 1 cut.

What moved with the fourth two: six stories added, five planned (EV-10, SU-23, SU-24, SU-25,
OP-15) and one cut (OP-16, manual approval of a host by us). EV-9 rewritten: its prompt to verify
moved to M4b (EV-10), because verification does not exist in M4a. EV-1, EV-8, SU-19, SM-8, RD-8,
RD-30, SC-13 and OP-4 had their pointers updated and did not change status. No story changed
status. That gave 153: 22, 86, 43 and 2 cut.

What moved with the four decisions of 2026-11-28: one story added, covered (SM-16, the private
doctor report, M1 criterion 32). RD-8 rewritten: it said that on a public portal "Try it" stays
withheld with a reason, and the console is now in example-response mode there and never absent.
SM-1, SM-7, SM-8, SU-1, SU-23, SU-24, SC-8 and RD-30 had their wording or pointers updated and
did not change status. No story was added for the `example-missing` fix or for the fetch cap:
neither had a story of its own. That gives 154: 23, 86, 43 and 2 cut.

What the existing documents cover well: the reader's first call from the reference (M1), the spec
doctor's findings, agents reading Markdown, the guides contract, and the security rules for the
proxy and for rendering.

What they do not cover, by the kinds of gap that were asked about:

| Kind of gap | Found? | Where |
|---|---|---|
| Lifecycle | **Yes, large.** Rollback, deleting a project, cancelling and export are all absent. Decided 2026-11-27: the private preview is free and publishing needs a plan; multiple APIs are M4 and versions of one API come later. First publish and spec update are planned by name only. | EV-1, EV-6, EV-8, SU-8, SU-10, SU-15, SU-16, SU-21, AD-3 |
| Failure and unhappy paths | **Yes.** A spec source that goes down, a spec publish that fails halfway, and new findings after an upstream change have no owner. A stale fix now has an M1 criterion (c28). Undoing a fix and a rejected bundle are designed in ADR 0004 and contract 6 but have no criteria. | SU-9, SU-12, SM-4, SM-11, DW-8 |
| Trust and safety | **Yes, the most serious, and partly closed on 2026-11-27.** Decided: proof of domain control before a portal is public and before the proxy calls a server (OP-3, OP-4), and a separate MCP tool for writes (AH-4). Also decided that day: suspend and abuse intake are built in M4b with going public (OP-1, OP-2), and a private preview is readable by no one who is not signed in (SC-13). Also decided that day: live "Try it" calls in a private preview, without a plan, for a verified server (EV-10), which lets an account that has paid nothing send requests through the proxy; the bounds are OP-15. Still open: the agent's human cannot see beforehand what the agent may call or keep it read-only on the server side; there is no call limit and no audit log. | AH-2, AH-3, SC-3 to SC-5 |
| The buyer's reasons to pay and stay | **Yes.** Analytics is a word in M6 with no content. Team members and roles, and SSO are absent. | EV-4, AD-1, SC-10 |
| End developer account features | **Decided 2026-11-27.** A "get a key" link supplied by the customer, in M2 (RD-6, SU-22). A sign-in handoff later, on a paid tier, in no milestone (RD-26). Us issuing or managing developer accounts and keys is cut (RD-29). | RD-6, RD-26, RD-29, SU-22 |
| Accessibility and non-English readers | **Partly.** M1 criterion 22 sets WCAG 2.2 AA for a sample of five M1 pages. Nothing carries that bar to "Try it", search, guides or the dashboard. Non-English spec text is untested; translation is out of scope by contract. | RD-12, RD-13, RD-24, RD-25, SU-17 |
| Our own operation of the service | **Yes, mostly.** Seven of sixteen operator stories are planned (no credentials in logs, the two that domain verification answers, suspend, abuse intake, setting a plan by hand, and the bounds on live calls in a preview). One is cut (OP-16). | OP-1 to OP-16 |

**How to read "new".** A story marked new is not automatically something to build. Nearly all of the
43 new stories rest on the product manager's judgment, not on research in the brief; SC-3, SC-4 and
AH-2 are prompted by one survey figure. The basis column says which. The brief's research is about readers and specs; it has no evidence about what buyers
need to adopt, pay or stay, and none about operating the service.

### Legend

- **M**: the milestone the story belongs to. M4 is split into M4a to M4d, built in that order
  (see "The M4 split"); no story is in plain "M4". "none" means no milestone owns it today. "later"
  means a decision says it will be built after the work it depends on, and names no milestone.
- **Pri**: must, should, could.
- **St**: C, P, N or X as above.
- **Basis**: **E** evidence in the brief's research table or in the guides module's status report;
  **D** a recorded decision; **TS** listed as table stakes in the brief; **J** product manager's
  judgment, no source.
- "c4" means criterion 4 in `docs/milestones/m1.md`. "Contract" means
  `docs/contracts/guides-contract.md`.

## Actors

| Id | Actor | Side | Note |
|---|---|---|---|
| EV | Evaluator and buyer | Provider | Decides to pay. |
| SU | Portal owner | Provider | Sets the portal up, connects the spec, publishes. |
| IN | Web or infrastructure engineer | Provider | Added. Configures the reverse proxy, DNS and CSP that subpath hosting and custom domains need. Often not the portal owner. |
| SM | Spec maintainer | Provider | Acts on spec-doctor findings. |
| DW | Docs owner or technical writer | Provider | Edits guides in Git. |
| SC | Security or compliance reviewer | Provider | Approves the product before purchase and after changes. |
| AD | Account and billing admin | Provider | Members, plan, invoices, cancellation. |
| RD | End developer | Reader | One actor in three situations: first visit, returning, debugging. |
| AR | AI agent reading the docs | Reader | Markdown twins, `llms.txt`, docs MCP. |
| AC | AI agent calling the API | Reader | Through the API MCP. |
| AH | The human who connects that agent | Reader | Supplies the credential and bears the consequences. |
| GM | Guides module | System | The separate project that generates bundles. |
| OP | Our operator or support person | Us | Abuse, offboarding, incidents, upgrades. |

Considered and folded in, not kept as actors: the provider's support or developer-relations person
(served by stable deep links, RD-14 and RD-19); a third party reporting abuse (OP-2); a search
engine crawler (EV-7); the provider's CI system (SU-18); an enterprise customer hosting a static
export (EV-5). "Non-English reader" is an attribute of RD, not an actor.

## Stories

### EV: Evaluator and buyer

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| EV-1 | As an evaluator, I want to give my spec URL and site URL and see a private preview portal for my own API before paying, so that I can judge the product on my real spec. | M4a | must | P | D: "Free private preview, pay to publish", 2026-11-27. The preview is the free trial. In M4a its "Try it" runs in example-response mode in every preview (EV-9); live calls for a verified server begin in M4b (EV-10). Its MCP is off (SC-13). |
| EV-2 | As an evaluator, I want to see what each plan costs and includes, so that I can get the purchase approved. | M6 | should | P | D: publishing needs a plan, 2026-11-27, so plans must exist. What they cost and include is undecided. See conflict 10: the gate is M4b with plans set by hand, billing is M6. |
| EV-3 | As a buyer, I want the portal to carry none of your branding, so that it reads as part of my site. | M3 | should | N | Brief, "Open differentiators" (white-label at lower tiers). No decision, no milestone. |
| EV-4 | As a buyer, I want to see how the portal is used (page views, searches with no result, "Try it" and MCP calls and their error rate), so that I can justify renewing. | M6 | must | P | Brief, M6 "analytics". The contents are J; nothing defines them. |
| EV-5 | As an enterprise buyer, I want a static export I can host myself, so that the portal meets my hosting rules. | none | could | P | D: "Static export stays possible". c21 keeps it possible. No milestone delivers it. |
| EV-6 | As a buyer who is leaving, I want to export my patched spec, accepted fixes, theme tokens and a static copy of the portal, so that I am not locked in. | M6 | should | N | J. Partly enabled by c26 and ADR 0004 (patched spec offered for download). |
| EV-7 | As a buyer, I want portal pages to be indexable by search engines with correct titles, canonical URLs and a sitemap, so that developers find my API. | M4b | should | N | J. |
| EV-8 | As an evaluator with a private preview, I want to see that publishing needs a plan and domain verification, which of the two I still lack, and how to start each, so that I know the whole cost of going live before I commit. | M4b | must | P | D: "Free private preview, pay to publish", 2026-11-27. Until M6 a plan is set by us by hand (OP-14), so "how to start" a plan is a way to contact us. The plan is for going public; live calls in the preview need verification only (EV-10), and the page must not say otherwise. |
| EV-9 | As an evaluator in a private preview, I want "Try it" to work and return the spec's example response, labelled as an example, and to be told that live calls need the server's host verified, so that I can judge the console before I have verified anything and am not misled about what it sent. | M4a | must | P | D: "Try it in a private preview: example-response mode", 2026-11-27. No request leaves the browser. The mode itself is built in M2 (RD-30); M4a makes it the state of every preview, since verification does not exist until M4b. Rewritten: the prompt that starts verification moved to EV-10 (M4b), so this story needs nothing from M4b. In M4a the statement offers no action. |
| EV-10 | As an evaluator in a private preview, I want the console's prompt to take me to verifying the server's host, and once it is verified to make live "Try it" calls as a signed-in member without having a plan, with the console showing per server whether a response is live or an example, so that I can test my real API before I pay. | M4b | must | P | D: "Live calls in a private preview", 2026-11-27 (conflict 19, resolved). A server that is not verified, or not callable, stays in example-response mode. The MCP stays off in the preview; that is the product manager's reading, to be confirmed with the user (conflict 22). Bounds are OP-15. |

### SU: Portal owner

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| SU-1 | As a portal owner, I want to create a project from a spec URL or an uploaded file and be led to a first published portal, so that setup takes minutes. | M4a | must | P | Brief, "Product" and control plane; ADR 0003, "Spec fetch policy". D: "Spec fetch cap", 2026-11-28: a fetched document is capped at 16 MiB (16,777,216 bytes), the same as a local file; the security reviewer confirms the figure when M4 is designed. M4a ends at a private preview; the step to a public portal is M4b (EV-8, SU-19). |
| SU-2 | As a portal owner, I want to connect the spec from a Git repository and have the portal republish when it changes, so that the portal stays correct without effort. | M4c | must | P | TS (Git sync). E: docs out of sync, SmartBear 52%. ADR 0003 says tokens need a reviewed path first. From 2026-11-27 the connection is our GitHub App (SU-20). |
| SU-3 | As a portal owner, I want to use a spec URL that needs a token, so that a private spec can be the source. | M4c | should | P | ADR 0003: not covered by the fetch policy, "need their own reviewed path". Undesigned. |
| SU-4 | As a portal owner, I want an unsupported or unparseable spec rejected with what is wrong and where, so that I can fix it. | M1 | must | C | c5. D: Swagger 2.0 rejected. |
| SU-5 | As a portal owner, I want a spec with local defects to still build, with each defect reported, so that one bad schema does not block the portal. | M1 | must | C | c6. |
| SU-6 | As a portal owner, I want colours, fonts and logo taken from my website URL, so that the portal looks native without design work. | M3 | must | P | D: "Themes are data". |
| SU-7 | As a portal owner, I want to correct any extracted token by hand, so that a wrong extraction is not final. | M3 | must | P | D: manual override editor. |
| SU-8 | As a portal owner, I want to preview the whole portal (spec changes, theme, guides) at a private URL before it goes live, so that readers never see a mistake first. | M4a | must | P | D: "Proof of domain control", 2026-11-27, makes the private preview part of M4; the split puts it in M4a. That it also previews later changes to a live portal, and includes guides, is J. Contract 4.7 gives preview for guides bundles only. |
| SU-9 | As a portal owner, I want a publish to either complete or leave the live portal exactly as it was, and to be told what failed, so that a failure is never visible to readers. | M4a | must | P | Contract 6 says this for bundles; ADR 0003 gives the killable worker. Not stated for spec or theme publishes. |
| SU-10 | As a portal owner, I want to return the live portal to an earlier published version in one action, so that a bad publish is undone in minutes. | M4d | should | N | J. |
| SU-11 | As a portal owner, I want to see what a publish will change (operations added, removed, changed), so that I know what I am approving. | M4d | could | N | J. |
| SU-12 | As a portal owner, I want the live portal kept as it is and a notification sent when my spec source is unreachable or returns an invalid document, so that an outage on my side does not break my docs. | M4c | must | N | J. ADR 0003 turns a failed fetch into a finding; nothing says what the live portal does. |
| SU-13 | As a portal owner, I want to choose which operations "Try it" and the MCP may call, with write operations off until I enable each one, so that nothing is callable that I did not approve. | M2 | must | P | D: "MCP writes". ADR 0003, "an operation the tenant enabled". E: Postman 51%. |
| SU-14 | As a portal owner, I want to turn "Try it" or the MCP off for the whole portal, so that I can stop calls at once. | M2 | must | N | J. Implied by per-operation enabling, not stated. |
| SU-15 | As a portal owner, I want more than one API in one portal, each with its own spec and its own guide bundle, so that all my products are documented in one place. | M4d | should | P | D: "Multiple and versioned APIs", 2026-11-27. Content is keyed by project, API and version from M4a, and public URLs must allow a second API before M4b publishes (conflict 17). The per-API guide bundle arrives with guides in M5. Versions are SU-21. Demand is J. |
| SU-16 | As a portal owner, I want to delete a project and have its portal, spec, fixes, theme and assets stop being served and be removed, so that nothing stale stays online. | M4a | must | N | J. |
| SU-17 | As a portal owner using a keyboard or screen reader, I want the dashboard to meet the same accessibility bar as the portal, so that I can do my job. | M4a | should | N | J. c22 covers portal pages only. |
| SU-18 | As a portal owner, I want to trigger a publish from my CI with a token, so that docs ship with the API. | M4d | could | N | J. |
| SU-19 | As a portal owner, I want to prove control of my website's domain and of each domain my API is served from, and to see what each proof unlocks (going public, "Try it" and MCP for a server), so that I know exactly what stands between my preview and a live portal. | M4b | must | P | D: "Proof of domain control", 2026-11-27. Methods and the meaning of "under a domain" are undesigned: architect and security reviewer. Verifying a server's host also unlocks live "Try it" in the private preview, with no plan (EV-10). A host that cannot be verified is SU-23 and SU-24. |
| SU-20 | As a portal owner, I want to connect a Git repository by installing your GitHub App on the repositories I choose, to see what it can read and write there, and to disconnect it, so that I control what you can touch. | M4c | must | P | D: "Guide bundles reach the customer's repository by pull request", 2026-11-27. Needs a security review before design. That it also carries spec sync (SU-2) and the patched-spec pull request (SM-6) is J. |
| SU-21 | As a portal owner, I want more than one version of an API in one portal, each version with its own spec and guides, so that readers on an older version are served. | later | should | P | D: "Multiple and versioned APIs", 2026-11-27: later, no milestone. `m1.md` still lists versioned docs as "not planned in any milestone". Contract 8: one bundle per spec version. |
| SU-22 | As a portal owner, I want to give the URL where developers get a key for my API, so that the portal can send readers there. | M2 | must | P | D: "Reader keys", 2026-11-27. The dashboard is M4a, so M2 needs a stand-in such as a configuration file (conflict 6). What is accepted as a URL (`https` only, no script) is for the security reviewer. |
| SU-23 | As a portal owner whose API is served from a host I cannot put a DNS record on, such as a cloud provider's gateway or app-hosting host name, I want the verification step and the documentation to say that this host cannot be verified, what that withholds (live "Try it" calls and the MCP for that server; samples still render and the console shows example responses), and that the answer is to serve the API from a domain I control and verify that, so that I do not spend time trying to verify a host that never will. | M4b | must | P | D: "API hosts that cannot be verified by DNS", 2026-11-27 (conflict 9, resolved). How we recognise such a host (the Public Suffix List is one input) is the architect's and security reviewer's. How many customers are affected is not known. |
| SU-24 | As a portal owner about to make my portal public, I want to be told before I confirm which of my servers will have no live "Try it" calls and no MCP because their host is not verified or cannot be, why, and the one thing to do about each, and to be able to go public anyway, so that I am not surprised by a console that returns only examples on a portal my developers can see. | M4b | must | P | D: same decision: the tenant is told clearly at the moment of going public. That an unverifiable server does not block going public is inference from "samples render": rule 1 asks for the website's domain only. What the reader then sees is RD-8: by the decision of 2026-11-28 the console is in example-response mode with the reason shown, not absent. |
| SU-25 | As a portal owner whose API must stay on a provider's host name, I want to prove control of that one exact host by serving a file you name from it, so that it gets live "Try it" and the MCP without my moving the API. | later | could | P | D: same decision: deferred, built only if customers ask. It verifies one exact host and never a suffix, and needs its own security review. Trigger: customer demand, which nobody has measured. |

### IN: Web or infrastructure engineer

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| IN-1 | As the provider's infrastructure engineer, I want exact reverse-proxy instructions for serving the portal under `host.com/docs` and a check that reports what is misrouted, so that subpath hosting works first time. | M4b | must | P | D: "Subpath hosting" is the headline mode. c21 proves the static case. The hosted case is M4b by the split of 2026-11-27. |
| IN-2 | As the provider's infrastructure engineer, I want to point a custom domain at the portal and have ownership verified and TLS issued automatically, so that I add one DNS record and am done. | M6 | must | P | TS. Brief, M6. The ownership check reuses M4b's domain verification (SU-19); routing and TLS are M6. |
| IN-3 | As the provider's infrastructure engineer, I want to be told during setup which origin to allow in my site's `Content-Security-Policy`, so that guide images do not silently fail. | M5 | must | P | Contract 9, "onboarding has to say so". |

### SM: Spec maintainer

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| SM-1 | As a spec maintainer, I want every defect that makes calls fail reported with severity, location, consequence and either a fix or what I must supply or change, so that I know what to change. | M1 | must | C | c8, c9, c10. E: arXiv 2507.16044. D: "No fix writes an example", 2026-11-28: a missing example is reported with no fix, and its message says to declare one. The report is private by default (SM-16). |
| SM-2 | As a spec maintainer, I want to accept or dismiss each fix on its own and have that remembered across spec updates, so that I decide once. | M4a | must | P | `m1.md` out-of-scope table; ADR 0004 (overlay, fingerprint). The hosted doctor report is shown here, in the dashboard, to signed-in members only (ADR 0003, "The doctor report is private"; see SM-16). |
| SM-3 | As a spec maintainer, I want to supply the one fact a fix needs (a token URL, a host), so that a fix that cannot be inferred can still be applied. | M1 | must | C | c10 as amended 2026-11-27 (with the input the finding goes, without it the finding stays and names the input); c31 for refused values. ADR 0004 (`inputs`, `bindFix`). |
| SM-4 | As a spec maintainer, I want to undo an accepted fix, so that a wrong fix from the doctor is not permanent. | M1 | must | P | Contract 1.2 and ADR 0004 anticipate removal. In M1 this is editing the overlay file. No criterion. |
| SM-5 | As a spec maintainer, I want to be told when an accepted fix no longer applies because my spec changed, with every other fix still applied, so that a stale fix is neither misapplied nor silent. | M1 | must | C | c28, added 2026-11-27. ADR 0004, step 3. |
| SM-6 | As a spec maintainer, I want the patched spec as a file or a pull request, so that I can fix the source and stop depending on the overlay. | M1 | should | P | c26 writes the file. ADR 0004, step 4 mentions the pull request (M4c). The pull request is opened by the GitHub App (SU-20). |
| SM-7 | As a spec maintainer, I want to see which operations use synthesized sample values, so that I know where to add real examples. | M1 | must | C | c7. E: 87% of specs lack examples. From 2026-11-28 the list is in the private doctor report (SM-16), and adding the examples is the maintainer's work: no fix writes one (c9, c10). |
| SM-8 | As a spec maintainer, I want to see which servers and operations have live "Try it" calls and the MCP withheld and why, so that I can make them callable. | M1 | must | C | c8 as amended 2026-11-27 names both findings; c29 checks the host rule row by row. Effect is visible in M2, where the console for such a server is in example-response mode with the reason shown and the MCP's call tools are withheld (decision of 2026-11-28; RD-8). From M4b live calls can also be withheld because a server's domain is not verified, or cannot be verified by DNS; how that is shown to the tenant is undesigned (SU-19, SU-23, SU-24). |
| SM-9 | As a spec maintainer, I want to list the allowed hosts for a server with an open host variable by accepting a fix, so that "Try it" and MCP work for it. | M1 | must | C | c10, c29, c31. D: brief, "Open host variables", option B. The fix and the CLI are M1; the proxy honouring the list is M2 (AC-3), and from M4b each listed host must also be under a verified domain. |
| SM-10 | As a spec maintainer, I want to prove control of a domain once and have every host under it allowed, so that I do not list each host. | M4b | should | P | D: option C, moved from M6 to M4 on 2026-11-27 because the verification it depends on is now M4b. Last in M4b, after verification and its own security review, and the first thing cut from M4b. Demand is J. |
| SM-11 | As a spec maintainer, I want to be notified when a spec update brings new findings, so that a regression is caught without my checking. | M4c | should | N | J. |
| SM-12 | As a spec maintainer, I want samples run against my real API and the results shown to me, so that I know the samples work, not only that they parse. | M2 | should | P | Brief, "Open differentiators"; `m1.md` out-of-scope table. See conflict 3. |
| SM-13 | As a maintainer of a multi-file spec, I want a fix accepted in a referenced file to reach the guides too, so that the reference and guides agree. | none | could | P | Brief, open decision "Multi-file specs". In M1 a `$ref` to another document is not followed at all (`m1.md`, out-of-scope table); resolving one is M4. |
| SM-14 | As a spec maintainer, I want to keep operations I mark as internal out of the portal, twins, search and MCP, so that one spec serves internal and public use. | none | should | N | J. No research in the brief. |
| SM-15 | As a spec maintainer, I want webhooks and callbacks listed as "not rendered", so that I know they are missing by design. | M1 | should | P | `m1.md` out-of-scope table promises it. ADR 0004 now names the findings, `webhook-not-rendered` and `callback-not-rendered`. No criterion. |
| SM-16 | As a spec maintainer, I want the list of my spec's defects kept out of the public portal unless I choose to include it, and the build to tell me where it wrote the report, so that my API's faults are not advertised to readers and I can always find the report. | M1 | must | C | c32, added 2026-11-28. D: "The doctor report is private by default". ADR 0003, "The doctor report is private". Not covered: the default report directory sits beside the export, so deploying both publishes it. The hosted half (the portal and asset origins never serve the report; the dashboard shows it to members) is M4 and has no criteria yet; see SM-2 and SC-8. |

### DW: Docs owner or technical writer

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| DW-1 | As a docs owner, I want a commit of the guides bundle to reach the portal without manual upload steps, so that Git is the only place I work. | M5 | must | P | D: 2026-11-27, the portal ingests from the customer's connected repository. Contract 6 still lists transport as open; the architect's to amend. |
| DW-2 | As a docs owner, I want every problem in a bundle reported at once with file and line, so that I fix them in one pass. | M5 | must | P | Contract 5. |
| DW-3 | As a docs owner, I want to preview a staged bundle with each `<Todo>` shown as a marked placeholder, so that I can see what is left. | M5 | must | P | Contract 4.7. |
| DW-4 | As a docs owner, I want a page that contains a `<Todo>` or is not marked ready to be withheld on its own while the rest of the bundle publishes, and to be told which pages are withheld and why, so that a placeholder never reaches a reader and one unfinished page does not hold back the finished ones. | M5 | must | P | D: "An incomplete guide page withholds only itself", 2026-11-27. Rewritten: it said publishing of the whole bundle was blocked, as contract 4.7 did; the architect is amending 4.7. Applies whether we hold the bundle or it is in a repository. |
| DW-5 | As a docs owner, I want my edits kept when guides are regenerated, so that my work is not lost when the spec changes. | M5 | must | P | D: "Guides are edited in Git". Contract 4.7. Built by the guides module; needs a joint test. From 2026-11-27 a regeneration is also reviewed as a pull request (DW-12). |
| DW-6 | As a docs owner, I want to be told when the live guides were generated from an older spec than the one published, so that I regenerate them. | M5 | must | P | Contract 1.2 (`spec-hash-mismatch`). |
| DW-7 | As a docs owner, I want the generator's run report (skipped pages, gaps, spec problems) in the dashboard, so that I know what the guides do not cover. | M5 | should | P | Contract 5.2: the portal "may" show it. |
| DW-8 | As a docs owner, I want a rejected bundle to leave the live guides unchanged, so that a bad commit is harmless. | M5 | must | P | Contract 6. |
| DW-9 | As a docs owner, I want images in guides to display on the portal, so that guides can show diagrams and screenshots. | M5 | should | P | D: "Risky assets use a separate origin". Contract 9, the three-browser acceptance test. |
| DW-10 | As a docs owner, I want to know who runs the generator and to receive a first bundle without installing anything, so that guides are part of the product and not a project of mine. | M5 | must | P | D: 2026-11-27: we run the generator; the bundle is held by us until a repository is connected, then lives in the customer's repository. |
| DW-11 | As a docs owner who has connected a repository, I want the generated bundle proposed as a pull request there, which I can review, edit and merge, so that nothing enters my repository or my portal without my approval. | M5 | must | P | D: "Guide bundles reach the customer's repository by pull request", 2026-11-27. Uses M4c's App (SU-20). |
| DW-12 | As a docs owner, I want each regeneration to arrive as a pull request showing what changed, so that I review the diff and my hand edits are never replaced without my seeing it. | M5 | must | P | D: same decision. Whether this replaces or adds to DW-5 is conflict 12. |
| DW-13 | As a docs owner who has not connected a repository, I want to see the guides you generated, which pages are published, which are held back and why, and that connecting a repository is how I finish them, so that I know what readers see. | M5 | must | P | D: same decision: held by us, read-only; a page with a `<Todo>` or not marked ready stays unpublished. Withholding by page is now the rule everywhere (DW-4; conflict 11, resolved). |

### SC: Provider's security or compliance reviewer

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| SC-1 | As a security reviewer, I want a written statement of how developer credentials are handled that I can check against behaviour, so that I can approve "Try it" and the MCP. | M2 | should | N | J. The rule exists (standing constraint; ADR 0003). The document for buyers does not. |
| SC-2 | As a security reviewer, I want the MCP read-only by default, with writes enabled per operation and enforced on the server, so that an agent cannot do what we did not allow. | M2 | must | P | D: "MCP writes". E: Postman 51%. |
| SC-3 | As a security reviewer, I want a record of "Try it" and MCP calls (operation, time, status; no credentials or bodies), so that I can investigate an incident. | M2 | should | N | J, prompted by E: Postman 51% worry about unauthorized or excessive calls. |
| SC-4 | As a security reviewer, I want limits on how many calls an agent can make through the MCP, so that a runaway agent is contained. | M2 | should | N | J, prompted by the same finding ("excessive"). |
| SC-5 | As a security reviewer, I want a record of who accepted a fix, published, or enabled a write operation, so that changes are attributable. | M4d | should | N | J. |
| SC-6 | As a security reviewer, I want hostile text in a spec to be shown as inert text, so that our docs cannot attack our developers. | M1 | must | C | c19. Standing constraint. |
| SC-7 | As a security reviewer, I want files from guides that can carry script to be unable to run in my site's origin, so that a docs author cannot take over site sessions. | M5 | must | P | D: "Risky assets use a separate origin". Review finding M5. |
| SC-8 | As a security reviewer, I want to know that the published spec file includes comments and vendor extensions, and to control who can fetch it, so that nothing internal leaks. | M4b | must | P | ADR 0003: "who may fetch it" is M4 and M5 design. This story is the public portal; in a private preview the file is not readable without sign-in at all (SC-13, M4a). Kickoff, security gate on the published spec. The M1 part (the CLI's notice and `--no-published-spec`) is checked by c27. The doctor report is a second file that must not leak: on a public portal neither the portal origin nor the asset origin serves it (ADR 0003, "The doctor report is private"; SM-16). |
| SC-9 | As a security reviewer, I want portal pages served under my origin to set no cookies and load no third-party scripts, so that subpath hosting adds no risk to my site. | M4b | should | N | J. Follows from the subpath decision; nowhere stated. |
| SC-10 | As a security reviewer, I want the dashboard to accept single sign-on from our identity provider, so that access follows our joiner and leaver process. | none | could | N | J. No evidence of demand. |
| SC-11 | As a compliance reviewer, I want to know where data is stored, who the subprocessors are, and that data is deleted on termination, so that I can sign the contract. | none | should | N | J. Mostly documents, not software. |
| SC-12 | As a security reviewer, I want your GitHub App limited to the repositories we select, with the least access that lets it open a pull request, and unable to change our default branch directly, so that I can approve installing it. | M4c | must | P | D: 2026-11-27: the App's write access needs a security review before it is designed. The three limits named here are J until that review. |
| SC-13 | As a security reviewer, I want nothing of our private preview readable by anyone who is not signed in as a member of our account (pages, Markdown twins, `llms.txt`, the published spec, files on the asset origin), and its MCP off, so that an unreleased API is not exposed by trying the product. | M4a | must | P | D: "Free private preview" and "example-response mode", 2026-11-27. ADR 0003, "Who can read it": the published spec and the asset origin have their own URLs and must be covered. How a request to them is authorized is M4a design with the security reviewer. Guide assets arrive in M5 and inherit the rule. The MCP stays off even where the preview makes live "Try it" calls from M4b (EV-10); the user has not ruled on that (conflict 22). |

### AD: Account and billing admin

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| AD-1 | As an account admin, I want to invite and remove team members with roles (admin, editor, viewer), so that the portal does not depend on one login. | M4d | should | N | J. The brief lists "auth" and nothing more. |
| AD-2 | As a billing admin, I want to pay by card, see invoices and change plan, so that billing needs no support ticket. | M6 | must | P | Brief, M6 "billing". |
| AD-3 | As a billing admin, I want to cancel and be told what happens to the portal and data and when, so that leaving has no surprises. | M6 | must | N | J. |
| AD-4 | As a billing admin, I want to see usage against plan limits, so that I am not surprised by a limit. | M6 | should | N | J. |

### RD: End developer

First visit.

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| RD-1 | As a developer new to the API, I want to find an operation and see which credential it needs and where it goes, so that my first call authenticates. | M1 | must | C | c4, c25. E: arXiv 2507.16044. |
| RD-2 | As a developer, I want a sample in my language that runs after I change only the credential, so that I do not debug the docs. | M1 | must | C | c13, c14, c15, c25. |
| RD-3 | As a developer, I want my language choice kept on every page, so that I choose once. | M1 | must | C | c16. |
| RD-4 | As a developer, I want every parameter, enum value, constraint and documented response shown, so that I do not guess. | M1 | must | C | c3. |
| RD-5 | As a developer, I want `oneOf`, `anyOf`, `allOf` and recursive schemas shown readably, so that I can build a valid body. | M1 | must | C | c1, c2. |
| RD-6 | As a developer, I want to be told how to get a key (a link or instructions the provider supplies), so that I can start. | M2 | must | P | D: "Reader keys", 2026-11-27: the quickstart and authentication pages link to the customer's "get a key" URL. E: guides module status, "the spec does not describe how credentials are issued". The quickstart is M5 and no authentication page is defined yet (conflict 13). |
| RD-7 | As a developer, I want to call an operation from the page with my own credential, which is not stored, so that I see a real response before writing code. | M2 | must | P | D: "MCP and proxy credentials"; "Reader keys", 2026-11-27: the pasted key is held in the browser only. TS ("Try it"). |
| RD-8 | As a developer, I want the console, wherever it cannot make a live call for an operation, to still be there, to show the spec's example response, and to tell me why live calls are unavailable and what to do instead, so that I am never left with a dead or missing console. | M2 | must | P | D: "One rule for the console", 2026-11-28. Rewritten: it said the console is withheld with a reason on a public portal. On a public portal as in a private preview, wherever live calls are not allowed, "Try it" is in example-response mode (RD-30) with the reason shown, and is never absent. This applies to an `http://` or localhost server, any server that is not callable (ADR 0004, `server-not-callable`), and, from M4b, a server whose host is not verified or cannot be (SU-24). The reader is told what to do instead, not about our verification (J). The MCP's call tools are still withheld for such a server. The wording of each reason is undesigned: UX. Conflict 23, resolved. |
| RD-30 | As a developer using the console where it sends no live call, I want the example response the spec declares for the operation, clearly labelled as an example, and to be told plainly when the spec declares none, so that I never take an example or an invented value for a real response. | M2 | must | P | D: "Try it in a private preview: example-response mode", 2026-11-27, and "One rule for the console", 2026-11-28: the mode is used on public portals too, wherever live calls are not allowed, with the reason shown (RD-8). M2 owns the mode: no request leaves the browser, the label, the no-example message, nothing synthesized. M4a owns where it is switched on for previews: every preview (EV-9). From M4b it is the preview's state per server, for any server not both callable and verified, and a verified server is live (EV-10); the console must make clear which of the two a response is. In M2 it is reached through a stand-in setting, as in conflict 6. Which example is shown when there are several is undesigned (conflict 18). |
| RD-9 | As a developer, I want a quickstart and guides whose samples appear in my chosen language, so that I learn the flow, not only the endpoints. | M5 | must | P | D: "Guides never contain API request code". Contract 1. |
| RD-31 | As a developer reading a guide, I want a reference to a page that is not published yet to appear as plain text and not as a link, so that I never follow a link to a missing page. | M5 | must | P | D: "An incomplete guide page withholds only itself", 2026-11-27. What happens to the page's navigation entry is the architect's and UX's. |
| RD-10 | As a developer, I want to search the reference and the guides, so that I find an operation without knowing its name. | M5 | must | P | TS. Brief M5. Postman 34% is about finding APIs, so applying it here is inference. |
| RD-11 | As a developer using a keyboard or screen reader, I want reference pages that meet WCAG 2.2 AA, so that I can use the docs. | M1 | must | C | c22. |
| RD-12 | As a developer using a keyboard or screen reader, I want "Try it", search and guide pages to meet the same bar, so that later features do not lock me out. | M2 to M5 | must | N | J. c22 names five M1 pages; nothing carries it forward. |
| RD-13 | As a developer on a small screen, I want an operation page to be readable without sideways scrolling outside code blocks, so that I can read docs on a phone. | M1 | should | N | J. Reflow is part of WCAG 2.2 AA, which c22 claims, but an automated audit does not test it. |

Returning.

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| RD-14 | As a returning developer, I want links I saved to operations, responses and schemas to keep working, so that bookmarks and links in tickets stay good. | M1 | must | C | c11. |
| RD-15 | As a returning developer, I want the credential I entered kept for my browser session across pages, and a way to clear it, so that I enter it once and can remove it. | M2 | must | P | D: "Reader keys", 2026-11-27: held in the reader's browser only, never stored by us. Keeping it across pages and clearing it are J. |
| RD-27 | As a developer, I want to switch between the provider's APIs from any page and always see which one I am reading, so that I do not follow the reference for the wrong product. | M4d | should | P | D: "Multiple and versioned APIs", 2026-11-27: a product switcher. |
| RD-28 | As a developer on an older version of an API, I want to switch to my version and stay on the same operation where it exists, so that I read the docs for what I run. | later | should | P | D: same decision: a version switcher, later. Staying on the same operation is J. |
| RD-16 | As a developer, I want dark mode, so that the docs match my environment. | M3 | should | P | `m1.md` out-of-scope table. |
| RD-17 | As a returning developer, I want the old URL of a renamed or removed operation to lead somewhere useful, so that a spec change does not give me a dead link. | M4d | should | N | J. c11 covers an unchanged operation only. |
| RD-18 | As a returning developer, I want to see what changed in the API since I last looked, so that I can update my integration. | none | could | N | J. `m1.md`: changelog "not planned". |

Debugging.

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| RD-19 | As a developer with an error in hand, I want to land on the documentation of that status for that operation, so that I see what it means. | M1 | must | C | c3, c11. E: errors undocumented (low confidence). |
| RD-20 | As a developer debugging, I want "Try it" to show the exact request sent and the full response, so that I can compare with my own code. | M2 | must | P | ADR 0005: "Try it" sends exactly what the sample shows. Display is unspecified. |
| RD-21 | As a developer debugging, I want a failure of the portal's proxy to look different from an error returned by the API, so that I do not chase the wrong system. | M2 | must | N | J. |
| RD-22 | As a developer, I want to know when a sample value was synthesized, so that I do not take it for a real one. | open | should | P | Brief, open decision. M1 default: buyers only. E: 85 of Stripe's 120 guide pages have placeholders. |
| RD-23 | As a developer, I want webhooks documented with their payloads, so that I can handle events. | none | should | N | J. `m1.md` cuts them from M1; contract 8, open item 3. No milestone. |
| RD-24 | As a developer whose API's descriptions are not in English, I want non-Latin and right-to-left text to display correctly in pages, twins and samples, so that the docs are legible. | M1 | must | N | J. No fixture is known to test it. |
| RD-25 | As a developer who does not read English, I want the portal's own labels in my language, so that I can navigate. | none | could | N | J. No evidence of demand. Contract 8: localization out of scope. |
| RD-26 | As a developer signed in to the provider's site, I want the portal to show my own key in samples and "Try it", so that I copy a sample that already works. | later | could | P | D: "Reader keys", 2026-11-27: a sign-in handoff from the customer's site, a paid-tier feature, in no milestone. Undesigned and needs a security review. See conflict 4. |
| RD-29 | As a developer, I want to create an account with the portal and have it issue and manage my API keys or sandbox credentials, so that I need not go to the provider's site. | none | none | X | **Cut**, 2026-11-27: us issuing or managing developer accounts and keys is an API management product and out of scope. RD-6 and RD-26 serve the need. |

### AR: AI agent reading the docs

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| AR-1 | As an AI coding agent, I want each page as Markdown at the page URL plus `.md`, so that I read content without chrome. | M1 | must | C | c17. E: Ahrefs. |
| AR-2 | As an AI coding agent, I want an `llms.txt` listing every page with a link to its twin, so that I can find pages. | M1 | must | C | c17. TS. |
| AR-3 | As an AI coding agent, I want one twin to hold everything needed for a correct request, so that my first attempt is accepted. | M1 | must | C | c18. |
| AR-4 | As an AI coding agent, I want guide pages as Markdown with their samples rendered and no placeholders, so that I can follow a flow. | M5 | must | P | Contract 4.7; ADR 0005 consequences. |
| AR-5 | As an AI agent, I want to search the docs and fetch a page through a docs MCP, so that I do not crawl. | M5 | should | P | TS. Brief M5. |
| AR-6 | As an AI agent reading a twin, I want it to say whether the operation can be called through the MCP and where the MCP is, so that I can move from reading to calling. | M2 | should | N | J. |

### AC: AI agent calling the API

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| AC-1 | As an AI agent, I want to find operations by what I am trying to do, so that I pick the right one among hundreds. | M2 | must | P | D: "MCP tool design". |
| AC-2 | As an AI agent, I want an operation's input described in a shape my client accepts, so that the tool loads and I can fill it. | M2 | must | P | Brief, "Known MCP client limits". ADR 0005 (`CallValues`). |
| AC-3 | As an AI agent, I want to call a read operation through one tool and a write operation through another, with my user's credential, and have an undeclared parameter rejected by name, so that mistakes are caught before the API and my user can be asked about writes only. | M2 | must | P | D: "MCP tool design", four meta-tools, 2026-11-27. ADR 0003, "Proxy destination policy". |
| AC-4 | As an AI agent, I want each refusal to say which kind it is (write not enabled, a write sent to the read tool, server not callable, credential missing, the API's own error) and what to do, so that I recover or stop. | M2 | must | N | J. |
| AC-5 | As an AI agent, I want large responses bounded and told when one was cut, so that I do not act on half an answer. | M2 | should | P | ADR 0003: "M2 sets its own limits". |

### AH: The human who connects the agent

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| AH-1 | As a developer connecting an agent, I want setup steps for my client and to supply my credential per request without it being stored, so that connecting is quick and safe. | M2 | must | P | D: "MCP and proxy credentials". |
| AH-2 | As a developer connecting an agent, I want to see beforehand which operations it can call and which of them write, so that I know what I am authorizing. | M2 | must | N | J, prompted by E: Postman 51%. |
| AH-3 | As a developer connecting an agent, I want to keep my agent read-only even where the provider enabled writes, so that the limit is mine and not only theirs. | M2 | should | N | J. The "MCP writes" decision gives control to the tenant only. The tool split helps where a client can switch off one tool; a read-only setting on our server is still new. |
| AH-4 | As a developer connecting an agent, I want my client able to ask me before a write or destructive call, so that I approve it. | M2 | must | P | D: "MCP tool design", 2026-11-27: writes go through their own tool. No acceptance criteria yet. See conflict 1, resolved. |
| AH-5 | As a developer connecting an agent, I want my credential sent only to the provider's declared servers and never along a redirect, so that a tricked agent cannot leak it. | M2 | must | P | ADR 0003; re-review R1 and ruling 2. |
| AH-6 | As a developer connecting an agent, I want text written by the provider marked as data in tool results, so that a spec description cannot instruct my agent. | M2 | should | N | J. c19 covers script, not instructions. |

### GM: Guides module (system)

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| GM-1 | As the guides module, I want the published spec's exact bytes, so that the hash I record matches the portal's. | M1 | must | C | c26. Where the hosted portal serves it from is M5 (contract 6). |
| GM-2 | As the guides module, I want the portal to derive the same operation ids as I do, so that every link and sample resolves. | M1 | must | C | c12. Contract 1.1. |
| GM-3 | As the guides module, I want a machine-readable validation report with stable codes, so that I can test my output against the portal. | M5 | must | P | Contract 5 and 5.1. |
| GM-4 | As the guides module, I want to know which contract version the portal accepts, so that I emit that version. | M5 | must | P | Contract 7. |
| GM-5 | As the guides module, I want to be told when the published spec changes, so that guides are regenerated without a person noticing. | M5 | must | P | D: 2026-11-27: we run the module, so the trigger is ours, and a regeneration arrives as a pull request. When it runs (every publish, or on request) is undesigned. |
| GM-6 | As the guides module, I want a shared set of bundles that both validators must agree on, so that the two do not drift. | M5 | should | P | Contract 9; module status ("the two will disagree somewhere"). |

### OP: Our operator or support person

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| OP-1 | As our operator, I want to suspend a tenant's portal, proxy and MCP at once, so that abuse stops while we investigate. | M4b | must | P | D: the M4 split, 2026-11-27: built in the part where portals go public, never deferred. The need is J; who may suspend and how fast are undesigned. |
| OP-2 | As our operator, I want a way for anyone to report a portal and a process to act on it, so that hostile content on our hosting is taken down. | M4b | must | P | D: the M4 split, 2026-11-27, as OP-1. The need is J; the process and its response time are undesigned. |
| OP-3 | As our operator, I want a tenant to prove control of the website whose brand is extracted before the portal is public, so that we do not host a look-alike of someone else's site. | M4b | must | P | D: "Proof of domain control", 2026-11-27, rule 1. The extractor may still read any URL for a private preview. The reason for the rule is J. |
| OP-4 | As our operator, I want the proxy limited per tenant and per caller, and usable only against servers the tenant controls, so that it is not a relay for attacks on third parties. | M4b | must | P | D: "Proof of domain control", 2026-11-27, rule 2, for the "servers the tenant controls" half. The limit per tenant and per caller is not decided and stays J (see SC-4), except for live calls in a private preview, where a limit is part of the decision (OP-15). ADR 0003 blocks internal addresses, not other people's public servers. |
| OP-5 | As our support person, I want to see a tenant's publish failures, killed workers and exceeded budgets, so that I can answer "why did my publish fail". | M4d | should | N | J. ADR 0003 produces the signals. |
| OP-6 | As our operator, I want to delete all of a tenant's data, including caches and the asset origin, within a stated time, so that offboarding is complete. | M4a | must | N | J. |
| OP-7 | As our operator, I want proof that logs and error reports hold no end-user credential, so that an incident cannot expose one. | M2 | must | P | Standing constraint. Needs a test, not only a rule. |
| OP-8 | As our operator, I want usage metered and plan limits enforced, so that cost and price stay connected. | M6 | should | N | J. |
| OP-9 | As our operator, I want to republish every tenant after an engine or renderer upgrade, in stages and with a way back, so that an upgrade does not break all portals at once. | M4d | should | N | J. ADR 0003: a serializer change marks every tenant's guides `spec-hash-mismatch`. |
| OP-10 | As our operator, I want tenants' accepted fixes, themes and settings backed up and restorable, so that a storage fault does not lose their work. | M4d | should | N | J. |
| OP-11 | As our support person, I want to view a tenant's project with their consent and with the access logged, so that I can help without their password. | M4d | could | N | J. |
| OP-12 | As our operator, I want to tell affected tenants about an incident, so that they hear it from us. | M6 | could | N | J. |
| OP-13 | As our operator, I want limits on what a free preview can consume (previews per account, spec fetches, brand extractions, guide generations), so that a free tier open to anyone is not a cost or an abuse route. | M4a | should | N | J, prompted by "Free private preview", 2026-11-27. No evidence on expected volume. |
| OP-14 | As our operator, I want to set and remove a tenant's plan by hand, with publishing refused for a tenant that has none, so that "pay to publish" holds before billing exists. | M4b | must | P | D: "Free private preview, pay to publish", 2026-11-27: plans are set by hand until M6. How payment is taken meanwhile is outside the product. What happens to a public portal when a plan is removed is undesigned (see AD-3). |
| OP-15 | As our operator, I want live "Try it" calls in a private preview accepted only from signed-in members of that tenant, sent only to hosts that tenant has verified, and rate-limited per tenant and per member, with a refusal that says which rule applied, so that a free account cannot use our proxy as a relay. | M4b | must | P | D: "Live calls in a private preview", 2026-11-27: the three bounds are part of the decision. The limit's values and how the proxy checks membership are undesigned: security reviewer and architect, before M4b. The exposure is J, not measured (conflict 24). |
| OP-16 | As our operator, I want to approve by hand an API host a tenant cannot verify by DNS, so that the tenant gets live calls without moving the API. | none | none | X | **Cut**, 2026-11-27: manual approval by us is rejected. SU-23 and SU-24 serve the need at launch; SU-25 is the deferred method. |

## Conflicts with recorded decisions

1. **AH-4 against "MCP tool design". Resolved 2026-11-27.** The call tool is split: four
   meta-tools, with reads and writes separate, so a client can ask its user to approve writes
   only. Left for the architect before M2: what makes an operation a read (default `GET` and
   `HEAD`), and the read-only and destructive annotations on the two tools. ADR 0004 still says
   "MCP `call`" in `controlled-header-required`; that wording is the architect's.
2. **SU-10 (rollback) and SU-8 (preview) against "Guides use the patched spec".** A guides bundle is
   pinned to one published spec by hash, and guides can be generated only after a publish. So a
   spec change goes live before its guides can exist, readers see guides marked out of date in
   between, and a rollback must return spec, fixes, theme and bundle together. Contract 6 leaves
   open whether a staged spec can be fetched; the answer decides whether preview can include
   guides.
3. **SM-12 (samples tested against the real API) against "never stored".** Running samples for the
   buyer needs a credential for the buyer's API. The standing constraint covers end-user
   credentials; a provider's test credential is a different secret, and storing one is a new
   kind of data for us. Needs a decision and a security review before M2 scope is set.
4. **RD-26 (sign-in handoff) against static pages and "never stored".** Decided 2026-11-27 as a
   later, paid-tier feature, so the conflict is deferred, not removed. Filling a reader's key into
   pages needs per-reader state. It can be done in the browser, but the handoff from the
   customer's site is an integration nobody has designed, and it must keep "never stored by us"
   true. RD-6 (a link to where keys are issued) is the M2 version and has no such conflict.
5. **RD-25 (translation) against contract 8**, which puts localization out of scope.
6. **SU-13 and SU-22 in M2 against milestone order.** Per-operation enabling and the "get a key"
   URL are M2 requirements, and the dashboard where a tenant would set them is M4a. M2 needs a
   stated stand-in, such as a configuration file. The same stand-in switches on example-response
   mode in M2 (RD-30).
7. **Decision B and the published spec.** The allowed hosts are stored in the spec patch, so
   accepting that fix changes the published spec's bytes and marks existing guides out of date,
   like any other fix. Expected, and worth saying in the dashboard. Separately, ADR 0004 says a fix
   input is one string placed at one pointer; a list of hosts needs more than that. Settled by the
   architect: `FixInput.list` in ADR 0004, checked by c31.
8. **Domain verification against the trial (EV-1) and against milestone order. The first half
   resolved 2026-11-27.** Rule 2 sends nothing to a server whose domain is not verified. In a
   private preview "Try it" now runs in example-response mode: the console works, shows the
   spec's example and sends nothing, and the MCP is off (EV-9, RD-30, SC-13). Rule 2 is not
   loosened. Narrowed later that day: a server whose host is verified gets live calls in the
   preview (conflict 19), which rule 2 already allows. The second half stands: M2 builds the proxy before M4b builds verification, so the
   M2 proxy is not offered as a public hosted service until M4b (recorded in the brief).
9. **Domain verification against servers the tenant cannot verify. Resolved by the user
   2026-11-27.** An API served from a cloud provider's host name, or a host on a public suffix,
   has no domain the tenant can put a DNS record on. At launch the documented answer is to put
   the API on a domain they control and verify it; otherwise that server has no live calls,
   and the tenant is told so when verifying and when going public (SU-23, SU-24). An exact-host
   HTTP challenge is deferred until customers ask (SU-25). Manual approval by us is rejected
   (OP-16). How many customers are affected is still not known.

Raised by the second four decisions of 2026-11-27. Defaults are in the brief, "Open product
decisions".

10. **Pay to publish (M4b) against billing (M6). Settled 2026-11-27.** M4b builds the gate and
    we set a tenant's plan by hand (OP-14); M6 adds self-serve payment.
11. **Guides held by us against contract 4.7. Resolved 2026-11-27.** A page that has a `<Todo>`
    or is not ready withholds only itself, wherever the bundle is held, and a link to it renders
    as plain text (DW-4, RD-31). The architect is amending contract 4.7. Left for the architect
    and UX: the withheld page's navigation entry, and how the validation report lists withheld
    pages.
12. **The GitHub App against "the portal never writes to a bundle" (contract 6; the old wording of
    the brief), and review by pull request against "regenerating must not overwrite edits"
    (contract 4.7).** The App writes generated bundles to a customer's repository, as a pull
    request. The brief now says we change a bundle only by proposing a pull request. The decision
    says edits are "not overwritten silently", which is weaker than "must not overwrite"; the brief
    keeps the stronger rule until the user says otherwise.
13. **The "get a key" link in M2 against where it is shown.** The decision names the quickstart
    and authentication pages. The quickstart is a guide and arrives in M5; no M1 criterion defines
    an authentication page. In M2 the link has "Try it" and the reference's credential section to
    appear in. The guides module's `<Todo title="How credentials are issued">` could be answered
    by the same URL; whether the portal or the module does that is a contract question.
14. **"We run the guides module" against "we do not author or generate guides".** The old brief
    row is rewritten: the module is still a separate project and the portal still writes no guide
    content, but we operate the module. Contract 6 ("a generator's obligation ends when it has
    written a directory") stays true of the module; what runs it is now ours and is M5 work.
15. **Multiple APIs against what M2 and M5 build for one API.** One MCP endpoint, `llms.txt` and
    search index per API or per portal is not decided, and page URLs gain an API part. M1 has no
    hosted URLs, so nothing breaks, but M2's endpoint shape should not assume one API. For the
    architect. `m1.md` still says versioned docs are "not planned in any milestone".
16. **We run the generator against conflict 2.** This one helps: since we run the module, it can
    be given a staged spec, so a preview can include guides before a publish. Inference, not
    designed.

Raised by the third three decisions of 2026-11-27.

17. **Multiple APIs in M4d against portals going public in M4b.** Page URLs gain an API part
    (conflict 15). If M4b publishes portals whose URLs have no place for one, M4d changes public
    URLs that readers have saved, against RD-14. The URL shape must allow a second API before
    M4b publishes anything. For the architect, before M4b.
18. **Example-response mode is built in M2 and first used in M4a.** M2 has no private preview,
    so the mode is reached there by a stand-in setting, and its M2 criteria must be checkable
    that way. Undesigned: which example is shown when an operation documents several responses
    or named examples, and what counts as a declared example. The decision rules out one answer:
    nothing is synthesized.
19. **"A prompt to verify the domain for live calls" against "publishing needs a plan".
    Resolved by the user 2026-11-27, in favour of the default.** A private preview makes live
    "Try it" calls to a server whose host is verified, for signed-in members, without a plan;
    any other server is in example-response mode (EV-10). A plan is required to go public, not
    to make live calls in a preview. The decision did not mention the MCP (conflict 22).
20. **A withheld page against the quickstart.** If the withheld page is the quickstart, the
    "get a key" link it was to carry from M5 (conflict 13) has nowhere to appear in the guides,
    and links to it become plain text. The guides module marks how credentials are issued with a
    `<Todo>`, so this is the likely first case. Inference from the module's status report, not
    observed.

Raised by the fourth two decisions of 2026-11-27.

21. **Live calls in a preview (verification, M4b) against the private preview (M4a). Settled
    by scope.** In M4a no host can be verified, so every preview is in example-response mode
    and live calls in a preview begin when M4b ships verification. EV-9 asked for "a prompt to
    verify my domain", which in M4a would lead nowhere; it now asks only to be told that live
    calls need a verified host, and the prompt and the live calls are EV-10 in M4b. Checked:
    none of the eleven M4a stories now needs anything from M4b. Any ADR or contract that
    assumes every preview is example mode holds for M4a only; that wording is the architect's.
22. **The MCP in a private preview against live calls there. Decided by the user on 2026-11-27:
    the MCP is off in every private preview.** The
    earlier decision says the MCP is off in a private preview, and an MCP endpoint an agent can
    reach is "public" by the brief's definition, which needs a plan. The new decision allows
    live "Try it" calls and does not mention the MCP. Kept: the MCP is off in every private
    preview. The cost is that an evaluator cannot try the headline feature against their own
    API before paying. The user accepted that cost.
23. **"Withheld" against "stays in example-response mode" for an unverifiable host. Resolved
    by the user 2026-11-28: example-response mode on public portals too.** The decision of
    2026-11-27 used both phrases for the same server, and was first read as: example-response
    mode in a private preview, withheld with a reason on a public portal. That reading is
    replaced. Wherever live calls are not allowed, on a public portal as in a private preview,
    the console is in the mode with the reason shown, and is never absent; the MCP's call tools
    are still withheld for that server. This is M2 scope, and RD-8 is rewritten for it.
24. **Live calls without a plan against the proxy as a relay (OP-4).** Until now a plan stood
    between an account and any request leaving our proxy. An account that has paid nothing can
    now send requests, bounded by three rules: signed-in members of that tenant only, verified
    hosts only, rate-limited (OP-15). Open for the security reviewer and the architect before
    M4b: the limit's values; that the proxy must check tenant membership for preview calls,
    where a public portal's callers are anonymous; and whether a verified host name pointed at
    someone else's address gets round "verified hosts only" (inference, not checked; it would
    apply to public portals as well, where a plan is at least a cost to the abuser).

## Stories no milestone owns

- **Headline or promised features without a milestone:** white-label (EV-3), static export as a
  deliverable (EV-5). Subpath hosting as a hosted mode (IN-1) is now M4b.
- **Decided for later, in no milestone:** versions of one API (SU-21, RD-28), the sign-in handoff
  (RD-26), and an exact-host HTTP challenge for hosts that cannot be verified by DNS (SU-25),
  built only if customers ask.
- **Not planned anywhere:** webhooks pages (RD-23), internal operations (SM-14), changelog (RD-18),
  translation (RD-25), SSO (SC-10), compliance documents (SC-11), multi-file fixes for guides
  (SM-13).
- **Cut:** us issuing or managing developer accounts and keys (RD-29); manual approval by us of
  a host that cannot be verified (OP-16).
- **Assigned here to M4 by judgment:** rollback, delete, team roles, audit and the operator
  stories other than suspend, abuse intake and plans by hand. By decision M4 also holds the free
  preview and the plan gate, domain verification and the verified domain suffix, multiple APIs,
  and the GitHub App. M4 is split into four parts for that reason. See "The M4 split" below.
- **Table stakes in the brief with no explicit owner:** "AI search" is listed as table stakes; M5
  says "search", and `m1.md` lists AI chat as not planned. Whether M5 search is AI search is not
  decided.
- **Trust and safety no longer arrives late.** OP-3 and OP-4 need the tenant to prove control of a
  domain. Decided 2026-11-27: that is built in M4b, where public tenants arrive, not M6, and
  suspend and abuse intake (OP-1, OP-2) are built with it.

## The M4 split

Decided by the user on 2026-11-27: M4 is split. The parts below are the product manager's redraw
of the earlier three-part proposal, which had no part for multiple APIs and put the GitHub App
behind work that M5 does not need. M4 holds 45 of the 154 stories, 26 of them "must": the 38 it
held before, plus EV-9, SC-13 and OP-14, plus EV-10, SU-23, SU-24 and OP-15 from the last two
decisions, all four in M4b. Every one is in exactly one part. The parts are built in
the order a, b, c, d. The split is by what a tenant can do at the end of each part, so each part
can be checked on its own.

| Part | A tenant can | Stories | Why here |
|---|---|---|---|
| **M4a: tenancy and private preview** (11 stories, 9 must) | Sign in, create a project from a spec URL or file, accept and dismiss fixes in the dashboard, and see the whole portal in a free private preview, with "Try it" returning example responses in every preview, since no host can be verified until M4b. Nothing is public, nothing is readable without sign-in, and the MCP is off. **Demoable; this is the free trial. Not sellable.** | EV-1, EV-9, SU-1, SU-8, SU-9, SU-16, SU-17, SM-2, SC-13, OP-6, OP-13 | No public surface, so it needs no verification and no abuse process, and can ship to evaluators first. SC-13 is here, not in M4b, because the preview is where the published spec and the asset origin must be closed. Content is keyed by project, API and version here, even with one API. |
| **M4b: going public** (16 stories, 13 must) | Get a plan, which we set by hand, prove control of domains, make the portal public on our host or under their subpath, and use live "Try it" and MCP against verified servers. Without a plan, make live "Try it" calls in the private preview to a verified server. Be told, when verifying and when going public, what to do about a host that cannot be verified. We can suspend a tenant and take an abuse report. **Sellable: the first paying customer can go live.** | EV-8, SU-19, EV-10, OP-15, SU-23, SU-24, OP-14, OP-3, OP-4, OP-1, OP-2, IN-1, SC-8, SC-9, EV-7, then SM-10 | Everything that must be true the first time a stranger can reach a portal, so the minimum for running a public service is never deferred. SM-10 comes last, after its own security review, and is the first thing to cut. |
| **M4c: the Git connection** (6 stories, 4 must) | Connect a repository through the GitHub App, have the portal republish when the spec changes, use a private spec source, and be told when the source breaks or an update brings new findings. The App can open a pull request, first used for the patched spec (the pull-request half of SM-6, an M1 story). **Sellable as "stays correct without effort".** | SU-20, SC-12, SU-2, SU-3, SU-12, SM-11 | Small and on its own because M5's pull requests and repository ingestion (DW-1, DW-11, DW-12) need the App. It depends on M4a and the App's security review, not on M4b, so it may be built alongside M4b. It must be complete before that part of M5. |
| **M4d: more APIs and operating** (12 stories, no must) | Put several APIs in one portal with a product switcher, see what a publish changes, roll back, publish from CI, and add team members with roles. We can support, back up and upgrade tenants. **Sellable to larger customers; lowers our cost of running the service.** | SU-15, RD-27, SU-10, SU-11, SU-18, SC-5, AD-1, RD-17, OP-5, OP-9, OP-10, OP-11 | Needed to keep and grow customers, not to get the first one. Gates nothing in M5 and may run alongside it. |

**Order against M5.** M5's guides held by us (DW-10, DW-13) need M4a only. M5's pull requests
and ingestion from a repository need M4c. M4d gates nothing.

Costs of the split, as judgment: Git sync (SU-2) is table stakes and "stays correct without effort"
is the buyer's reason to buy, so M4c must not slip behind M4d; M4b cannot be designed until the
architect and security reviewer have designed verification, and M4c not until the App's security
review; multiple APIs arriving after portals are public creates conflict 17; and M4d, having no
"must" story, is the part most likely to be squeezed, which would leave rollback and team roles
unbuilt. M6 is unchanged apart from replacing plans set by hand.

## M1 stories the criteria did not cover

Proposals A to C were adopted by the user on 2026-11-27 and are in `m1.md`, which had 31
criteria then and has 32 from 2026-11-28, when criterion 32 (the doctor report is private by
default; SM-16) was added by the user's decision. D to G are still proposals.

| # | Proposed addition | Story | Basis | Timing |
|---|---|---|---|---|
| A | Adopted as c28: a stale patch is reported as not applied, naming the fix; the build completes and every other patch is applied. | SM-5 | ADR 0004, step 3 | Done. |
| B | Adopted by amending c10: with its input a fix removes its finding; without it the finding remains and names the input. | SM-3 | ADR 0004 (`bindFix`) | Done. Undoing a fix (SM-4) still has no criterion. |
| C | Adopted by amending c8, which names `server-not-callable`, including an open host variable, and `controlled-header-required`. The allowed-hosts fix is M1 (c29, c31). | SM-8, SM-9 | ADR 0004; decision B | Done. |
| D | The doctor lists every webhook and callback as "not rendered". | SM-15 | `m1.md` out-of-scope table; ADR 0004 (`webhook-not-rendered`, `callback-not-rendered`) | Can wait until M1 close. Testable on `oai-webhook-example` and `oai-callback-example`. |
| E | A 3.2 document builds as 3.1 with a warning finding. | SU-4 | Brief decision; ADR 0003 | Can wait. |
| F | A fixture with non-Latin, right-to-left and emoji text in descriptions, names and examples renders correctly in pages and twins, and its samples pass criteria 13 and 14. | RD-24 | J | Can wait; add with the QA fixtures. |
| G | At 320 CSS pixels wide, an operation page needs no sideways scrolling outside code blocks and tables. | RD-13 | J | Can wait; tell UX before the reference page is specified (step 5). |

**Does anything change M1 before the build starts? No.** Scaffolding, the `hard-schemas` fixture
and the parser and model (kickoff steps 1, 2 and 3.1) are unaffected. A, B and C were decided
before the spec doctor step. D to G can be decided any time before M1 is closed.

## Questions only the user can answer

1. Answered 2026-11-27: we run the guides module. Bundles are held by us until a repository is
   connected, then proposed as pull requests on the customer's repository. (DW-10 to DW-13, GM-5,
   SU-20, SC-12)
2. Answered 2026-11-27: a free private preview, and pay to publish. (EV-1, EV-8)
3. Answered 2026-11-27: a "get a key" link in M2, a sign-in handoff later on a paid tier, and us
   issuing accounts or keys cut. (RD-6, SU-22, RD-26, RD-29)
4. Answered 2026-11-27: yes, proof of domain control is required before a portal is public, built
   in M4. (OP-3, OP-4, SU-19)
5. Answered 2026-11-27: yes, MCP writes go through a separate tool. (AH-4)
6. "Samples tested against the API": whose credential, and may we store it? (SM-12)
7. Answered 2026-11-27: multiple APIs per portal in M4; versions of one API later. (SU-15, RD-27,
   SU-21, RD-28)
8. Is white-label a plan tier or the default? (EV-3) The other half is answered by the split:
   hosted subpath hosting is M4b. (IN-1)
9. Answered 2026-11-27: the fix from decision B is built in M1. (c29, c31)

Raised by the decisions of 2026-11-27:

10. Answered 2026-11-27: in a private preview "Try it" runs in example-response mode and sends
    nothing; the MCP is off. (EV-9, RD-30, SC-13, conflict 8)
11. Answered 2026-11-27: at launch, advise putting the API on a domain the customer controls;
    otherwise no live calls for that server. An exact-host HTTP challenge is deferred until
    customers ask. Manual approval is rejected. (SU-23, SU-24, SU-25, OP-16, conflict 9)
12. Is an operation that only reads but is not `GET`, such as a `POST` search, always a write for
    the MCP, or may the tenant mark it as a read? Default: always a write. (AC-3, AH-4)
13. Answered 2026-11-27: M4 is split. Four parts, in "The M4 split" above; the verified domain
    suffix is last in M4b and first to cut; multiple APIs are in M4d.

Of these, none is still open with the user. Question 12 stands on its default.

Raised by the second four decisions of 2026-11-27; each has a default in the brief:

14. Settled 2026-11-27: we set a tenant's plan by hand in M4b until M6 builds billing. (OP-14,
    conflict 10)
15. Does review by pull request replace "regenerating must not overwrite edits", or add to it?
    (conflict 12)
16. Answered 2026-11-27: a page with a `<Todo>`, or not ready, withholds only itself, before and
    after a repository is connected; a link to it renders as plain text. (DW-4, RD-31,
    conflict 11)

Raised by the third three decisions of 2026-11-27; each has a default in the brief:

17. Answered 2026-11-27: yes. A private preview makes live "Try it" calls to a verified server
    without a plan; otherwise it is in example-response mode. (EV-10, OP-15, conflict 19)
18. **Decided 2026-11-28.** Example-response mode is used outside a private preview: on a
    public portal, wherever live calls are not allowed. (RD-8, RD-30)

Raised by the fourth two decisions of 2026-11-27. Both are decided by the user and are in the
brief's decisions table:

19. **Decided 2026-11-27.** The MCP stays off in a private preview whose server host is
    verified: off in every private preview. (EV-10, SC-13, conflict 22)
20. **Decided 2026-11-28.** On a public portal, "Try it" for a server on an unverifiable host
    is shown in example-response mode with the reason. (RD-8, SU-24, conflict 23)

Decided by the user on 2026-11-28, not raised as questions here:

21. The doctor report is private by default, and the build says where it wrote it. (SM-16, c32)
22. `example-missing` offers no fix in M1; no fix writes a synthesized value into the spec as a
    declared example. (SM-1, SM-7; `m1.md`, question 7, closed)
23. The fetch cap per document is 16 MiB, the same as the local cap; the security reviewer
    confirms it when M4 is designed. (SU-1)
