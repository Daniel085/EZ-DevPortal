# User Stories: M1 to M6

Status: first full pass, 2026-11-27. Owner: product manager. No code exists yet. Updated the same
day for four decisions by the user: eleven M1 criteria adopted (31 in all), the Public Suffix List
licence exception, the MCP call tool split into read and write, and proof of domain control before
a portal is public, built in M4. Statuses, counts, conflicts and questions below reflect them.

Sources read: `docs/product-brief.md`, `CLAUDE.md`, `docs/milestones/m1.md`,
`docs/milestones/m1-build-kickoff.md`, `docs/contracts/guides-contract.md` (sections 1.2, 4.7, 5,
6, 8, 9), `docs/contracts/guides-module-status.md`, ADRs 0003 to 0006 and both files in
`docs/reviews/`.

## Do we have all the user stories?

**No.** Before this file there were none written as stories, and the plan covered two kinds of
user. This pass finds 13 actors and 130 stories:

| Status | Count | Meaning |
|---|---|---|
| **C** covered | 22 | An M1 acceptance criterion already checks it. |
| **P** planned | 57 | Named in a decision, ADR, contract section or milestone title, but with no acceptance criteria yet. It would probably get built; what "done" means is not written. |
| **N** new | 51 | Nothing in the current plan would have caused it to be built. |

Before the decisions of 2026-11-27 the counts were 129 stories: 18, 55 and 56. What moved: SM-3,
SM-5, SM-8 and SM-9 from planned to covered (M1 criteria 8, 10, 28, 29, 31); AH-4, OP-3, OP-4, EV-1
and SU-8 from new to planned; SU-19 added as planned.

What the existing documents cover well: the reader's first call from the reference (M1), the spec
doctor's findings, agents reading Markdown, the guides contract, and the security rules for the
proxy and for rendering.

What they do not cover, by the kinds of gap that were asked about:

| Kind of gap | Found? | Where |
|---|---|---|
| Lifecycle | **Yes, large.** Rollback, versioned APIs, deleting a project, cancelling and export are all absent. A private preview is now decided (2026-11-27); whether it is free before payment is not. First publish and spec update are planned by name only. | EV-1, EV-6, SU-8, SU-10, SU-15, SU-16, AD-3 |
| Failure and unhappy paths | **Yes.** A spec source that goes down, a spec publish that fails halfway, and new findings after an upstream change have no owner. A stale fix now has an M1 criterion (c28). Undoing a fix and a rejected bundle are designed in ADR 0004 and contract 6 but have no criteria. | SU-9, SU-12, SM-4, SM-11, DW-8 |
| Trust and safety | **Yes, the most serious, and partly closed on 2026-11-27.** Decided: proof of domain control before a portal is public and before the proxy calls a server (OP-3, OP-4), and a separate MCP tool for writes (AH-4). Still open: the agent's human cannot see beforehand what the agent may call or keep it read-only on the server side; there is no suspend, no abuse intake, no call limit and no audit log. | AH-2, AH-3, OP-1, OP-2, SC-3 to SC-5 |
| The buyer's reasons to pay and stay | **Yes.** Analytics is a word in M6 with no content. Team members and roles, and SSO are absent. | EV-4, AD-1, SC-10 |
| End developer account features | **Yes, and unowned.** Sign-in, API keys and sandbox credentials from the original capability list are in no milestone and no decision. The guides module reports that the spec never says how a key is issued, so every quickstart has this hole. | RD-6, RD-26 |
| Accessibility and non-English readers | **Partly.** M1 criterion 22 sets WCAG 2.2 AA for four M1 pages. Nothing carries that bar to "Try it", search, guides or the dashboard. Non-English spec text is untested; translation is out of scope by contract. | RD-12, RD-13, RD-24, RD-25, SU-17 |
| Our own operation of the service | **Yes, mostly.** Three of twelve operator stories are planned (no credentials in logs, and the two that domain verification answers). | OP-1 to OP-12 |

**How to read "new".** A story marked new is not automatically something to build. Nearly all of the
51 new stories rest on the product manager's judgment, not on research in the brief; only RD-6 has
direct evidence, and SC-3, SC-4 and AH-2 are prompted by one survey figure. The basis column says
which. The brief's research is about readers and specs; it has no evidence about what buyers
need to adopt, pay or stay, and none about operating the service.

### Legend

- **M**: the milestone the story belongs to. "none" means no milestone owns it today.
- **Pri**: must, should, could.
- **St**: C, P or N as above.
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
| EV-1 | As an evaluator, I want to give my spec URL and site URL and see a private preview portal for my own API before paying, so that I can judge the product on my real spec. | M4 | must | P | D: "Proof of domain control", 2026-11-27: a private preview is what a tenant has before verifying. "Before paying" is still undecided (question 2). By default the preview has no "Try it" for an unverified server (question 10). |
| EV-2 | As an evaluator, I want to see what each plan costs and includes, so that I can get the purchase approved. | M6 | should | N | J. M6 "billing" covers charging, not plans or a public price. |
| EV-3 | As a buyer, I want the portal to carry none of your branding, so that it reads as part of my site. | M3 | should | N | Brief, "Open differentiators" (white-label at lower tiers). No decision, no milestone. |
| EV-4 | As a buyer, I want to see how the portal is used (page views, searches with no result, "Try it" and MCP calls and their error rate), so that I can justify renewing. | M6 | must | P | Brief, M6 "analytics". The contents are J; nothing defines them. |
| EV-5 | As an enterprise buyer, I want a static export I can host myself, so that the portal meets my hosting rules. | none | could | P | D: "Static export stays possible". c21 keeps it possible. No milestone delivers it. |
| EV-6 | As a buyer who is leaving, I want to export my patched spec, accepted fixes, theme tokens and a static copy of the portal, so that I am not locked in. | M6 | should | N | J. Partly enabled by c26 and ADR 0004 (patched spec offered for download). |
| EV-7 | As a buyer, I want portal pages to be indexable by search engines with correct titles, canonical URLs and a sitemap, so that developers find my API. | M4 | should | N | J. |

### SU: Portal owner

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| SU-1 | As a portal owner, I want to create a project from a spec URL or an uploaded file and be led to a first published portal, so that setup takes minutes. | M4 | must | P | Brief, "Product" and control plane; ADR 0003, "Spec fetch policy". |
| SU-2 | As a portal owner, I want to connect the spec from a Git repository and have the portal republish when it changes, so that the portal stays correct without effort. | M4 | must | P | TS (Git sync). E: docs out of sync, SmartBear 52%. ADR 0003 says tokens need a reviewed path first. |
| SU-3 | As a portal owner, I want to use a spec URL that needs a token, so that a private spec can be the source. | M4 | should | P | ADR 0003: not covered by the fetch policy, "need their own reviewed path". Undesigned. |
| SU-4 | As a portal owner, I want an unsupported or unparseable spec rejected with what is wrong and where, so that I can fix it. | M1 | must | C | c5. D: Swagger 2.0 rejected. |
| SU-5 | As a portal owner, I want a spec with local defects to still build, with each defect reported, so that one bad schema does not block the portal. | M1 | must | C | c6. |
| SU-6 | As a portal owner, I want colours, fonts and logo taken from my website URL, so that the portal looks native without design work. | M3 | must | P | D: "Themes are data". |
| SU-7 | As a portal owner, I want to correct any extracted token by hand, so that a wrong extraction is not final. | M3 | must | P | D: manual override editor. |
| SU-8 | As a portal owner, I want to preview the whole portal (spec changes, theme, guides) at a private URL before it goes live, so that readers never see a mistake first. | M4 | must | P | D: "Proof of domain control", 2026-11-27, makes the private preview part of M4. That it also previews later changes to a live portal, and includes guides, is J. Contract 4.7 gives preview for guides bundles only. |
| SU-9 | As a portal owner, I want a publish to either complete or leave the live portal exactly as it was, and to be told what failed, so that a failure is never visible to readers. | M4 | must | P | Contract 6 says this for bundles; ADR 0003 gives the killable worker. Not stated for spec or theme publishes. |
| SU-10 | As a portal owner, I want to return the live portal to an earlier published version in one action, so that a bad publish is undone in minutes. | M4 | should | N | J. |
| SU-11 | As a portal owner, I want to see what a publish will change (operations added, removed, changed), so that I know what I am approving. | M4 | could | N | J. |
| SU-12 | As a portal owner, I want the live portal kept as it is and a notification sent when my spec source is unreachable or returns an invalid document, so that an outage on my side does not break my docs. | M4 | must | N | J. ADR 0003 turns a failed fetch into a finding; nothing says what the live portal does. |
| SU-13 | As a portal owner, I want to choose which operations "Try it" and the MCP may call, with write operations off until I enable each one, so that nothing is callable that I did not approve. | M2 | must | P | D: "MCP writes". ADR 0003, "an operation the tenant enabled". E: Postman 51%. |
| SU-14 | As a portal owner, I want to turn "Try it" or the MCP off for the whole portal, so that I can stop calls at once. | M2 | must | N | J. Implied by per-operation enabling, not stated. |
| SU-15 | As a portal owner, I want more than one API, or more than one version of an API, in one portal with a switcher, so that readers on an older version are served. | none | should | N | J. `m1.md` lists versioned docs as "not planned in any milestone". Contract 8: one bundle per spec version. |
| SU-16 | As a portal owner, I want to delete a project and have its portal, spec, fixes, theme and assets stop being served and be removed, so that nothing stale stays online. | M4 | must | N | J. |
| SU-17 | As a portal owner using a keyboard or screen reader, I want the dashboard to meet the same accessibility bar as the portal, so that I can do my job. | M4 | should | N | J. c22 covers portal pages only. |
| SU-18 | As a portal owner, I want to trigger a publish from my CI with a token, so that docs ship with the API. | M4 | could | N | J. |
| SU-19 | As a portal owner, I want to prove control of my website's domain and of each domain my API is served from, and to see what each proof unlocks (going public, "Try it" and MCP for a server), so that I know exactly what stands between my preview and a live portal. | M4 | must | P | D: "Proof of domain control", 2026-11-27. Methods and the meaning of "under a domain" are undesigned: architect and security reviewer. |

### IN: Web or infrastructure engineer

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| IN-1 | As the provider's infrastructure engineer, I want exact reverse-proxy instructions for serving the portal under `host.com/docs` and a check that reports what is misrouted, so that subpath hosting works first time. | M4 | must | P | D: "Subpath hosting" is the headline mode. c21 proves the static case. No milestone names the hosted case. |
| IN-2 | As the provider's infrastructure engineer, I want to point a custom domain at the portal and have ownership verified and TLS issued automatically, so that I add one DNS record and am done. | M6 | must | P | TS. Brief, M6. The ownership check reuses M4's domain verification (SU-19); routing and TLS are M6. |
| IN-3 | As the provider's infrastructure engineer, I want to be told during setup which origin to allow in my site's `Content-Security-Policy`, so that guide images do not silently fail. | M5 | must | P | Contract 9, "onboarding has to say so". |

### SM: Spec maintainer

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| SM-1 | As a spec maintainer, I want every defect that makes calls fail reported with severity, location, consequence and a fix, so that I know what to change. | M1 | must | C | c8, c9, c10. E: arXiv 2507.16044. |
| SM-2 | As a spec maintainer, I want to accept or dismiss each fix on its own and have that remembered across spec updates, so that I decide once. | M4 | must | P | `m1.md` out-of-scope table; ADR 0004 (overlay, fingerprint). |
| SM-3 | As a spec maintainer, I want to supply the one fact a fix needs (a token URL, a host), so that a fix that cannot be inferred can still be applied. | M1 | must | C | c10 as amended 2026-11-27 (with the input the finding goes, without it the finding stays and names the input); c31 for refused values. ADR 0004 (`inputs`, `bindFix`). |
| SM-4 | As a spec maintainer, I want to undo an accepted fix, so that a wrong fix from the doctor is not permanent. | M1 | must | P | Contract 1.2 and ADR 0004 anticipate removal. In M1 this is editing the overlay file. No criterion. |
| SM-5 | As a spec maintainer, I want to be told when an accepted fix no longer applies because my spec changed, with every other fix still applied, so that a stale fix is neither misapplied nor silent. | M1 | must | C | c28, added 2026-11-27. ADR 0004, step 3. |
| SM-6 | As a spec maintainer, I want the patched spec as a file or a pull request, so that I can fix the source and stop depending on the overlay. | M1 | should | P | c26 writes the file. ADR 0004, step 4 mentions the pull request (M4). |
| SM-7 | As a spec maintainer, I want to see which operations use synthesized sample values, so that I know where to add real examples. | M1 | must | C | c7. E: 87% of specs lack examples. |
| SM-8 | As a spec maintainer, I want to see which servers and operations have "Try it" and MCP withheld and why, so that I can make them callable. | M1 | must | C | c8 as amended 2026-11-27 names both findings; c29 checks the host rule row by row. Effect is visible in M2. From M4 a server can also be withheld because its domain is not verified; how that is shown is undesigned (SU-19). |
| SM-9 | As a spec maintainer, I want to list the allowed hosts for a server with an open host variable by accepting a fix, so that "Try it" and MCP work for it. | M1 | must | C | c10, c29, c31. D: brief, "Open host variables", option B. The fix and the CLI are M1; the proxy honouring the list is M2 (AC-3), and from M4 each listed host must also be under a verified domain. |
| SM-10 | As a spec maintainer, I want to prove control of a domain once and have every host under it allowed, so that I do not list each host. | M4 | should | P | D: option C, moved from M6 to M4 on 2026-11-27 because the verification it depends on is now M4. Comes after verification and needs its own security review. Demand is J. |
| SM-11 | As a spec maintainer, I want to be notified when a spec update brings new findings, so that a regression is caught without my checking. | M4 | should | N | J. |
| SM-12 | As a spec maintainer, I want samples run against my real API and the results shown to me, so that I know the samples work, not only that they parse. | M2 | should | P | Brief, "Open differentiators"; `m1.md` out-of-scope table. See conflict 3. |
| SM-13 | As a maintainer of a multi-file spec, I want a fix accepted in a referenced file to reach the guides too, so that the reference and guides agree. | none | could | P | Brief, open decision "Multi-file specs". |
| SM-14 | As a spec maintainer, I want to keep operations I mark as internal out of the portal, twins, search and MCP, so that one spec serves internal and public use. | none | should | N | J. No research in the brief. |
| SM-15 | As a spec maintainer, I want webhooks and callbacks listed as "not rendered", so that I know they are missing by design. | M1 | should | P | `m1.md` out-of-scope table promises it. No criterion. |

### DW: Docs owner or technical writer

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| DW-1 | As a docs owner, I want a commit of the guides bundle to reach the portal without manual upload steps, so that Git is the only place I work. | M5 | must | P | Contract 6. Transport is open. |
| DW-2 | As a docs owner, I want every problem in a bundle reported at once with file and line, so that I fix them in one pass. | M5 | must | P | Contract 5. |
| DW-3 | As a docs owner, I want to preview a staged bundle with each `<Todo>` shown as a marked placeholder, so that I can see what is left. | M5 | must | P | Contract 4.7. |
| DW-4 | As a docs owner, I want publishing blocked while any `<Todo>` or unfinished page remains, so that a placeholder never reaches a reader. | M5 | must | P | Contract 4.7. |
| DW-5 | As a docs owner, I want my edits kept when guides are regenerated, so that my work is not lost when the spec changes. | M5 | must | P | D: "Guides are edited in Git". Contract 4.7. Built by the guides module; needs a joint test. |
| DW-6 | As a docs owner, I want to be told when the live guides were generated from an older spec than the one published, so that I regenerate them. | M5 | must | P | Contract 1.2 (`spec-hash-mismatch`). |
| DW-7 | As a docs owner, I want the generator's run report (skipped pages, gaps, spec problems) in the dashboard, so that I know what the guides do not cover. | M5 | should | P | Contract 5.2: the portal "may" show it. |
| DW-8 | As a docs owner, I want a rejected bundle to leave the live guides unchanged, so that a bad commit is harmless. | M5 | must | P | Contract 6. |
| DW-9 | As a docs owner, I want images in guides to display on the portal, so that guides can show diagrams and screenshots. | M5 | should | P | D: "Risky assets use a separate origin". Contract 9, the three-browser acceptance test. |
| DW-10 | As a docs owner, I want to know who runs the generator and to receive a first bundle without installing anything, so that guides are part of the product and not a project of mine. | M5 | must | N | J. Contract 6 ends the generator's duty at a directory. No document says who runs it for a tenant or whose repository holds the bundle. |

### SC: Provider's security or compliance reviewer

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| SC-1 | As a security reviewer, I want a written statement of how developer credentials are handled that I can check against behaviour, so that I can approve "Try it" and the MCP. | M2 | should | N | J. The rule exists (standing constraint; ADR 0003). The document for buyers does not. |
| SC-2 | As a security reviewer, I want the MCP read-only by default, with writes enabled per operation and enforced on the server, so that an agent cannot do what we did not allow. | M2 | must | P | D: "MCP writes". E: Postman 51%. |
| SC-3 | As a security reviewer, I want a record of "Try it" and MCP calls (operation, time, status; no credentials or bodies), so that I can investigate an incident. | M2 | should | N | J, prompted by E: Postman 51% worry about unauthorized or excessive calls. |
| SC-4 | As a security reviewer, I want limits on how many calls an agent can make through the MCP, so that a runaway agent is contained. | M2 | should | N | J, prompted by the same finding ("excessive"). |
| SC-5 | As a security reviewer, I want a record of who accepted a fix, published, or enabled a write operation, so that changes are attributable. | M4 | should | N | J. |
| SC-6 | As a security reviewer, I want hostile text in a spec to be shown as inert text, so that our docs cannot attack our developers. | M1 | must | C | c19. Standing constraint. |
| SC-7 | As a security reviewer, I want files from guides that can carry script to be unable to run in my site's origin, so that a docs author cannot take over site sessions. | M5 | must | P | D: "Risky assets use a separate origin". Review finding M5. |
| SC-8 | As a security reviewer, I want to know that the published spec file includes comments and vendor extensions, and to control who can fetch it, so that nothing internal leaks. | M4 | must | P | ADR 0003: "who may fetch it" is M4 and M5 design. Kickoff, security gate on the published spec. The M1 part (the CLI's notice and `--no-published-spec`) is checked by c27. |
| SC-9 | As a security reviewer, I want portal pages served under my origin to set no cookies and load no third-party scripts, so that subpath hosting adds no risk to my site. | M4 | should | N | J. Follows from the subpath decision; nowhere stated. |
| SC-10 | As a security reviewer, I want the dashboard to accept single sign-on from our identity provider, so that access follows our joiner and leaver process. | none | could | N | J. No evidence of demand. |
| SC-11 | As a compliance reviewer, I want to know where data is stored, who the subprocessors are, and that data is deleted on termination, so that I can sign the contract. | none | should | N | J. Mostly documents, not software. |

### AD: Account and billing admin

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| AD-1 | As an account admin, I want to invite and remove team members with roles (admin, editor, viewer), so that the portal does not depend on one login. | M4 | should | N | J. The brief lists "auth" and nothing more. |
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
| RD-6 | As a developer, I want to be told how to get a key (a link or instructions the provider supplies), so that I can start. | M4 | must | N | E: guides module status, "the spec does not describe how credentials are issued", a callout on every quickstart. The remedy is J. |
| RD-7 | As a developer, I want to call an operation from the page with my own credential, which is not stored, so that I see a real response before writing code. | M2 | must | P | D: "MCP and proxy credentials". TS ("Try it"). |
| RD-8 | As a developer, I want to be told why "Try it" is unavailable for an operation and what to do instead, so that I am not left with a dead button. | M2 | must | P | ADR 0004 withholds it; what the reader sees is unspecified. |
| RD-9 | As a developer, I want a quickstart and guides whose samples appear in my chosen language, so that I learn the flow, not only the endpoints. | M5 | must | P | D: "Guides never contain API request code". Contract 1. |
| RD-10 | As a developer, I want to search the reference and the guides, so that I find an operation without knowing its name. | M5 | must | P | TS. Brief M5. Postman 34% is about finding APIs, so applying it here is inference. |
| RD-11 | As a developer using a keyboard or screen reader, I want reference pages that meet WCAG 2.2 AA, so that I can use the docs. | M1 | must | C | c22. |
| RD-12 | As a developer using a keyboard or screen reader, I want "Try it", search and guide pages to meet the same bar, so that later features do not lock me out. | M2 to M5 | must | N | J. c22 names four M1 pages; nothing carries it forward. |
| RD-13 | As a developer on a small screen, I want an operation page to be readable without sideways scrolling outside code blocks, so that I can read docs on a phone. | M1 | should | N | J. Reflow is part of WCAG 2.2 AA, which c22 claims, but an automated audit does not test it. |

Returning.

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| RD-14 | As a returning developer, I want links I saved to operations, responses and schemas to keep working, so that bookmarks and links in tickets stay good. | M1 | must | C | c11. |
| RD-15 | As a returning developer, I want the credential I entered kept for my browser session across pages, and a way to clear it, so that I enter it once and can remove it. | M2 | must | N | J. Must be reconciled with "never stored": browser only. |
| RD-16 | As a developer, I want dark mode, so that the docs match my environment. | M3 | should | P | `m1.md` out-of-scope table. |
| RD-17 | As a returning developer, I want the old URL of a renamed or removed operation to lead somewhere useful, so that a spec change does not give me a dead link. | M4 | should | N | J. c11 covers an unchanged operation only. |
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
| RD-26 | As a developer, I want to sign in and see my own API keys or sandbox credentials in the portal, so that samples and "Try it" are filled in for me. | none | could | N | Original capability list only. In no decision or milestone. See conflict 4. |

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
| GM-5 | As the guides module, I want to be told when the published spec changes, so that guides are regenerated without a person noticing. | M5 | must | N | J. Contract 1.2 defines the mismatch; nothing says what triggers regeneration. |
| GM-6 | As the guides module, I want a shared set of bundles that both validators must agree on, so that the two do not drift. | M5 | should | P | Contract 9; module status ("the two will disagree somewhere"). |

### OP: Our operator or support person

| Id | Story | M | Pri | St | Basis and pointer |
|---|---|---|---|---|---|
| OP-1 | As our operator, I want to suspend a tenant's portal, proxy and MCP at once, so that abuse stops while we investigate. | M4 | must | N | J. |
| OP-2 | As our operator, I want a way for anyone to report a portal and a process to act on it, so that hostile content on our hosting is taken down. | M4 | must | N | J. |
| OP-3 | As our operator, I want a tenant to prove control of the website whose brand is extracted before the portal is public, so that we do not host a look-alike of someone else's site. | M4 | must | P | D: "Proof of domain control", 2026-11-27, rule 1. The extractor may still read any URL for a private preview. The reason for the rule is J. |
| OP-4 | As our operator, I want the proxy limited per tenant and per caller, and usable only against servers the tenant controls, so that it is not a relay for attacks on third parties. | M4 | must | P | D: "Proof of domain control", 2026-11-27, rule 2, for the "servers the tenant controls" half. The limit per tenant and per caller is not decided and stays J (see SC-4). ADR 0003 blocks internal addresses, not other people's public servers. |
| OP-5 | As our support person, I want to see a tenant's publish failures, killed workers and exceeded budgets, so that I can answer "why did my publish fail". | M4 | should | N | J. ADR 0003 produces the signals. |
| OP-6 | As our operator, I want to delete all of a tenant's data, including caches and the asset origin, within a stated time, so that offboarding is complete. | M4 | must | N | J. |
| OP-7 | As our operator, I want proof that logs and error reports hold no end-user credential, so that an incident cannot expose one. | M2 | must | P | Standing constraint. Needs a test, not only a rule. |
| OP-8 | As our operator, I want usage metered and plan limits enforced, so that cost and price stay connected. | M6 | should | N | J. |
| OP-9 | As our operator, I want to republish every tenant after an engine or renderer upgrade, in stages and with a way back, so that an upgrade does not break all portals at once. | M4 | should | N | J. ADR 0003: a serializer change marks every tenant's guides `spec-hash-mismatch`. |
| OP-10 | As our operator, I want tenants' accepted fixes, themes and settings backed up and restorable, so that a storage fault does not lose their work. | M4 | should | N | J. |
| OP-11 | As our support person, I want to view a tenant's project with their consent and with the access logged, so that I can help without their password. | M4 | could | N | J. |
| OP-12 | As our operator, I want to tell affected tenants about an incident, so that they hear it from us. | M6 | could | N | J. |

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
4. **RD-26 (reader sign-in and keys) against static pages and "never stored".** Filling a reader's
   key into pages needs per-reader state. It can be done in the browser, but obtaining the key from
   the provider is an integration nobody has designed. RD-6 (a link to where keys are issued) is
   the small version and has no conflict.
5. **RD-25 (translation) against contract 8**, which puts localization out of scope.
6. **SU-13 in M2 against milestone order.** Per-operation enabling is an M2 requirement on the
   proxy, and the dashboard where a tenant would set it is M4. M2 needs a stated stand-in, such as
   a configuration file.
7. **Decision B and the published spec.** The allowed hosts are stored in the spec patch, so
   accepting that fix changes the published spec's bytes and marks existing guides out of date,
   like any other fix. Expected, and worth saying in the dashboard. Separately, ADR 0004 says a fix
   input is one string placed at one pointer; a list of hosts needs more than that. Settled by the
   architect: `FixInput.list` in ADR 0004, checked by c31.
8. **Domain verification against the trial (EV-1) and against milestone order.** Rule 2 withholds
   "Try it" and the MCP for a server whose domain is not verified, so by default an evaluator's
   private preview has no live call. And M2 builds the proxy two milestones before M4 builds
   verification, so the M2 proxy is not offered as a public hosted service until M4 (recorded in
   the brief).
9. **Domain verification against servers the tenant cannot verify.** An API served from a cloud
   provider's host name, or a host on a public suffix, has no domain the tenant can put a DNS
   record on. Whether another proof is accepted for one exact host is a security design question;
   whether we accept losing "Try it" and MCP for those tenants is the user's.

## Stories no milestone owns

- **Headline or promised features without a milestone:** subpath hosting as a hosted mode (IN-1),
  white-label (EV-3), static export as a deliverable (EV-5).
- **Not planned anywhere:** versioned and multiple APIs (SU-15), webhooks pages (RD-23), internal
  operations (SM-14), changelog (RD-18), translation (RD-25), reader sign-in and keys (RD-26), SSO
  (SC-10), compliance documents (SC-11), multi-file fixes for guides (SM-13).
- **Assigned here to M4 by judgment, and M4 is now very large:** trial, preview, rollback, delete,
  team roles, audit, nine operator stories, and since 2026-11-27 domain verification and the
  verified domain suffix. M4 as titled ("multi-tenancy and onboarding") did not include them. See
  "Proposal: splitting M4" below.
- **Table stakes in the brief with no explicit owner:** "AI search" is listed as table stakes; M5
  says "search", and `m1.md` lists AI chat as not planned. Whether M5 search is AI search is not
  decided.
- **Trust and safety no longer arrives late.** OP-3 and OP-4 need the tenant to prove control of a
  domain. Decided 2026-11-27: that is built in M4, where public tenants arrive, not M6.

## Proposal: splitting M4

A proposal for the user, not a decision. M4 holds 33 of the 130 stories, 17 of them "must". The
split is by what a tenant can do at the end of each part, so each part can be checked on its own.

| Part | A tenant can | Stories | Why here |
|---|---|---|---|
| **M4a: tenancy and private preview** | Sign in, create a project from a spec URL or file, accept and dismiss fixes in the dashboard, and see the whole portal in a private preview. Nothing is public. | EV-1, SU-1, SU-8, SU-9, SU-16, SU-17, SM-2, OP-6 | No public surface, so it needs no verification and no abuse process, and can ship to evaluators first. |
| **M4b: going public** | Prove control of domains, make the portal public on our host or under their subpath, and use "Try it" and MCP against verified servers. We can suspend a portal and take an abuse report. | SU-19, OP-3, OP-4, OP-1, OP-2, IN-1, SC-8, SC-9, EV-7, RD-6, then SM-10 | Everything that must be true the first time a stranger can reach a portal. SM-10 comes last, after its own security review, and is the first thing to cut. |
| **M4c: staying correct and operating** | Connect Git and republish on change, roll back, add team members, and be told when the source breaks or new findings appear. We can support, back up and upgrade tenants. | SU-2, SU-3, SU-10, SU-11, SU-12, SU-18, SM-11, SC-5, AD-1, RD-17, OP-5, OP-9, OP-10, OP-11 | Needed to keep a live portal correct, not to launch one. |

Costs of the split, as judgment: Git sync (SU-2) is table stakes and "stays correct without effort"
is the buyer's reason to buy, so M4c cannot be deferred long; and M4b cannot be designed until the
architect and security reviewer have designed verification. M5 and M6 are unchanged.

## M1 stories the criteria did not cover

Proposals A to C were adopted by the user on 2026-11-27 and are in `m1.md`, which now has 31
criteria. D to G are still proposals.

| # | Proposed addition | Story | Basis | Timing |
|---|---|---|---|---|
| A | Adopted as c28: a stale patch is reported as not applied, naming the fix; the build completes and every other patch is applied. | SM-5 | ADR 0004, step 3 | Done. |
| B | Adopted by amending c10: with its input a fix removes its finding; without it the finding remains and names the input. | SM-3 | ADR 0004 (`bindFix`) | Done. Undoing a fix (SM-4) still has no criterion. |
| C | Adopted by amending c8, which names `server-not-callable`, including an open host variable, and `controlled-header-required`. The allowed-hosts fix is M1 (c29, c31). | SM-8, SM-9 | ADR 0004; decision B | Done. |
| D | The doctor lists every webhook and callback as "not rendered". | SM-15 | `m1.md` out-of-scope table | Can wait until M1 close. |
| E | A 3.2 document builds as 3.1 with a warning finding. | SU-4 | Brief decision; ADR 0003 | Can wait. |
| F | A fixture with non-Latin, right-to-left and emoji text in descriptions, names and examples renders correctly in pages and twins, and its samples pass criteria 13 and 14. | RD-24 | J | Can wait; add with the QA fixtures. |
| G | At 320 CSS pixels wide, an operation page needs no sideways scrolling outside code blocks and tables. | RD-13 | J | Can wait; tell UX before the reference page is specified (step 5). |

**Does anything change M1 before the build starts? No.** Scaffolding, the `hard-schemas` fixture
and the parser and model (kickoff steps 1, 2 and 3.1) are unaffected. A, B and C were decided
before the spec doctor step. D to G can be decided any time before M1 is closed.

## Questions only the user can answer

1. Who runs the guides module for a tenant, and whose Git repository holds the bundle: ours,
   automatically, or the customer's? (DW-10, GM-5)
2. Is there a free trial or preview before payment, and what does it include? (EV-1)
3. Reader sign-in, API keys and sandbox credentials: build, reduce to a provider-supplied "get a
   key" link, or cut? (RD-6, RD-26)
4. Answered 2026-11-27: yes, proof of domain control is required before a portal is public, built
   in M4. (OP-3, OP-4, SU-19)
5. Answered 2026-11-27: yes, MCP writes go through a separate tool. (AH-4)
6. "Samples tested against the API": whose credential, and may we store it? (SM-12)
7. Versioned APIs and more than one API per portal: which milestone, or cut? (SU-15)
8. Which milestone owns hosted subpath hosting, and is white-label a plan tier or the default?
   (IN-1, EV-3)
9. Answered 2026-11-27: the fix from decision B is built in M1. (c29, c31)

Raised by the decisions of 2026-11-27:

10. In a private preview, may a signed-in member use "Try it" against a server whose domain is not
    verified? Default: no, so a trial shows no live call until the tenant verifies. (EV-1,
    conflict 8)
11. An API served from a domain the tenant cannot verify, such as a cloud provider's host name: do
    we accept that it has no "Try it" or MCP, or ask the security reviewer for a proof that works
    on one exact host? (conflict 9)
12. Is an operation that only reads but is not `GET`, such as a `POST` search, always a write for
    the MCP, or may the tenant mark it as a read? Default: always a write. (AC-3, AH-4)
13. Split M4 into three parts as proposed above? (and with it, whether the verified domain suffix,
    SM-10, stays at the end of M4b or is cut to later)
