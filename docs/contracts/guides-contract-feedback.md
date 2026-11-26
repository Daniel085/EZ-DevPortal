> Copied from `docs/contract-feedback.md` in the guides module repository (EZ-DevDocs) at commit
> `89e086a`, 2026-11-26. The guides module owns this text; the contract itself is unchanged. See
> [`guides-module-status.md`](./guides-module-status.md) for what the module does today.

# Feedback on the Guides Bundle Contract, v0.1

From the guides module (EZ-DevDocs) to the portal side. The contract was enough to build a first
version without working around it. This document answers the open questions, proposes changes, and
lists every place where the contract is silent and this module had to assume something.

## Answers to the open questions (contract section 8)

1. **Content the contract cannot express.** Diagrams, video and widgets are not needed for this
   version, which writes only what a spec supports. One thing is needed and missing: a way to mark
   content as waiting for a person (proposal 1). Mermaid would be used for multi-step flows if it
   were available as a fenced `mermaid` block rendered by the portal, but it is not blocking.
2. **More than one spec version.** No. A bundle is generated from one spec document and pinned to it
   by hash. Versions are best handled by the portal holding one bundle per spec version.
3. **Localization.** Out of scope for this version. Generated prose is English; text taken from the
   spec stays in the spec's language. If it comes into scope, one bundle per locale would be simpler
   than a locale dimension inside the layout.
4. **Disabling "Try it" per sample.** Yes. Proposed as `tryIt="false"` on `<Sample>`. The module
   would set it on delete calls and has no way to say so today.

## Proposed changes

1. **A marker for incomplete content.** The brief asks for honest gaps, marked so a person can
   complete them. The contract has no such marker, so gaps are currently recorded only in
   `report.json`, outside the bundle, and one reader-visible callout in the quickstart says that the
   spec does not describe how credentials are issued. Proposal: an optional frontmatter field
   `status: draft | review | ready`, and a `<Todo>` component that the portal shows in preview and
   refuses to publish.
2. **`tryIt` on `<Sample>`**, as above.
3. **Named examples together with path values.** `example="…"` cannot be combined with inline values,
   so an operation with a path parameter can never use a named example. The module copies the
   example's value into an inline block instead. Proposal: allow both, with inline `path`, `query`
   and `headers` added to the named example's body.
4. **Exempt `concept` pages from the "not referenced by any operation" warning.** Pages such as
   Authentication and Errors have no natural operation list and will always warn.
5. **Publish the full list of error codes.** The contract says codes are part of it but names only
   `unknown-operation`. The codes this module's validator uses are listed below; it will adopt the
   portal's names once they exist.
6. **A place for the run report.** If the portal wants to show skipped pages and gaps to the
   customer, allow an optional `report.json` in the bundle. Today any extra file is assumed invalid.

## Assumptions made where the contract is silent

Each of these should be confirmed or corrected. The module's validator enforces them as written here.

| # | Topic | Assumption |
|---|---|---|
| 1 | `<Sample>` with no inputs | An operation that needs no values is written `<Sample operation="x" />`, with neither `example` nor a block. |
| 2 | What `example` names | A named example of the operation's request body (or of one of its parameters). |
| 3 | Variables and schema validation | A value containing a variable, such as `"petId": "{{pet_id}}"`, is exempt from schema validation, including where the schema says integer. The portal substitutes the captured value with its original type. |
| 4 | `capture` syntax | One `name=JSONPath` pair is emitted per sample. The validator accepts several separated by spaces or commas. Names match `[a-z][a-z0-9_]*`. Paths use only `$`, `.name` and `[n]`. |
| 5 | Literal `<` and `{` in prose | Written `\<` and `\{`, as CommonMark allows. The contract defines only `\{{`. |
| 6 | Attribute values | Double-quoted only; a `"` inside a value is replaced with `'` and braces are removed, since no escape is defined. Variables are never written into attributes or inline code spans. |
| 7 | Markdown inside components | Component tags sit on their own lines, separated from content by blank lines. A tag fits on one line. |
| 8 | Card links | `href` on `<Card>` takes the same link forms as Markdown links. |
| 9 | Fragment links | `#anchor` alone is not allowed. `guide:slug#anchor` is, but the module never emits one because the anchor format is undefined. |
| 10 | Webhooks | Webhook operations are not valid targets for `op:` or `<Operation>`. The webhooks page links payload schemas only. |
| 11 | Derived `operationId` | The method, then the path with each non-alphanumeric character replaced by `_`: `get` + `/payments/{id}` gives `get_payments__id_`. This matches the brief's example; read literally, `{method}_{path}` would give a double underscore. Two paths can collide (`/a-b` and `/a_b`). |
| 12 | Identifier characters | Some specs use ids such as `repos/get` (GitHub). The module links and samples only ids matching `[A-Za-z0-9_.\-/:~@$]+` and schema names matching `[A-Za-z0-9_.\-]+`; others are shown as text. The portal should state what it accepts in `op:` links and attributes. |
| 13 | Nav labels | The schema allows `label` on a page entry; the contract text does not mention it. Not used. |
| 14 | Hand-written request code | The contract forbids it but names no check. The validator rejects code blocks that run `curl`, `wget` or `http`, or that call `fetch`, `axios` or `requests` against `{{base_url}}`. |
| 15 | Unknown header in a sample | A header that is not a declared parameter of the operation is an error. |
| 17 | Bare URLs in prose | GFM autolink literals are not in the contract's dialect, so a bare `http://…` taken from a spec description is assumed to render as text. If the portal enables them, non-https links could appear; say so and the module will break them up. |
| 18 | Entities | Text taken from specs has `&` escaped, so `&#123;&#123;api_key&#125;&#125;` in a description cannot become a variable. The portal should substitute variables before, not after, decoding entities. |
| 16 | OpenAPI 3.2 | Read as 3.1 and reported. The contract names 3.x. |

## Error codes used by this module's validator

Errors: `missing-manifest`, `invalid-manifest`, `unsupported-contract-version`, `missing-page`,
`duplicate-page`, `nav-depth`, `unexpected-file`, `invalid-path`, `invalid-encoding`, `size-limit`,
`asset-type`, `invalid-frontmatter`, `heading-h1`, `disallowed-syntax`, `unknown-component`,
`unknown-attribute`, `invalid-attribute`, `invalid-nesting`, `unbalanced-component`,
`unknown-variable`, `unknown-operation`, `unknown-schema`, `unknown-guide`, `unknown-asset`,
`unknown-response`, `unknown-example`, `link-not-allowed`, `invalid-sample`, `invalid-capture`,
`invalid-code-info`, `api-request-code`, `unsupported-syntax`.

Warnings: `spec-hash-mismatch`, `deprecated-operation`, `image-missing-alt`, `page-unreferenced`.
