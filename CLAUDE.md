# EZ-DevPortal

A hosted SaaS that generates branded developer portals from OpenAPI specs. Read
`docs/product-brief.md` for the product, the decisions made and the research behind them.

## Feature team

Ten agents are defined in `.claude/agents/`. Use them by area, not on every change.

| Agent | Engage when |
|---|---|
| `product-manager` | Start of a milestone, to set scope and acceptance criteria. Before work is called complete. |
| `architect` | Start of a milestone. Before adding a package, a cross-module dependency, or changing `docs/contracts/`. |
| `ux` | Before building a new page or flow. Changes to navigation, layout, forms or onboarding. |
| `designer` | Theme tokens, component styling, brand-extraction output, any visual change to portals. |
| `engine-developer` | Work in the engine: parsing, spec doctor, samples, page models, search index, Markdown twins. |
| `renderer-developer` | Portal and dashboard front end. |
| `platform-developer` | Proxy, MCP, tenancy, auth, publish pipeline, ingestion, domains, billing. |
| `security-reviewer` | **Required** for any change to the proxy, MCP, auth, tenancy, rendering of tenant content, the brand extractor, custom domains or secrets. Has a veto. |
| `qa-engineer` | Adding or reviewing tests. Verifying a feature works before it is called done. |
| `dx-reviewer` | After changes to the reference, samples, "Try it", `llms.txt` or MCP tools. Before a milestone is called done. |

Rules for using the team:

- Give a reviewer the code or the running app, not a summary of what it is meant to do.
- A milestone is complete when the product manager's criteria are checked, QA has run the tests,
  and the DX reviewer has used the result.
- When agents disagree, the security reviewer wins on security, the architect on boundaries and
  contracts, the product manager on scope.

## Standing constraints

- The engine is a pure library with no I/O.
- Tenant content is data and is never executed.
- Core portal pages must stay statically exportable.
- End-user credentials are passed through and never stored or logged.
