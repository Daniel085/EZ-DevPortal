# M1 Build Kickoff

For the session that builds M1. Everything needed is in this repository; this file says what to
read and in what order to work.

## Read first

1. `CLAUDE.md`: the feature team, who decides what, and the four standing constraints.
2. `docs/product-brief.md`: the product and the decisions made.
3. `docs/milestones/m1.md`: scope and the 26 acceptance criteria. This defines "done".
4. `docs/adr/0001` to `0006`: the architecture. All six are accepted. ADR 0002 (the API model) and
   ADR 0003 (the engine's interface) are what the engine and renderer developers code against.
5. `docs/contracts/guides-contract.md`, sections 1.1 and 1.2 only for M1: the operation id
   algorithm, which is normative and which the guides module also implements, and the published
   spec, which the guides module generates from.
6. `docs/reviews/`: two security design reviews. Their rulings are already in the ADRs; read them
   to understand why a rule exists before changing it.

## Before writing code

- Node 24 or later and pnpm, as ADR 0001 specifies.
- Run `fixtures/specs/fetch.sh` once. It downloads four large specs (33 MB) into the gitignored
  `fixtures/specs/large/` and verifies their hashes. Scale tests need them.
- Criteria 13 and 14 need eight language toolchains to check and run samples: curl, Node, Python
  with `requests`, Go, a JDK, the .NET SDK, PHP with the cURL extension, and Ruby. Find out which
  are installed before planning those tests, and report any that are missing instead of skipping
  the criteria.

## Order of work

Each step names the agent that owns it. Give a reviewer the code or the running app, not a summary.

1. **Scaffold** the monorepo exactly as ADR 0001 lays it out, including the compiler and lint
   settings that keep the engine free of I/O. Confirm that `fetch`, `fs` and `process` fail to
   type-check inside `packages/engine` before going further. `engine-developer`.
2. **Write the `hard-schemas` fixture** that `m1.md` asks for, and the test harness that runs every
   fixture through the engine. `qa-engineer`.
3. **Engine, in this order**, each with tests against the fixtures before the next starts.
   `engine-developer`.
   1. Parsing, `$ref` resolution and the normalized model (ADR 0002), including the operation id
      algorithm, tested against the worked examples in contract section 1.1.
   2. Spec doctor findings and patches (ADR 0004).
   3. The request representation and the eight sample emitters (ADR 0005).
   4. Page models, Markdown twins and `llms.txt` (ADR 0003).
4. **Publisher**: the CLI that reads a local spec file and writes the bundle and the published
   spec (ADR 0003, criterion 26). M1 reads local files only. `engine-developer`.
5. **Renderer**: `ux` specifies the reference page and `designer` the default theme tokens first;
   then `renderer-developer` builds the static portal (ADR 0006).
6. **Close the milestone** as `m1.md` defines: `qa-engineer` runs the suite on all fixtures,
   `dx-reviewer` uses the built Petstore, Museum and GitHub portals, and `product-manager` marks
   each of the 26 criteria.

Steps 3.3 and 5 can run in parallel once step 3.1 is done, because both depend only on the model.

## Security review gates

The security reviewer has a veto. Send it the code, before the work is called done, for:

- Each sample emitter's encoder (eight sets of escaping rules), under ADR 0005.
- The `$ref` resolver and the JSON Patch application, for the own-property and `__proto__` rules in
  ADRs 0003 and 0004. The required test resolves and patches through `__proto__`, `constructor` and
  `prototype` and asserts `Object.prototype` is unchanged.
- The renderer's handling of spec text: criteria 15 and 19.
- The published spec file: ADRs 0003 and 0004 gained this output after the design review, so it
  has not been reviewed. It exposes the whole root document, including comments and vendor
  extensions the reference pages do not show.
- The budgets and limits in ADR 0003, with a test using a small spec that expands to an enormous
  example.

## Rules that are easy to break

- The engine never throws on a bad spec. It degrades and returns findings.
- Output is deterministic: no timestamps, no random ids, no dependence on key order in the input.
- Never make a test pass by skipping it or regenerating snapshots without reading the difference.
- A new dependency needs a line in an ADR with its license.
- Do not change `docs/contracts/` or a package's public interface without the architect.

## Not in M1

The request proxy, "Try it", the MCP, brand extraction, tenancy, guides ingestion and search. The
out-of-scope table in `m1.md` says where each belongs. If one seems necessary, ask the product
manager before building it.

## Decided on 2026-11-27

- A server whose host is a variable with no listed values becomes callable through a spec-doctor
  fix that takes the allowed hosts as input (ADR 0004, "The fix for an open host variable"). The
  finding, the fix and its input validation are M1 work. Enforcement at the proxy is M2.

## Added after the third security review (2026-11-27)

Read `docs/reviews/2026-11-27-security-review-allowed-hosts-and-published-spec.md` before the spec
doctor step. It changed three things the M1 code must follow:

- **When a server with a host variable is callable.** The rule and a table of worked examples are
  in ADR 0004. Test the doctor against every row of that table.
- **The Public Suffix List.** The rule needs it, and its licence (MPL 2.0) is outside the
  dependency policy in ADR 0001. The user has not yet decided whether to allow the exception that
  ADR 0004 describes. **Until that is decided, do not vendor the list: pass `publicSuffixes: null`,
  which is the strict mode** where every host variable without an `enum` is not callable. The
  engine interface is the same either way, so nothing built is wasted.
- **The published spec.** The CLI prints that the file is public and holds the whole root document,
  including comments and `x-` fields, and a flag omits it (ADR 0003, "Who can read it").

ADR 0004 also lists details the architect added to make the host rule decidable. The security
reviewer has not confirmed them, so include them when the doctor's server checks go to review.

The architect listed eight acceptance criteria these changes imply, and the product manager three
more. They are proposed, not yet in `m1.md`; ask the user before treating them as agreed.

## Open product decisions that do not block M1

- Whether readers, as well as buyers, see that a sample uses synthesized values. M1 default: buyers
  only, in the doctor report.
