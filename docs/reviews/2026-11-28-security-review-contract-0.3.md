# Security Design Review: Guides Contract Draft v0.3

Date: 2026-11-28. Reviewer: `security-reviewer` agent. Reviewed at commit `984bc3d`, following the
three earlier reviews in this directory.

A document review. Nothing was reproduced. "Confirmed" means the text as written permits it.

## Verdict: pass with required fixes

Contract 0.3 can go to the guides module once F1 to F5 and the wording below are in. Separately,
running the module on tenant specs stays blocked until ruling 8 is met.

## Rulings

**1. `page-error`: accept; the 22/12 split is right.** All 22 are content faults, and the
byte-level limits stay errors. It is safe only if rendering is gated by the validator. Add to 4.7:

> "The renderer builds a page only from the tree the validator produced for a page with no page
> error; it never parses a page file itself. For a page with a page error, preview and dashboard
> show only its slug, finding codes and line numbers: never its frontmatter title or description,
> and no excerpt of its source. A finding's `message` contains no bundle text."

Confirmed gap: a page with `invalid-frontmatter` is "listed and marked in the same way", which
would show a title that failed validation. A writer of one page gains nothing new except removing a
live page quietly, so confirmation is recommended for open item 8.

**2. `unique`: accept.** `^[0-9]{8}$` and `UNIQUE_n` pass every location encoder and the code-block
allowlist. Always-string is correct, because leading zeros make number coercion wrong. Reuse across
hosts is harmless for a non-secret. The capture reservation and twin display text are sound. Add:

> "Each digit is drawn by rejection sampling from `crypto.getRandomValues`. If that is unavailable
> the placeholder keeps its display text; `Math.random` is never used. A value is never written to
> storage, a URL or analytics."

**3. Portal-supplied parameters: accept with changes.** Replace "when the operation's security
requirement names that scheme" with:

> "only for the schemes of the one security requirement object in effect for the request: the
> operation's `security`, else the document's; `security: []` means none; where there are
> alternatives, only the one the reader selected."

A required parameter whose scheme is not named sends nothing, which is correct. Cookies: see F4.

**4. `settings.json`: accept the placement and limits.** Add "no duplicate keys" for settings, lock
and report. Disclosure: see F2.

**5. Report text: accept the schema.** Add to 5.2:

> "Shown as text nodes, never linkified; control and bidirectional formatting characters are
> removed or shown visibly; `fix` has no action attached; `pointer` is displayed, not resolved."

See F1.

**6. `guides.lock.json`: accept.** A repository writer can freeze pages, resurrect a deleted one,
or mark an edited page as untouched so it is overwritten. Each arrives in a reviewed pull request,
and that writer could edit the page directly. The slug pattern excludes `.` and `..`. Add:

> "The step's existing-bundle input omits `report.json`, and omits `guides.lock.json` when it is
> `invalid-lock`. Slugs from the record are lookup keys and are never joined into paths."

Trust: see F3.

**7. Pull request: accept with changes.** The slug and code character sets cannot form mentions,
links or markup. Add:

> "The title, branch name and commit message follow the same rule as the description. Slugs appear
> in code spans. Each list is cut at 50 slugs, with a count of the rest."

Reasons: 5,000 slugs would exceed GitHub's body limit (about 65,000 characters, from general
knowledge), and a bare hex slug autolinks as a commit.

**8. The guides module in our worker: not acceptable to run on tenant specs until its owner
confirms Ajv compiles only the contract's schemas.** Suspected otherwise: its validator checks
sample values against spec schemas. Required either way, in ADR 0007:

> "The step is its own OS process or container, separate from the one that fetches specs and the
> one that holds the App token: no network, empty environment, read-only root, throwaway scratch,
> caps on memory, CPU, wall clock and output bytes, destroyed after each run. Returned files pass
> the section 2 limits at the boundary. Dependencies are installed from a lockfile with integrity
> hashes and install scripts off."

"Per-tenant worker" in ADR 0003 promises none of this, and calling the library function in-process
makes that process the sandbox. The missing licence is noted; it blocks ADR 0001 rule 5 and is not
a security matter.

**Also checked.** `{{idempotency_key}}` only inside a sample: accept, it is a tightening. A failed
run changes nothing: accept; cap the failure text at 2,000 characters.

## New findings

**F1 (medium, confirmed). Section 6 and 5.2: `report.json` is committed to the tenant's
repository.**

- Exploit: `extensions[].example` carries `x-` values with no setting at all, and `specProblems`
  is a defect audit. On a public repository both become public. That contradicts "shown only to
  signed-in members" and the brief's private doctor report.
- Fix: "The portal keeps `report.json` for the dashboard and does not include it in a pull
  request."

**F2 (medium, confirmed). 5.4 and section 6: the `x-` warning appears only when settings started
the run.**

- Exploit: once a role exists, a later spec change that adds internal notes arrives in a pull
  request with no warning.
- Fix: "Every pull request from a run that had a `settings.json` carries the warning."

**F3 (medium, confirmed). Section 6, "When it runs": the trigger trusts `settingsSha256` from a
tenant-edited file.**

- Exploit: a wrong or missing record makes every ingest start a run, which is free compute on our
  workers.
- Fix: "The portal records the input hashes (spec, settings, existing bundle, module version) of
  each run and does not repeat one; runs are rate-limited per tenant; one open pull request per API
  version."

**F4 (low, confirmed). 4.3: the cookie rules contradict each other.** "No value from the spec is
sent" for the controlled header `Cookie`, yet a cookie parameter is "filled from the spec".

- Exploit: a spec example containing `;` adds a second cookie, or shadows the credential cookie.
- Fix: "The portal alone builds `Cookie`, from the credential cookie and declared non-credential
  cookies, each through a cookie encoder (name is a token; value has no `;`, `,`, space, quote or
  control character). A name equal to a credential cookie's is never filled from the spec."

**F5 (low, suspected). 4.6: "must not be used as a secret" is unenforced.**

- Exploit: a guide writes `"password": "{{unique}}"`, and the reader creates a real account with a
  secret of about 26 bits.
- Fix: a warning code when a generated value fills a property with `format: password`.

**F6 (medium, suspected). Status file: 136 of 236 pages fail while marked ready.** About a third
send an example identifier that no step creates.

- Exploit: a write runs with the reader's key against an identifier that may exist in their
  account.
- Fix: "'Try it' sends nothing while a captured name in the request is unfilled; there is no
  run-all; a write shows the final request before it is sent." Open item 9 must be decided before a
  held bundle publishes unattended.

## Not reviewed

- The guides module's code and its actual use of Ajv.
- `guides-module-brief.md`.
- ADRs 0001, 0002, 0004 and 0006; ADR 0003 beyond the worker text.
- Contract sections outside those named, beyond what the diff touched.
- GitHub rendering behaviour and limits, which are from general knowledge and not tested.
- Browser behaviour.
