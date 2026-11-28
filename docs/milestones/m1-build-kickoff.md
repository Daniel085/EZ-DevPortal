# M1 Build Kickoff

For the session that builds M1. Everything needed is in this repository; this file says what to
read and in what order to work.

## Read first

1. `CLAUDE.md`: the feature team, who decides what, and the four standing constraints.
2. `docs/product-brief.md`: the product and the decisions made.
3. `docs/milestones/m1.md`: scope and the 34 acceptance criteria. This defines "done".
4. `docs/adr/0001` to `0006`: the M1 architecture. All are accepted. ADR 0007 (guides generation
   and delivery) is M4 and M5 work and is not needed for M1. ADR 0002 (the API model) and
   ADR 0003 (the engine's interface) are what the engine and renderer developers code against.
5. `docs/contracts/guides-contract.md`, for M1 only these sections: 1.1, the operation id
   algorithm, which is normative and which the guides module also implements; 1.2, the published
   spec, which the guides module generates from; and, where the ADRs point to them, 4.3 (the
   controlled-header list, portal-supplied parameters, the cookie rule and the sample media
   type) and 4.5 (the external link rule). The contract is at draft 0.3.
6. `docs/reviews/`: four security design reviews. Their rulings are already in the ADRs; read them
   to understand why a rule exists before changing it.

## Before writing code

- Node 24 or later and pnpm, as ADR 0001 specifies.
- Run `fixtures/specs/fetch.sh` once. It downloads four large specs (33 MB) into the gitignored
  `fixtures/specs/large/` and verifies their hashes. Scale tests need them.
- Criteria 13 and 14, and criterion 33 through them, need eight language toolchains to check and run samples: curl, Node, Python
  with `requests`, Go, a JDK, the .NET SDK, PHP with the cURL extension, and Ruby. Find out which
  are installed before planning those tests, and report any that are missing instead of skipping
  the criteria.

## Order of work

Each step names the agent that owns it. Give a reviewer the code or the running app, not a summary.
The engine's own build order is ADR 0003, "Build order in M1"; the steps below follow it.

1. **Scaffold** the monorepo exactly as ADR 0001 lays it out, including the compiler and lint
   settings that keep the engine free of I/O. Confirm that `fetch`, `fs` and `process` fail to
   type-check inside `packages/engine` before going further. `engine-developer`, working outside
   its usual package for this step.
2. **Write the fixtures that need no engine, and the test harness** that runs every fixture
   through the engine. `qa-engineer`. The corpus in `fixtures/specs/` lacks these, and the
   criteria need them:
   - `hard-schemas`: `oneOf`, `anyOf`, `allOf`, discriminators and mutual recursion in one small
     committed spec (criteria 1, 2 and 22).
   - Hostile content: HTML, script, event handlers, a `javascript:` link and a remote image, in
     descriptions, summaries, examples, enum values and names (criterion 19).
   - A parseable spec with an invalid schema and an example that violates its schema
     (criterion 6).
   - The request-shape matrix: path, query and header parameters; JSON, form-urlencoded and
     multipart bodies; bearer, basic, and API key in a header and in the query (criterion 14). It
     declares the mock as its server, on the fixed port ADR 0005 gives.
   - Servers with host variables, one per row of the worked-examples table in ADR 0004
     (criterion 29).
   - A spec with an unsatisfiable schema, and the expected `synthesis-failed` findings
     (criterion 7).
   - A test-generated document over the size limit, for `limit-exceeded` (criterion 5).
   - `unicode-text`: right-to-left, non-Latin and emoji text in descriptions, summaries, names,
     path templates and examples; U+202E in a description, a JSON request-body example and a
     tag name, an unclosed U+2067 in an operation summary, U+200F inside a right-to-left
     sentence and U+2028 in a JSON body example; a required header and a required cookie with
     non-ASCII examples, and a multipart part whose name is non-ASCII or holds `=`, each
     expected to be absent from every sample with one `request-invalid`, its recorded request
     still compared although the mock answers 400; the mock as its first server, as in the
     matrix, and the hand-written expected request of each operation (criterion 33, which
     lists what it must hold).
   - Update `fixtures/specs/malformed/expected.json` with the finding codes ADR 0004's rule table
     gives for each of the 16 malformed fixtures.
3. **Engine**, each part with tests against the fixtures before the next starts.
   `engine-developer`.
   1. Parsing, `$ref` resolution, the normalized model (ADR 0002), applying fixes and serializing
      the document. Include the operation id algorithm, tested against the worked examples in
      contract section 1.1.
   2. Schema views, `validateValue`, `synthesizeExample` and `selectResponseExample` (ADR 0003).
   3. Spec doctor findings and patches, from the rule table in ADR 0004. Vendor the Public Suffix
      List here, as that ADR describes.
   4. The request representation and the eight sample emitters (ADR 0005), including "Text
      outside ASCII". Each emitter's tests with hostile values (U+0003, ESC `[201~`, `@.env`,
      `<.env`, `#{`, `\u000a`, U+0085, `?>`) go to the security reviewer with the emitter code
      (ruling C of `docs/reviews/2026-11-28-security-review-text-outside-ascii.md`). They are
      QA work with the engine developer, not an acceptance criterion.
   5. Page models, Markdown twins and `llms.txt` (ADR 0003, "The portal bundle"). The Markdown
      functions (`sanitizeMarkdown`, `parseMarkdown`) can be built at any point before this.
4. **The local mock**, once step 3.2 is done, with the one-patch overlays that point the Petstore
   and Museum builds at it (ADR 0005; criteria 18 and 25). `qa-engineer`.
5. **Publisher and command line**: `ezdp build`, `ezdp doctor` and `ezdp fix`, as ADR 0003, "The
   M1 command line" defines them. M1 reads local files only. `engine-developer`, working outside
   its usual package for this step.
6. **Renderer**: `ux` specifies the pages and `designer` the default theme tokens first; then
   `renderer-developer` builds the static portal and its `export` script (ADR 0006). The page
   specification includes the operation page's layout at 320 CSS pixels wide, with no
   sideways scrolling outside code blocks and tables and with the navigation still reachable
   (criterion 34), and how the marker of a bidi control looks (criterion 33, clause (h);
   ADR 0006, "Direction of tenant text", which fixes the isolation itself). `ux` specifies
   both before the reference page is built.
7. **Close the milestone** as `m1.md` defines: `qa-engineer` runs the suite on all fixtures,
   `dx-reviewer` uses the built Petstore, Museum and GitHub portals, and `product-manager` marks
   each of the 34 criteria.

The renderer consumes page files, which include samples, so it needs steps 3.4 and 3.5. Once step
3.1 is done, `ux` and `designer` can specify the pages and the tokens, and `renderer-developer`
can build against the page types in ADR 0003 with hand-written sample data, while the engine work
continues. Wire the two together when step 3.5 lands.

## When the documents do not answer a question

Two independent audits of these documents found and closed fourteen gaps. There will be more.
When something is ambiguous, contradictory or missing, do not guess: ask the `architect` (or the
`product-manager` for scope), have the answer written into the ADR or `m1.md`, and then build to
it. A guess that turns out right still leaves the next reader guessing.

## Security review gates

The security reviewer has a veto. Send it the code, before the work is called done, for:

- Each sample emitter's encoder (eight sets of escaping rules), under ADR 0005, including the
  cookie encoder and the handling of portal-supplied parameters: a credential declared as both
  a security scheme and a parameter appears once, and only for the security requirement in
  effect.
- The `$ref` resolver and the JSON Patch application, for the own-property and `__proto__` rules in
  ADRs 0003 and 0004. The required test resolves and patches through `__proto__`, `constructor` and
  `prototype` and asserts `Object.prototype` is unchanged.
- The renderer's handling of spec text: criteria 15 and 19.
- The published spec file. The third design review ruled on it; check the code against that
  ruling (ADR 0003, "Who can read it"). It exposes the whole root document, including comments and
  vendor extensions the reference pages do not show.
- The schema validator and its handling of `pattern`, under ADR 0003.
- `sanitizeMarkdown`, its bounds, and the Markdown parser dependency it brings into the engine.
- The Basic authentication handling in each emitter.
- The patch operations and the fixes that write into a spec, including the `absent` operation.
- The command line starting the portal's export as a child process.
- The doctor report staying out of the public output by default: after a default build the
  export holds no doctor page, no report file and no link to either (ADR 0003, "The M1 command
  line"; ADR 0006, "The export command").
- The budgets and limits in ADR 0003, with a test using a small spec that expands to an enormous
  example.

## Rules that are easy to break

- The engine never throws on a bad spec. It degrades and returns findings.
- Output is deterministic: no timestamps, no random ids, no dependence on key order in the input.
- Never make a test pass by skipping it or regenerating snapshots without reading the difference.
- A new runtime dependency needs a line in an ADR with its license (ADR 0001 rule 5).
- The agent briefs in `.claude/agents/` describe the whole product. For M1, `m1.md` decides scope:
  one light theme, no dark mode, and no search of any kind.
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
- **The Public Suffix List.** The rule needs it. The user allowed a narrow licence exception on
  2026-11-27 (ADR 0001 rule 5): the one file is vendored unmodified at `data/public-suffix-list/`
  with `SOURCE.json` and its licence text, and passed to the engine as input. Vendor it as ADR 0004
  describes, and test both modes: with the list, and with `publicSuffixes: null`, the strict mode.
- **The published spec.** The CLI prints that the file is public and holds the whole root document,
  including comments and `x-` fields, and a flag omits it (ADR 0003, "Who can read it").

ADR 0004 also lists details the architect added to make the host rule decidable. The security
reviewer has not confirmed them, so include them when the doctor's server checks go to review.

The acceptance criteria for all of this are in `m1.md`: criteria 8 and 10 as amended, and 27 to 32.
Security sign-off is required on criteria 15, 19, 29, 31, 32 and 33.

## One spec is one unit (decided 2026-11-27)

A portal will hold several APIs, and later several versions of each. The engine is unaffected: one
spec in, one model and one bundle out. That output is a **unit**, and the portal composes units
keyed by project, API and version. What M1 must respect so nothing is redone:

- URLs in a bundle are relative to the unit's base, never the portal root. The renderer builds
  every URL through one function that takes the base path and the unit prefix (ADR 0006, "Units").
- Operation and schema ids are unique within one unit only.
- `llms.txt`, the Markdown twins and the published spec are per unit, and their links are relative
  to the file they are in.

Criteria 17 and 21 in `m1.md` were amended to test this.

## Open product decisions that do not block M1

- Whether readers, as well as buyers, see that a sample uses synthesized values. M1 default: buyers
  only, in the doctor report.
