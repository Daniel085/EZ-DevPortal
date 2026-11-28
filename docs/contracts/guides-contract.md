# Guides Bundle Contract

Status: **draft v0.3**, 2026-11-28. 0.3 is the portal side's answer to the guides module's second
round of feedback, the section "On v0.2" of
[`guides-contract-feedback.md`](./guides-contract-feedback.md), written after the module had
implemented 0.2 and run its guides against a real API. Every item is decided in
[section 13](#13-decisions-on-the-v02-feedback), and section 12 lists what changed. 0.2 was
released to the guides module, so these changes carry a new version: a portal implementing this
document accepts `"0.3"` only (section 7). The security reviewer reviewed this draft on 2026-11-28
and passed it subject to required fixes
(`docs/reviews/2026-11-28-security-review-contract-0.3.md`). They are applied here. 0.3 had not
been released to the guides module when they were made, so the version is unchanged; the end of
section 12 lists them. **One thing stays blocked:** the portal runs the module on no tenant's
spec until its owner has answered two questions about it (section 6, "Running the module on
tenant specs is blocked").

How 0.2 came about: it was revised by the portal side in response to the guides module's feedback on
v0.1 ([`guides-contract-feedback.md`](./guides-contract-feedback.md)). Every proposal and assumption
in that feedback is answered by number in [section 11](#11-decisions-on-the-v01-feedback). This
draft also carries the corrections required by the security design review of 2026-11-26 and by its
re-review the same day, which passed the contract subject to fixes that are applied here. They were
made before 0.2 was released to the guides module, so the version is unchanged; section 10 lists
them. Product decisions of 2026-11-27 are recorded the same way: guides are generated from the
patched spec (1.2), incomplete content is resolved by editing the bundle in Git (4.7, 6), and the
allowed hosts of a server with an open host variable are listed as its `enum` (4.3).
The security review of 2026-11-27 is applied the same way: the rule for a host variable with no
`enum` is tightened (4.3), and the published spec of a hosted portal is not a public download by
default (1.2).
Four further decisions by the user on 2026-11-27 are recorded the same way: the portal runs the
guides module and delivers its output as a pull request on the tenant's repository (4.7, 6); the
portal provides the "get a key" link (9); a portal that is a private preview serves nothing
without sign-in (9); and one bundle belongs to one version of one API (3).
Two more decisions by the user that day are recorded the same way: a `<Todo>`, or a page that is
not `ready`, withholds its own page and not the bundle (4.7, 5); and "Try it" in a private
preview shows the spec's example response and sends nothing (9). Two later decisions that day
replace part of the second: "Try it" makes live calls in a private preview where the server's
host is verified, and example-response mode is the mode for any server that gets no live calls
(9).
Awaiting the guides module's re-sync and confirmation.

This is the interface between two projects:

- **Guides module** (separate project): takes an OpenAPI spec and produces developer guides.
- **EZ-DevPortal** (this project): renders the API reference, code samples, theme and hosting, and
  ingests the guides.

The guides module produces a **guides bundle**. The portal runs the module, validates the bundle and
renders it. It never changes what a bundle says: a bundle's content is the module's output and the
edits people make to it in Git (4.7, 6).

The words **must**, **must not** and **may** are normative. Where a rule names an error code, a
validator on either side reports that code for that violation.

## 1. Division of responsibility

| Concern | Owner |
|---|---|
| Guide prose, structure, ordering, which operations a guide covers | Guides module |
| API reference pages, schema rendering | Portal |
| API request code samples in every language | Portal |
| Credentials in samples and in "Try it" | Portal |
| Theme, layout, navigation chrome, search, `llms.txt`, Markdown twins | Portal |
| Resolving links to operations, schemas and other guides | Portal |
| Substituting the reader's API key and base URL | Portal |
| Running the guides module, and proposing its output to the tenant's repository as a pull request | Portal |
| Transport of the bundle into the portal | Portal |

The rule that follows from this table: **a guide never contains hand-written API request code.** It
names an operation and the values to send, and the portal renders the sample in every language. This
keeps guides in step with the reader's language choice and with the samples the portal tests.

### 1.1 The spec, and how operations are identified

- The contract is defined for OpenAPI **3.0 and 3.1**. A 3.2 document is read as 3.1 by both sides;
  constructs that exist only in 3.2 are ignored and cannot be referenced. Swagger 2.0 is out of
  scope: the portal rejects such a spec with a clear message and publishes nothing for it, so there
  is nothing to generate guides from.
- "The spec" in this contract always means the **published spec** defined in 1.2: the tenant's
  document with the accepted spec-doctor fixes applied. Operation ids, schema names, examples and
  every other lookup are taken from it, on both sides.
- An **operation** is an HTTP operation under `paths`. Webhooks and callbacks are not operations in
  this contract and are not valid targets for `op:` links, `<Operation>`, `<Sample>`, `<Response>`
  or the `operations` frontmatter field. Each of those reports `unknown-operation`.
- An operation is referred to by its **operation id**, compared exactly, code point for code point,
  case-sensitively. A schema is referred to by its key under `components/schemas`, compared the same
  way.

**Operation ids.** Both projects must derive identical ids, so the algorithm is fixed. Both run it
on the published spec (1.2):

1. List every operation as a (path, method) pair. The path is the key under `paths`, exactly as
   written. The method is lowercase.
2. Sort the list by path, then by method. Both comparisons are by Unicode code point, not by locale
   and not by UTF-16 code unit.
3. Walk the list in order. An operation whose `operationId` is present, is not the empty string, and
   has not already been taken by an earlier operation in the list keeps that `operationId` as its id.
   Every other operation is marked as needing a derived id.
4. Walk the operations marked in step 3, in the same order. The base id is the method, immediately
   followed by the path with each code point outside `A-Z a-z 0-9` replaced by one `_`. No separator
   is inserted between method and path; the path's leading `/` supplies the underscore. If the base
   id is not yet the id of any operation, explicit or derived, it becomes the id. Otherwise append
   `_2`, then `_3`, and so on, and take the first that is unused.

| Operations in the spec | Ids |
|---|---|
| `get /payments/{id}`, no `operationId` | `get_payments__id_` |
| `get /`, no `operationId` | `get_` |
| `post /a-b` and `post /a_b`, neither with an `operationId` | `/a-b` sorts first and gets `post_a_b`; `/a_b` gets `post_a_b_2` |
| `get /pets` with no `operationId`; `get /animals` with `operationId: get_pets` | `get /animals` is `get_pets`; `get /pets` is `get_pets_2` |
| `get /a` and `get /b`, both with `operationId: list` | `get /a` is `list`; `get /b` is `get_b` |

### 1.2 The published spec

The portal's spec doctor proposes fixes to the tenant's spec, and the tenant accepts some of them.
The portal is built from the result, and **guides are generated from the same result, not from the
tenant's original document.**

- The **published spec** is the root OpenAPI document with the accepted fixes applied. The portal
  writes it out as a file each time it publishes the spec. It is an output of publishing, produced
  by the portal's publisher (ADR 0003, "The published spec"; ADR 0004).
- Its bytes are fixed at publish time. If no fix was applied to the root document, the published
  spec is the document as the portal fetched it, byte for byte. Otherwise it is the portal's
  serialization of the patched document, in the source's format (YAML or JSON), encoded as UTF-8.
- The guides module is given the published spec by the portal, generates from those bytes, and
  hashes those bytes (section 3). It must not parse and re-serialize the document before hashing,
  and must not generate from the tenant's original.
- Where the bytes come from depends on how the portal is run. A static build writes the file
  beside the portal's other output as `spec/openapi.json` or `spec/openapi.yaml`, unless the
  person running the build chose to omit it; they then hand the same bytes over another way. A
  hosted portal runs the guides module itself, as a step of its own pipeline, and passes it the
  bytes (section 6; decided 2026-11-27). The guides module fetches nothing: there is no URL for
  it to read the published spec from, public or authenticated, and it must not assume one. A
  hosted portal does not offer the file for public download unless its tenant chooses that. The
  bytes and the hash are the same whichever way they arrive (ADR 0003, "The published spec").
- The published spec holds the whole root document, including comments and `x-` fields. The
  portal removes nothing from it.
- A spec-doctor fix never changes an operation id. Where a fix adds an `operationId`, the value it
  writes is exactly the id the algorithm in 1.1 gave that operation before the fix (ADR 0004). So
  accepting or removing such a fix leaves every id as it was.
- The order of events is: the portal fetches the spec; the spec doctor reports findings; the tenant
  accepts fixes; the portal publishes, which produces the published spec; the portal runs the
  guides module on it, which writes a bundle; the bundle reaches the tenant's repository as a
  pull request, or is held by the portal while no repository is connected (section 6); the
  portal ingests the bundle.
- The published spec changes whenever its bytes change: the tenant's document changed upstream, a
  further fix was accepted (including one that lists a server's allowed hosts, 4.3), an accepted
  fix was removed, or an accepted fix stopped applying because the upstream document changed
  under it. From then on a bundle generated from the earlier bytes is reported with
  `spec-hash-mismatch` (section 3) until the guides are regenerated.
- Only the root document is covered. A spec split over several files keeps its external `$ref`s
  as written, and the hash in section 3 does not cover the files they point to. See the open items
  in section 8.

## 2. Bundle layout

The bundle is a directory. The directory that contains `guides.json` is the **bundle root**; its own
name is not significant. All paths in this contract and in validation reports are relative to it.

```
guides.json          manifest (required)
guides.lock.json     generation record: what the generator wrote, and what a person deleted (see 5.3)
settings.json        the tenant's settings for the generator (optional, see 5.4)
pages/               one file per guide, .md
  quickstart.md
  payments/accept-a-payment.md
assets/              images and downloadable files (optional)
  payments/flow.png
```

- The root may contain only `guides.json`, `guides.lock.json`, `settings.json`, `pages/` and
  `assets/`. Anything else,
  including dotfiles, symbolic links, empty directories outside this layout, and files under
  `pages/` that do not end in `.md`, is `unexpected-file`.
- **The run report is not a bundle file.** A generator's `report.json` is a second output of a
  run, written beside the bundle directory and never in it; the portal keeps it and it never
  reaches the tenant's repository (5.2). A `report.json` at the bundle root is
  `unexpected-file`, like any other file this layout does not name. Earlier drafts allowed it
  there.
- `guides.json`, `guides.lock.json`, `settings.json` and every page are UTF-8
  without a byte order mark, with LF line endings and no NUL characters. A violation is
  `invalid-encoding`.
- A file path under `pages/` or `assets/` is one or more segments separated by `/`. Each segment
  matches `[a-z0-9-]+`. The last segment is followed by one extension matching `\.[a-z0-9]+`. The
  whole path is at most 200 characters. A violation is `invalid-path`.
- Limits: 1 MB for `guides.json`, 2 MB per page, 16 KB for a page's frontmatter (section 4),
  2 MB for `guides.lock.json`, 64 KB for `settings.json`, 5 MB per asset,
  200 MB and 5,000 files per bundle. A violation is `size-limit`.
- JSON in a bundle is nested at most 64 deep. This covers `guides.json`, `guides.lock.json`,
  `settings.json` and the inline block of a `<Sample>` (4.3). The top-level value
  is at depth 1, and each object or array inside another is one deeper. The portal enforces the
  cap while it parses. Deeper JSON is treated as not valid JSON: `invalid-manifest`,
  `invalid-lock`, `invalid-settings` or `invalid-sample`.
- No object in `guides.lock.json` or `settings.json` has a duplicate key. One that has is
  treated as not valid JSON in the same way: `invalid-lock` or `invalid-settings`. The portal
  detects a duplicate while it parses and never lets a later key replace an earlier one. The
  same two rules, depth and duplicate keys, hold for the run report (5.2), and the inline
  block of a `<Sample>` already forbids duplicate keys (4.3).
- Allowed asset extensions: `png`, `jpg`, `webp`, `gif`, `svg`, `pdf`, `json`, `zip`. Any other
  extension, or a file whose content is not of the type its extension names, is `asset-type`.
- Assets are untrusted. The portal shows images only through image elements and never inlines an
  asset into a page as markup. SVG sanitizing is an allowlist that rejects DOCTYPE, entities,
  `script`, `foreignObject`, event attributes and external references. A zip is never unpacked.
- Where an asset is served from depends on its type. A generator is not affected: it writes
  `asset:` targets and the portal builds the URL. What this means for the portal's hosting modes is
  in section 9.
  - svg, pdf, json and zip always use the asset origin: a dedicated per-tenant origin, never the
    portal's or the customer's origin.
  - png, jpg, webp and gif use the asset origin too, with one narrower option: an image of these
    four types that has been re-encoded by the portal may be served on the page origin with
    `X-Content-Type-Options: nosniff`. Re-encoded means the portal decoded the image and wrote a
    new file of the same type; the bytes that came in the bundle are never served on the page
    origin. An image the portal cannot re-encode stays on the asset origin.
  - Every response from the asset origin has: `Content-Type` from the portal's extension table;
    `X-Content-Type-Options: nosniff`; `Cross-Origin-Resource-Policy: cross-origin`;
    `Content-Security-Policy: default-src 'none'; sandbox`, and for svg
    `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`;
    `Content-Disposition: attachment` for svg, pdf, json and zip.

## 3. Manifest: `guides.json`

The JSON Schema is in [`guides-manifest.schema.json`](./guides-manifest.schema.json).

```json
{
  "contractVersion": "0.3",
  "generator": { "name": "guides-module", "version": "1.4.0" },
  "spec": {
    "sha256": "9f2c…",
    "title": "Acme Payments API",
    "version": "2026-10-01"
  },
  "generatedAt": "2026-11-26T18:00:00Z",
  "nav": [
    { "page": "quickstart" },
    {
      "group": "Payments",
      "items": [
        { "page": "payments/accept-a-payment" },
        { "page": "payments/refunds", "label": "Refunds" }
      ]
    }
  ]
}
```

- A missing manifest is `missing-manifest`. One that is not JSON, is nested deeper than 64
  (section 2) or fails the schema is `invalid-manifest`. One larger than 1 MB is `size-limit`.
- `contractVersion` must be exactly `"0.3"` for a portal implementing this document. Anything else,
  `"0.2"` included, is `unsupported-contract-version`. See section 7. `generator.version` is the
  generator's own version and has nothing to do with it: the guides module's release 0.3.0 wrote
  bundles for contract 0.2.
- `spec.sha256` is the SHA-256, in lowercase hex, of the bytes of the published spec (1.2) the
  guides were generated from: the patched root document exactly as the portal published it, with no
  normalization. When no fix was applied, those are the bytes of the tenant's original document.
  The portal compares the value with the hash of the published spec it is serving and reports
  `spec-hash-mismatch` (a warning) when they differ. A bundle is pinned to one published spec.
- **One bundle belongs to one version of one API.** A portal may hold several APIs, and later
  several versions of one API (decided 2026-11-27). Each has its own published spec and its own
  bundle, and the portal keys both by project, API and version. Nothing in a bundle names that
  key: an operation id, a schema name, a `guide:` slug and an `asset:` path resolve within the
  bundle's own API version and cannot point into another. A generator sees one spec and writes
  one bundle, as before.
- `generatedAt` is optional. A generator may leave it out to make output byte-identical.
- `nav` is the single source of ordering and grouping. A group at the top level of `nav` is at depth
  1; a group inside it is at depth 2. A group at depth 4 or deeper is `nav-depth`. Pages may appear
  at the top level or inside any group. The portal checks nav depth while it parses the manifest,
  and stops at the first group that is too deep; it does not build the tree first.
- A `page` value is the file path under `pages/` without the `.md` extension. It is the page's
  **slug**. The portal builds the page's URL from it; the URL itself is the portal's.
- Guides are served under a prefix reserved for them, below the base URL of their API version. No
  slug can therefore collide with one of the portal's own routes or with a guide of another API,
  and a generator may use any slug the path rules in section 2 allow.
- Every page file must appear in `nav` exactly once. A nav entry with no file is `missing-page`. A
  file under `pages/` with no nav entry is `unlisted-page`. A slug that appears twice is
  `duplicate-page`.
- `hidden: true` keeps a page out of the sidebar. The page is still published and linkable. It is
  not the same as a withheld page (4.7), which is not published at all.
- `label` is optional plain text shown in the sidebar instead of the page's `title`. It changes
  nothing else.

## 4. Page format

Each page is Markdown with YAML frontmatter.

```markdown
---
title: Accept a payment
description: Create a payment, confirm it, and handle the result.
type: how-to
status: ready
operations: [createPayment, confirmPayment]
---
```

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Plain text, 1 to 80 characters. Rendered as the page `h1`. |
| `description` | yes | Plain text, 1 to 200 characters. Used for search, SEO and `llms.txt`. |
| `type` | yes | `quickstart`, `concept`, `how-to`, `tutorial` or `reference` |
| `status` | no | `draft`, `review` or `ready`. Default `ready`. See 4.7. |
| `operations` | no | List of operation ids the guide covers. The portal links back to the guide from each of those reference pages. An id that is not in the spec is `unknown-operation`. |
| `tags` | no | List of free-form strings for search filtering. |

- Frontmatter is required, starts on line 1, and is a single YAML mapping of the fields above. An
  unknown field, a wrong type, a missing required field, or a value outside the stated range is
  `invalid-frontmatter`.
- Only plain YAML is allowed: string scalars and sequences of strings. Anchors, aliases, tags, merge
  keys and multiple documents are `invalid-frontmatter`. Anchors, aliases, tags and merge keys are
  detected in the token stream before any expansion; duplicate keys are `invalid-frontmatter`;
  frontmatter is at most 16 KB, counted from line 1 to the closing `---` line, and a longer one is
  `size-limit`. An operation id that YAML would not read as a plain string, such as one containing
  `: ` or starting with `@`, is quoted.
- Frontmatter values are literal text. Markdown, components and variables are not recognised in them.
- The body must not contain an `h1`, in either ATX or setext form (`heading-h1`). Headings start at
  `h2`.

### 4.1 Markdown dialect

CommonMark plus these GitHub-flavored extensions and no others: tables, task lists, strikethrough,
footnotes.

**Not allowed**, each reported as `disallowed-syntax`:

- Raw HTML of any kind, block or inline, including comments, processing instructions, `<script>`,
  `<style>`, `<iframe>` and inline event handlers.
- Autolinks in angle brackets, `<https://example.com>` and `<name@example.com>`. Write a link as
  `[text](https://example.com)`.

**There is no expression syntax.** The dialect is not MDX. `{…}`, `import` and `export` have no
meaning: in prose they are ordinary text, they are never evaluated, and they are not an error. A
`{` needs no escape, though `\{` is allowed. Only the exact form `{{name}}` is special (4.6).

**GFM autolink literals are not part of the dialect.** A bare `https://example.com`,
`http://example.com` or `www.example.com` in prose is text. The portal must not turn it into a link.

**The `<` rule.** Outside code spans and code blocks, an unescaped `<` followed by an ASCII letter,
`/`, `!` or `?` must begin a component tag from 4.2. If it does not, the page is invalid:
`unknown-component` when what follows is a name starting with an uppercase letter, otherwise
`disallowed-syntax`. A `<` followed by anything else is text. A literal `<` before a letter is
written `\<`.

**Escapes.** Backslash escapes and character references work as in CommonMark. `\<`, `\{`, `\*` and
the rest produce the literal character. A character produced by a backslash escape or by a character
reference is always text: it never opens a component tag and never forms part of a variable (4.6).

**Nesting.** Markdown nesting is capped at 32. The depth of a point in a page is the number of
these constructs open around it: block quote, list item, component, footnote definition, table
cell, emphasis, strong emphasis, strikethrough, link and image. A depth greater than 32 is
`nesting-limit`. The portal enforces the cap while it parses, not on a finished tree.

The reason for these rules is tenant isolation. The portal is multi-tenant and treats guide content
as data. It parses pages into a syntax tree and renders only known nodes. Nothing in a bundle is
ever executed, compiled or passed through as HTML.

### 4.2 Components

A closed set of block-level components. Unknown tags are `unknown-component`; unknown attributes are
`unknown-attribute`.

| Component | Attributes | Content |
|---|---|---|
| `<Callout>` | `type`: `note`, `tip`, `warning` or `danger`, default `note`. `title`: optional. | Markdown. No components. |
| `<Steps>` | none | One or more `<Step>`, nothing else. |
| `<Step>` | `title`: required. | Markdown and any component except `<Steps>` and `<Step>`. |
| `<Tabs>` | none | One or more `<Tab>`, nothing else. |
| `<Tab>` | `title`: required. | Markdown and any component except `<Tabs>` and `<Tab>`. |
| `<CardGroup>` | `cols`: `1`, `2`, `3` or `4`, default `2`. | One or more `<Card>`, nothing else. |
| `<Card>` | `title`: required. `href`: optional, a link target as in 4.5. | Markdown. No components. May be self-closing. |
| `<Operation />` | `id`: required, an operation id. | Self-closing. Summary card linked to the reference page. |
| `<Schema />` | `ref`: required, a key under `components/schemas`. | Self-closing. Inline rendering of the schema. |
| `<Sample>` | See 4.3. | Self-closing, or exactly one fenced `json` block. |
| `<Response />` | `operation`: required. `status`: required. | Self-closing. See below. |
| `<Todo>` | `title`: optional. | Markdown. No components. See 4.7. |

`<Response>` shows the spec's response for that operation and status. `status` must equal a key of
the operation's `responses` exactly, for example `201`, `default` or `4XX`; otherwise
`unknown-response`. The portal shows the same example its reference page shows for that response.

**A page may hold any number of each component.** Nothing limits how often a component appears
on a page or inside a parent that allows it. Several `<Steps>` on one page, each under its own
`h2`, is valid, and so are several `<Tabs>` or `<CardGroup>`. The limits are the ones the table
and the nesting rule below state: a `<Steps>` cannot be inside a `<Step>`, directly or at any
depth, so two `<Steps>` are siblings and never nested.

**Attributes.**

- Written `name="value"` with double quotes, always, including for numbers and booleans:
  `cols="2"`, `tryIt="false"`. Single quotes, no quotes, or a name with no value is
  `invalid-attribute`.
- A value is any sequence of characters other than `"` and line breaks. There is no escape
  mechanism and no character-reference decoding inside a value: the characters between the quotes
  are the value, verbatim. `<`, `>`, `{`, `}`, `&` and `\` are literal. A value cannot contain `"`.
- Variables are not recognised in attribute values.
- A missing required attribute, a repeated attribute, or a value outside the allowed set is
  `invalid-attribute`.

**Placement.**

- A component tag, whether opening, closing or self-closing, is alone on its line, on a single line,
  indented by 0 to 3 spaces. Nesting is not expressed by indentation.
- A tag line is preceded and followed by a blank line, the start or end of the page body, or another
  tag line. The one exception is inside `<Sample>`, where the fenced block may directly follow the
  opening tag and directly precede the closing tag, with or without blank lines.
- Components appear at the top level of the page or inside another component as the table allows.
  They must not appear inside list items, block quotes, tables or footnotes.
- A violation of any of these three rules is `invalid-tag-placement`.
- A component inside a parent that does not allow it, content other than what the table allows, or a
  component nested inside itself at any depth, is `invalid-nesting`.
- An opening tag with no matching closing tag, a closing tag with no opening tag, or tags closed out
  of order, is `unbalanced-component`.

### 4.3 API samples

`<Sample>` tells the portal which operation to call and with what values. The portal generates the
code for each language, adds the credentials the operation requires, applies the reader's language
choice, and can offer "Try it".

| Attribute | Required | Value |
|---|---|---|
| `operation` | yes | An operation id. |
| `example` | no | The name of an example in the spec, defined below. |
| `title` | no | Plain text shown above the sample. |
| `capture` | no | Values to carry into later samples, defined below. |
| `tryIt` | no | `true` or `false`. Default `true`. |

There are four forms.

**1. No inputs.** The portal renders the operation's default sample, the same one its reference page
shows. This is the form for an operation that needs no values, and it is valid for any operation.

```markdown
<Sample operation="getInventory" />
```

**2. A named example from the spec.**

```markdown
<Sample operation="createPayment" example="card-payment" />
```

**3. Inline values**, as a single fenced block with the info string `json`.

````markdown
<Sample operation="createPayment" title="Create a 20.00 USD payment">
```json
{
  "headers": { "Idempotency-Key": "{{idempotency_key}}" },
  "body": { "amount": 2000, "currency": "usd" }
}
```
</Sample>
````

**4. A named example plus inline values.** For example, an operation with a path parameter whose
body comes from the spec:

````markdown
<Sample operation="updatePayment" example="raise-amount">
```json
{
  "path": { "id": "{{payment_id}}" }
}
```
</Sample>
````

**The sample media type.** Where an operation's request body offers more than one media type, the
portal uses `application/json` if present; otherwise the first media type, in document order, whose
subtype ends in `+json`; otherwise the first media type in document order.

**What `example` names.** `example="N"` selects, together:

- the entry with key `N` in the `examples` map of a request body media type. The sample media type
  is searched first, then the others in document order. The media type where `N` is found becomes
  the media type of this sample; and
- for every path, query and header parameter of the operation that has an `examples` map with key
  `N`, that example's value for that parameter.

At least one of these must exist, or the sample is `unknown-example`. The singular `example` fields
of OpenAPI have no name and cannot be selected. An example given as `externalValue` cannot be
selected and is `unknown-example`.

**The inline block.**

- It must be valid JSON whose top level is an object with no duplicate keys, nested at most 64
  deep (section 2).
- The only top-level keys are `path`, `query`, `headers` and `body`. All four are optional. A
  generator includes only the keys that have values; an absent key means no values of that kind.
  `{}` is valid and means a request with no values, which is not the same as form 1.
- `path`, `query` and `headers` are objects that map a parameter name to its value. Path and query
  names are case-sensitive. Header names are compared case-insensitively.
- `body` is the request body as JSON. For a JSON media type it is sent as is. For
  `application/x-www-form-urlencoded` and `multipart/form-data` it is an object whose members the
  portal serializes as form fields. For a `text/*` media type it is a JSON string. A binary body
  cannot be expressed in 0.3.
- Any violation of the rules in this list is `invalid-sample`.

**Merging forms 2 and 3.** The named example supplies its values first. Inline `path`, `query` and
`headers` are then added one parameter at a time, and an inline value replaces the example's value
for the same parameter. If the named example supplies a request body and the inline block has a
`body` key, the sample is `invalid-sample`: there is exactly one source for the body.

**Validation of values.** For forms 2, 3 and 4 the portal validates the merged values against the
operation. Nothing is filled in from defaults except portal-supplied parameters, defined below.

| Condition | Result |
|---|---|
| A value does not match its parameter's schema, or `body` does not match the request body schema of the sample media type | `invalid-sample` |
| A required path, query or header parameter that is not portal-supplied (below), or a required request body, has no value | `invalid-sample` |
| A `path` name is not a parameter in the operation's path template | `invalid-sample` |
| A `body` is given and the operation has no request body | `invalid-sample` |
| A `query` or `headers` name is not a declared parameter of the operation | `undeclared-parameter`, a **warning**. The value is sent as written, unless a row below applies. |
| A `headers` name is one the portal controls, listed below, whether or not the operation declares it | `invalid-sample` |
| A `headers` or `query` name is one that a security scheme in the spec uses to carry a credential | `invalid-sample` |
| A `headers` name is not an RFC 9110 `token`, or a header value contains CR, LF or NUL | `invalid-sample` |

A declared parameter is one listed on the operation or on its path item, after references are
resolved. A string value that contains a variable is exempt from schema validation, as 4.6 defines.

**Portal-supplied parameters.** A spec may declare, as a parameter of an operation, something a
bundle is not allowed to set. Such a parameter is **portal-supplied**. A declared parameter is
portal-supplied when it is one of these:

1. a header parameter whose name is a header the portal controls (the list below);
2. a header or query parameter whose name carries a credential (defined below);
3. a cookie parameter. The inline block has no key for cookies, and the portal alone builds
   the `Cookie` header (below).

For a portal-supplied parameter, in every form of `<Sample>`:

- **A sample never sets it.** For 1 and 2 that is the two `invalid-sample` rows above, which
  apply whether or not the operation declares the name. For 3 there is no key to write it under.
- **It is never counted as missing.** `required: true` on it does not make a sample invalid, and
  the row for a required parameter with no value does not apply to it. A sample for an operation
  that declares `Authorization`, or its API key header, as a required parameter is valid without
  that header, and invalid with it.
- **The portal decides what is sent, from the published spec alone:**
  - *A name that carries a credential.* The sample generator places the reader's credential
    there only for the schemes of the one security requirement object in effect for the
    request: the operation's `security`, else the document's; `security: []` means none; where
    there are alternatives, only the one the reader selected. Until a reader selects, and in
    everything published, that is the first alternative in the spec's order (ADR 0005). This
    is exactly what the generator does when the parameter is not declared. The declaration
    adds nothing: its `example`, `default` and schema are never used as a value, and the
    request has that header, query parameter or cookie once. So an API key header declared
    both as a security scheme and as a parameter is sent once, holding the credential. Where
    the requirement in effect does not include the scheme, nothing is sent under that name,
    whether or not the parameter is required, and the spec doctor reports the parameter
    (ADR 0004).
  - *`Authorization`, `Content-Type` and `Accept` declared as header parameters.* OpenAPI says
    such a definition is ignored, and the portal's model does not contain it (ADR 0002). The
    first two are on the controlled list: `Authorization` is set only from the security
    requirement and `Content-Type` only from the sample media type. `Accept` is not on the list.
    Because the model never holds it as a declared parameter, it is never required, and a
    sample that sets it gets `undeclared-parameter` and the value is sent.
  - *Any other controlled header, except `Cookie`.* No value from the spec or from a bundle
    is sent for it. The spec doctor reports an operation that requires one, and "Try it" is
    withheld for it (below).
  - *Cookies.* The portal alone builds `Cookie`, from the credential cookie and declared
    non-credential cookies, each through a cookie encoder (name is a token; value has no `;`,
    `,`, space, quote or control character). A name equal to a credential cookie's is never
    filled from the spec. The credential cookie is the cookie of an `apiKey` scheme with
    `in: cookie`, placed under the rule for a name that carries a credential, above. A
    declared cookie parameter that carries no credential is filled, when it is required, as
    in the operation's default sample. A name or value the encoder refuses is left out of the
    header, nothing stands in for it, and the spec doctor reports it (ADR 0004); the encoder
    refuses and never rewrites, so a value from a spec example cannot add a second cookie or
    shadow the credential. No bundle, and no header parameter a spec declares under the name
    `Cookie`, ever supplies the header's text.

**A name that carries a credential.** Taken from every scheme under `components/securitySchemes`
of the published spec, whether or not a security requirement uses it:

| Scheme | Name |
|---|---|
| `apiKey` with `in: header` | That header name, compared case-insensitively |
| `apiKey` with `in: query` | That query parameter name, compared exactly |
| `apiKey` with `in: cookie` | That cookie name, compared exactly |
| `http`, `oauth2`, `openIdConnect` | The header `Authorization`, which is already on the controlled list |
| `mutualTLS` | None |

None of this gives a bundle a way to name or place a credential. There is still no credential
variable (4.6).

**Headers the portal controls.** Names are compared case-insensitively.

- These names: `Authorization`, `Cookie`, `Host`, `Content-Type`, `Content-Length`,
  `Transfer-Encoding`, `Connection`, `Forwarded`, `X-Real-IP`, `Via`, `TE`, `Trailer`, `Upgrade`,
  `Keep-Alive`, `Expect`, `Origin`, `Referer`, `X-HTTP-Method`, `X-HTTP-Method-Override`,
  `X-Method-Override`.
- Every name that begins with `X-Forwarded-`, `Proxy-` (which covers `Proxy-Authorization`) or
  `Sec-`.
- Every name that begins with the portal's internal prefix, `X-Ezdp-`. The proxy also strips
  every header with this prefix from inbound requests, whoever sent them.

An operation that requires a controlled header gets a spec-doctor finding and "Try it" is withheld
for it; see "When the portal will not send a request" below.

**Header syntax.** Header names match the RFC 9110 `token`; values contain no CR, LF or NUL;
otherwise `invalid-sample`. Checked again after substitution: the bundle check sees the value as
written, with JSON escapes decoded, and the portal repeats the check on the final value once
variables have been filled in (4.6). If the value fails then, the request is not sent.

**This table is a bundle check, not a security control.** The proxy and MCP enforce the same rules
on every request, server-side, from the published model: destination only from the model's servers,
with server variables limited as the next paragraph says, subject to the proxy destination policy
in ADR 0003; final method and path must match an operation the tenant enabled. A request that never
passed through a bundle validator, such as a direct call to the proxy, meets the same rules.

**Server variables.** A server variable that has an `enum` takes one of its values. An empty
`enum` allows no value. With no `enum`: a variable in the port is `[0-9]{1,5}`; in the path,
`[A-Za-z0-9._~-]+` segments joined by `/`, none `.` or `..`. With no `enum`, a variable in the
host is callable only if: (a) its value matches `[A-Za-z0-9_-]{1,63}` and the label it sits in is
at most 63 characters; (b) that label is followed by `.` and then literal text to the end of the
host, with no variable in it; (c) that literal text is not an IP address and is not a public
suffix under the Public Suffix List, ICANN and private sections, so it contains a registrable
domain. Any other host variable needs an `enum`, or the server is not callable. The list is a
pinned snapshot shipped as data. So `https://{x}.example.com` and `https://api-{x}.example.com`
are callable with no `enum`, and `https://{host}/v1`, `https://{x}example.com`,
`https://{x}.co.uk` and `https://{x}.github.io` are not (ADR 0004 has the full table).

The substituted URL is then parsed and vetted. After substitution, the parsed host must equal
the host built by position, lower-cased; otherwise the request is not sent. A variable's
position is read from the server URL as the spec writes it, before anything is substituted. A
variable in any other position (scheme, userinfo, query or fragment) makes the server not
callable. There is no set of allowed values outside the spec: a tenant lists the allowed values
by accepting a spec-doctor fix that writes them into the spec as the variable's `enum`
(ADR 0004), so they are in the published spec (1.2). A listed value is exempt from nothing: the
substituted URL is still parsed and vetted on every request.

**When the portal will not send a request.** The portal sends requests to `https` servers only.
For a server that is `http://`, is localhost, is relative, or is not callable under the paragraph
above, the code samples still render, on reference pages and for every `<Sample>`; "Try it" and
MCP are withheld for that server, and the spec doctor reports a finding to the tenant. In the same
way, an operation that requires a controlled header gets a spec-doctor finding and "Try it" is
withheld; its samples still render. Neither is a bundle finding, and a generator does nothing
about either.

**`tryIt`.** `tryIt="false"` means the portal must not offer "Try it" for this sample. The code
sample is still shown. `tryIt="true"`, or leaving the attribute out, is a request and not a
guarantee: the portal may withhold "Try it" for its own reasons, for example because the tenant has
not enabled the operation, or the reader has no credentials.

**`capture`.** To carry a value from one call into a later one, name it and reuse it as a variable:

```markdown
<Sample operation="createPayment" example="card-payment" capture="payment_id=$.id" />
```

The grammar, in full:

```
capture = pair *( SP pair )          ; pairs separated by exactly one space (U+0020)
pair    = name "=" path
name    = [a-z][a-z0-9_]*
path    = "$" *( "." member / "[" index "]" )
member  = [A-Za-z_][A-Za-z0-9_]*
index   = "0" / [1-9][0-9]*
```

- No other separator, no leading or trailing space, and no other JSONPath syntax is accepted.
- A name must not be one of the built-in variables in 4.6 and must not be captured more than once
  on the same page. A name that matches `unique(_[0-9]+)?` is reserved for generated values
  (4.6) and cannot be captured, whether or not it is a built-in today: `unique`, `unique_3` and
  `unique_10` are all refused.
- A captured name must not be a credential variable name; the engine exports the closed list. In
  0.3 the list is `api_key`, `access_token`, `username` and `password`.
- A violation of the grammar or of these rules is `invalid-capture`.
- The path is evaluated against the JSON response body when the reader runs the sample. A captured
  value is a string, number or boolean of at most 2,048 characters, read by own-property lookup;
  otherwise nothing is captured. For a number or boolean the length is that of its JSON text. An
  object, an array, `null`, a missing member, an inherited member and a longer value all capture
  nothing, and the name stays unfilled exactly as if the sample had not been run.
- The captured value keeps its JSON type. The path is not checked against the response schema in
  0.3.
- A captured name is in scope from the end of its `<Sample>` to the end of the page. It is not
  available on other pages.
- While a captured name that a sample's request uses is unfilled, "Try it" sends nothing for
  that sample (section 9). A reader therefore cannot send the spec's example identifier in
  the place of one an earlier step was meant to create.

### 4.4 Ordinary code blocks

Fenced code blocks are allowed for anything that is not an API request: install commands,
configuration, webhook handler code, expected output.

````markdown
```bash title="Install the CLI"
npm install -g acme-cli
```
````

- The info string is empty, or a language identifier matching `[A-Za-z0-9_+#.-]+` followed by
  optional `title="…"` and `highlight="…"` in either order, separated by single spaces. `highlight`
  is a comma-separated list of line numbers and ranges, such as `2,4-6`. Attribute values follow the
  rules in 4.2. Anything else is `invalid-code-info`.
- A language the portal does not know is shown without highlighting. It is not an error. A
  `mermaid` block is shown as code, not as a diagram.
- Indented code blocks are allowed and are treated as fenced blocks with an empty info string.
- A fenced `json` block directly inside `<Sample>` is sample input, not an ordinary code block.

**Hand-written request code.** The rule in section 1 is normative for the generator. The portal's
check for it is a heuristic, so it is a warning and never blocks: an ordinary code block whose
content contains the variable `{{base_url}}` is reported as `api-request-code`. A generator may
apply stricter checks to its own output.

### 4.5 Links

| Form | Resolves to | If the target does not exist |
|---|---|---|
| `[text](op:createPayment)` | The operation's reference page | `unknown-operation` |
| `[text](schema:Payment)` | The schema's reference entry | `unknown-schema` |
| `[text](guide:payments/refunds)` | Another guide, by slug | `unknown-guide` |
| `[text](guide:payments/refunds#partial-refunds)` | A heading in a guide | `unknown-guide` or `unknown-anchor` |
| `[text](asset:payments/flow.png)` | A file under `assets/` | `unknown-asset` |
| `[text](https://…)` | External link. The destination starts with lowercase `https://` and passes the checks below. | not checked |

Every other destination is `link-not-allowed`. That includes relative and absolute paths, `http:`,
`mailto:` and any other scheme, a destination in angle brackets, and `#anchor` on its own. To link
to a heading on the same page, write `guide:` with the page's own slug. The portal owns URL
structure and may change it.

**A `guide:` target that is withheld.** A slug that is in the bundle always resolves for
validation, whether or not its page is withheld (4.7): `unknown-guide` and `unknown-anchor` are
checked against the bundle as written. In the published portal a `guide:` link to a withheld
page, with or without an anchor, is rendered as its link text with no link, and a `<Card>` whose
`href` is such a target is rendered as a card with no link. Each is reported as
`link-to-withheld-page`, a warning (4.7).

**External links.** The destination matches
`^https://[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?(:[0-9]{1,5})?([/?#][\x21-\x7E]*)?$` and has no `\`.
The portal also parses it with the WHATWG parser and rejects it if the parsed host differs. A
destination that fails the regex, contains `\`, does not parse, or parses to a different host is
`link-not-allowed`.

- The regex and the `\` test are the whole check for a generator, in any language. They need no
  URL parser, so two implementations cannot disagree about how a URL is read. The parse and
  comparison are the portal's.
- Both tests apply to the destination as CommonMark yields it, after backslash escapes and
  character references are resolved.
- What the regex allows: a host of lowercase ASCII letters, digits, `.` and `-`; an optional port;
  then printable ASCII only. So there is no userinfo and no IPv6 literal, an internationalized
  name is written in its `xn--` form, and a space or a non-ASCII character is percent-encoded.
- "The parsed host differs" means the host the WHATWG parser reports is not, character for
  character, the text between `https://` and the first `:`, `/`, `?` or `#` (or the end).
  `https://0x7f.1/` matches the regex, parses to the host `127.0.0.1`, and is rejected.

The portal renders an external link with `rel="noopener noreferrer nofollow ugc"`. Whether the
target exists is not checked.

- These rules apply to inline links, reference-style link definitions, and `href` on `<Card>`.
- **Image sources must be `asset:` targets.** An image with any other source is `link-not-allowed`.
  An image with empty alt text is `image-missing-alt`, a warning.
- A link title, `[text](op:x "title")`, is allowed and is plain text.
- Variables are not recognised in link destinations, link titles, image sources or image alt text.

**Characters in targets.** In `op:`, `schema:`, `guide:` and `asset:` destinations, the part after
the scheme is written with these characters as themselves:

```
A-Z a-z 0-9 _ . - / : ~ @ $ ! * + , ; =
```

Every other character is percent-encoded as its UTF-8 bytes (`%20`, `%28`; hex digits in either
case). `#` appears unencoded only as the separator before an anchor in a `guide:` target. The portal
percent-decodes the target exactly once and compares the result with the identifier, exactly. A
destination that contains a character outside the list without encoding it, or a `%` not followed
by two hex digits, is `link-not-allowed`. Invalid UTF-8 after decoding is `link-not-allowed`;
targets resolve by lookup, never by path joining. A decoded `guide:` or `asset:` target is a key
into the set of slugs or asset paths in the bundle and is never joined to a directory, so `..`,
`/` and NUL in a decoded target can only fail to match.

So `gists/create` is linked as `[text](op:gists/create)`, and an operation id `get user (v2)` as
`[text](op:get%20user%20%28v2%29)`.

Percent-encoding applies to link destinations only. In attributes (`operation="…"`, `id="…"`,
`ref="…"`) and in the `operations` frontmatter field the identifier is written verbatim:
`<Sample operation="gists/create" />`. The only identifiers that cannot be written in an attribute
are those containing `"` or a line break; a generator shows those as text.

**Heading anchors.** Every heading in a page body, `h2` to `h6`, wherever it appears, has an anchor.
Both sides compute it the same way:

1. Take the heading's text content: the text as CommonMark would render it, with emphasis, code span
   and link markup removed (link text and image alt text are kept, destinations are dropped), and
   with backslash escapes and character references resolved. Variables are left as written and not
   substituted.
2. Convert `A-Z` to `a-z`. Convert nothing else.
3. Process each code point: keep `a-z`, `0-9`, `_`, and any non-ASCII code point whose Unicode
   general category is a letter (L), mark (M) or number (N); turn whitespace and `-` into `-`; drop
   everything else.
4. Collapse each run of `-` to one `-`, then remove `-` from the start and end.
5. If the result is empty, use `section`.
6. Make it unique within the page, in document order: if the anchor is already in use on this page,
   try it with `-1` appended, then `-2`, and so on, and take the first that is not in use.

| Heading | Anchor |
|---|---|
| `## Create a payment (step 2)` | `create-a-payment-step-2` |
| `## What's new in v2.1?` | `whats-new-in-v21` |
| `## Using {{api_name}}` | `using-api_name` |
| `## Errors`, a second time on the same page | `errors-1` |
| `## ???` | `section` |

`<Step>` and `<Tab>` titles and footnotes have no anchors in 0.3.

An anchor is the name a `guide:` link uses. It is not the `id` in the published HTML. An `id` made
from bundle text can shadow a DOM global (`location`, `forms`, `name`), so the portal puts a fixed
prefix of its own on every `id` it derives from a heading and maps `guide:slug#anchor` to the
prefixed fragment. A generator never writes the prefix.

### 4.6 Variables

A variable is written `{{name}}`, where `name` matches `[a-z][a-z0-9_]*` and nothing, not even a
space, separates it from the braces.

| Variable | Value | Type |
|---|---|---|
| `{{base_url}}` | The server URL selected by the reader | string |
| `{{idempotency_key}}` | A UUID generated in the reader's browser. Each `<Sample>` gets its own. | string |
| `{{api_name}}` | The API title from the spec | string |
| `{{unique}}` | Eight decimal digits generated in the reader's browser. Each `<Sample>` gets its own. See "Generated values" below. | string |
| `{{unique_1}}` to `{{unique_9}}` | Eight decimal digits generated in the reader's browser. Each of the nine names has one value for the whole page. See "Generated values" below. | string |
| captured names | The value captured by an earlier `<Sample>` on the same page (4.3) | the JSON type of the captured value |

**The built-in variables** are these thirteen names and no others: `base_url`, `idempotency_key`,
`api_name`, `unique`, and `unique_1` to `unique_9`. The list is closed, and the engine exports it.

`{{api_key}}` is not available to bundles; anywhere in a bundle it is `unknown-variable`.
Credentials are placed only by the portal's sample generator, from the operation's security
requirements, so a generator needs no variable to authenticate a sample. Neither it nor any other
credential variable name can be captured (4.3). "Anywhere" means each of the three places below where variables are
recognised; in the places where no variable is recognised, the same characters are literal text,
as for any other name, and nothing ever fills them in (item 6 below).

**Where variables are recognised.** In exactly three places:

1. Prose text, including headings, list items and table cells.
2. The content of ordinary code blocks, fenced or indented.
3. String values in a `<Sample>` inline block.

Everywhere else `{{name}}` is literal text: code spans, link destinations and titles, image sources
and alt text, component attributes, code block info strings, frontmatter, object keys in a
`<Sample>` block, the manifest, `guides.lock.json`, `settings.json` and the run report (5.2).

**Built-ins that belong to a sample.** `{{idempotency_key}}` and `{{unique}}` have one value per
`<Sample>`. They are therefore recognised only in place 3, a string value in that sample's inline
block. In prose or in an ordinary code block there is no sample for the value to belong to, and
each is `unknown-variable`. 0.2 did not say what `{{idempotency_key}}` meant outside a sample.
`{{base_url}}`, `{{api_name}}`, `{{unique_1}}` to `{{unique_9}}` and captured names are
recognised in all three places.

**Unknown variables.** In the three places above, every unescaped `{{` must begin a well-formed
variable whose name is a built-in or a captured name in scope. Anything else is `unknown-variable`:
an unknown name, a captured name used before its `<Sample>` or on another page, a built-in that
belongs to a sample used outside one, or a `{{` that is not followed by a name and `}}`.

**Writing a literal `{{`.**

- In prose: `\{{`, or a character reference for a brace.
- In an ordinary code block: `\{{`. The backslash is removed and no variable starts. This is the
  only backslash processing in a code block.
- In a string in a `<Sample>` block: write the first brace as the JSON escape `\u007b`, so the
  string `"\u007b{name}}"` is the text `{{name}}` and holds no variable.

**Variables in sample values.**

- A JSON string that consists of exactly one variable and nothing else, such as `"{{pet_id}}"`, is
  replaced by the variable's value **with the value's own JSON type**. A captured integer `7`
  written as `"petId": "{{pet_id}}"` is sent as the number `7`.
- A variable inside a longer string, such as `"order-{{pet_id}}"`, is string interpolation, and the
  result is a string.
- A JSON string that contains at least one variable is exempt from schema validation when the
  bundle is validated: type, format, enum, pattern and length are not checked for that value. The
  key still counts as present for required checks, and every other value is validated as usual.
- A generator always writes a variable inside a quoted JSON string, including where the schema says
  integer or boolean.

**Runtime values.** A captured value is data from an API response, and a third party may have set
it. These rules bind the portal; a generator needs to know them because they decide when a
placeholder stays unfilled.

- A captured value is a string, number or boolean of at most 2,048 characters, read by own-property
  lookup; otherwise nothing is captured (4.3).
- In an ordinary code block a captured value is substituted only if it matches
  `^[A-Za-z0-9_][A-Za-z0-9._:~-]{0,255}$`; otherwise the placeholder stays. The test is applied to
  the value's text, which for a number or boolean is its JSON text. The first character is a
  letter, a digit or `_`, so a value that starts with `-` cannot be read as a command-line option;
  a negative number is therefore not substituted into a code block.
- Every runtime substitution into a sample or request goes through the target language's encoder
  and the parameter location's encoder (path segment: `/ ? # %` encoded, `.` and `..` rejected).
  String replacement into emitted code does not conform. A value its location rejects is not
  substituted: the placeholder stays, and no request is sent with it.
- A placeholder names its encoders by id, from a closed list. An unknown encoder id means the
  placeholder is not filled. A typed scalar is written by JSON serialization, never by inserting
  the value's text.
- A header value is checked again after substitution (4.3).
- In prose a value is inserted as text and nothing else.

**Generated values.** A spec's examples are fixed, and many APIs refuse a second record with the
same code, name or phone number. A guide that creates such a record then works once per account.
`{{unique}}` and `{{unique_1}}` to `{{unique_9}}` give a sample a value that is new for each
reader and each visit.

- **The value.** Exactly eight characters, each one of `0` to `9`: it matches `^[0-9]{8}$`, and
  a leading `0` is possible. Digits only, at a fixed length, because that is safe in every place
  a variable can be written: a JSON string, a path segment, a query value, a header value, a
  string literal in each of the eight sample languages, and an ordinary code block, whose
  allowlist above it always passes. It also fits a field that takes digits only, such as a phone
  number. A guide adds what else a field needs as literal text around it:
  `"branch_code": "B{{unique}}"`, `"phone": "+1555{{unique}}"`.
- **The type is string, always.** A JSON string that is exactly `"{{unique}}"` is sent as a JSON
  string of eight digits, never as a number. A unique value for a field whose schema is a number
  cannot be written in 0.3.
- **`{{unique}}` is one value per `<Sample>`.** Every `{{unique}}` in one sample's inline block
  is the same value, and each other sample on the page has a different one, as for
  `{{idempotency_key}}`. Use it where no later step needs the value again.
- **`{{unique_1}}` to `{{unique_9}}` are one value each per page.** `{{unique_1}}` is the same
  value wherever it appears on the page, in any sample, in prose and in an ordinary code block;
  `{{unique_2}}` is a different value; and so on. This is how a later step refers to a value an
  earlier step sent: a step that creates a branch with `"branch_code": "B{{unique_1}}"` can be
  followed by a lookup with `"code": "B{{unique_1}}"`. A value the API sends back can also be
  carried by `capture`, as before. The numbers are names, not an order: a page may use
  `{{unique_3}}` without the others. There are nine and no more; `{{unique_10}}` is
  `unknown-variable`.
- **Generated in the reader's browser, and nowhere else.** The values are chosen when the page
  loads, uniformly at random from the browser's cryptographic random source, and they stay the
  same for as long as the page is open, so that the steps of a guide agree with each other.
  Each digit is drawn by rejection sampling from `crypto.getRandomValues`. If that is
  unavailable the placeholder keeps its display text; `Math.random` is never used. A value is
  never written to storage, a URL or analytics. The
  portal gives the reader a way to get new values, and it replaces every generated value on the
  page together. Nothing is generated when a bundle is validated or published, or by any
  server, so published output does not depend on randomness and the same bundle publishes to
  the same bytes. The portal does not store or log a generated value; it leaves the browser only
  inside a request the reader sends.
- **Before any script runs, and in every copy that is not a live page,** the placeholder shows
  fixed display text: `UNIQUE` for `{{unique}}` and `UNIQUE_1` to `UNIQUE_9` for the others. The
  example above is published as `"branch_code": "BUNIQUE"`. That is what a reader without
  JavaScript sees and copies, and what the Markdown twin, `llms.txt`, the search index and the
  docs MCP show (item 6 below). It is visibly not a real value, and a request sent with it works
  as a fixed example does.
- **It is exempt from nothing.** A generated value is filled into a placeholder through the same
  language and location encoders as any runtime value, and a header value that holds one is
  checked again after substitution.
- **It promises little.** A generated value is not a secret and must not be used as one. It is
  not an idempotency key. It is not guaranteed to be unused: two values are equal once in
  10^8, and the API may hold a record from an earlier visit.
- **Not for a password.** Where a string in a sample's inline block holds `{{unique}}` or one
  of `{{unique_1}}` to `{{unique_9}}`, and the schema of the property or parameter it fills
  has `format: password`, the portal reports `generated-value-as-secret`, a warning (5.1). A
  reader who ran that sample would create a real account with a secret of about 26 bits. The
  check uses the schema the validator resolves for that position; where it cannot resolve
  one, nothing is reported. The warning blocks nothing.
- **The names are reserved.** No name that matches `unique(_[0-9]+)?` can be captured (4.3).

````markdown
<Sample operation="createBranch" capture="branch_id=$.id">
```json
{
  "body": { "branch_code": "B{{unique_1}}", "phone": "+1555{{unique}}" }
}
```
</Sample>

<Sample operation="findBranches">
```json
{
  "query": { "code": "B{{unique_1}}" }
}
```
</Sample>
````

**Order of operations. This is a requirement on the portal's renderer and validator.**

1. A variable exists only where the characters `{`, `{`, the name, `}`, `}` are **literal characters
   in the page source**, in one of the three places above, and the first `{` is not preceded by a
   backslash that escapes it. In a `<Sample>` block, "source" means the source text of the JSON
   string, before JSON escapes are decoded.
2. Braces that come from a character reference (`&#123;`, `&#x7b;`, `&lbrace;`, `&lcub;` and the
   closing forms), from a backslash escape, or from a JSON `\u` escape are text. They never form
   part of a variable. So `&#123;&#123;base_url&#125;&#125;`, however it reached the page, renders
   as the twelve visible characters `{{base_url}}` and is not substituted.
3. It follows that the portal must identify variables from source positions, before or independently
   of entity and escape decoding. An implementation that decodes a page to text nodes and then
   searches the decoded text for `{{` does not conform.
4. A substituted value is inserted as plain text, or as a typed data value in a sample. It is never
   parsed again as Markdown, as a component, as HTML or for further variables. Substitution is a
   single pass.
5. Values that are specific to the reader (the selected `base_url`, `idempotency_key`, the
   generated values `unique` and `unique_1` to `unique_9`, captured values, and the credentials
   the sample generator places) are filled in in the reader's browser.
   Published pages contain placeholders for them, so pages stay static and no credential is stored
   in or served from published content.
6. Published output carries variables as structure (a placeholder element or a segment list), never
   as marker text. Client-side substitution fills only those placeholders and must never search
   text or code for `{{`. Text taken from the spec never contains a variable. So `{{name}}` in a
   spec description, a spec example or an API response is the literal characters wherever it ends
   up, including in a request body and in generated code. Markdown twins, `llms.txt`, the search
   index and the docs MCP are never substituted: they show the portal's fixed display text for
   each placeholder.

### 4.7 Incomplete content

Two markers let a generator say that content is waiting for a person.

- **`status`** in frontmatter: `draft`, `review` or `ready`. Default `ready`.
- **`<Todo>`**, a block component that says what is missing:

```markdown
<Todo title="Rate limits">

The spec does not state the request limits or what a client should do when it is limited. Add
them here.

</Todo>
```

Both are **visible in preview and withhold their own page from publishing**:

- A page whose `status` is `draft` or `review` is reported as `page-not-ready`.
- Each `<Todo>` is reported as `todo-present`.

These two codes have the severity `blocker` (section 5). **A blocker is about one page, not the
bundle** (decided by the user on 2026-11-27). A bundle whose only findings are blockers, page
errors and warnings is valid and can be published. A page that carries at least one finding of
severity `blocker` or `page-error` is a **withheld page**, and the published portal leaves it
out. Every other page is published. A `page-error` is a fault in one page and withholds it in
the same way; see "An invalid page withholds only itself" below. An `error` is different: one
error anywhere keeps the whole bundle from being staged or published (section 5).

`draft` and `review` withhold a page equally. The difference is information for people.

**What withheld means.** In the published portal, for a withheld page:

- It is not rendered and has no URL. A URL it had under an earlier bundle stops resolving. It
  has no Markdown twin and no entry in `llms.txt`, and it is absent from the search index and
  the docs MCP.
- Its entry is absent from navigation. The other entries keep their order. A group left with no
  entry is absent too, and so is a group above it that is left empty in turn. A withheld page
  with `hidden: true` is withheld.
- A `guide:` link to it from a published page is rendered as the link's text, with no link
  element, no link title and nothing that marks it. A `<Card>` whose `href` targets it is
  rendered as a card with no link. This holds for inline links, reference-style links and
  `href`, with or without an anchor. The page that links is published as usual.
- An anchor into it does not resolve, because the page it belongs to has no URL.
- A reference page's links back to guides, built from `operations` in frontmatter, omit it.
- An asset that only withheld pages refer to is not published. An asset that a published page
  refers to, or that no page refers to, is published as before.
- A `<Todo>` therefore never appears in a published page, a Markdown twin, `llms.txt`, the
  search index or the docs MCP. The same holds for any other text of a withheld page.

Withholding changes what is published and nothing about validation. A withheld page is validated
in full and every finding in it is reported. Its slug counts as present for `unknown-guide`.
Where it is withheld for blockers only, its anchors count as present for `unknown-anchor` and
its `operations` count for `page-unreferenced`.

**An invalid page withholds only itself** (0.3). A fault in what one page says is reported with
the severity `page-error` (section 5). The page it is in is a withheld page: everything under
"What withheld means" applies to it, and every other page is published. A fault in the bundle's
structure keeps the severity `error` and still stops the whole bundle. The line between them:

- **`page-error`: the bundle can be read without the page.** The manifest, the set of files,
  and every path, encoding and size are sound. The fault is in one page's content: its
  frontmatter, its Markdown, a component, a variable, a sample, a link, or a reference to an
  operation, schema, guide, anchor, asset, response or example that does not exist.
- **`error`: the portal cannot tell what the bundle is, or cannot read it safely.** No manifest
  or an invalid one; a contract version it does not accept; `nav` and the files under `pages/`
  disagreeing; a file the layout does not allow; a bad path or encoding; a size or count
  limit; an asset that is not what its extension says. These are never reduced to one page,
  even where the file at fault is a page (`invalid-encoding`, `invalid-path`, `size-limit`):
  they are checked on bytes before any page is parsed, and reading stops at the first limit
  passed (section 6).

Each code has one severity, listed in 5.1. The rules that go with it:

- **Who wrote the page does not matter.** A finding's severity is a function of the bundle's
  content and the published spec, and never of authorship. A page the generator wrote and a
  page a person edited get the same finding for the same fault. The validator does not read
  `guides.lock.json` (5.3) to decide a finding.
- A page error is reported on the page that contains the fault. `unknown-guide` and
  `unknown-anchor` are reported on the page that holds the link, not on its target.
- The validator finds every page error other than `unknown-anchor` first. A page that carries
  one offers nothing to other pages: an anchor into it is not checked, so no `unknown-anchor`
  is reported for a link to it, and its `operations` count for nothing. The link is a link to
  a withheld page: it is published as text and reported as `link-to-withheld-page`.
- A page error never becomes an error, and no number of them makes a bundle unpublishable. If
  every page is withheld, "The guides entry point" below says what the portal shows.
- This is what lets a generator keep a page it must not change. A page a person edited that
  no longer fits the spec, for example one that names a removed operation, is kept as the
  person left it, carries `unknown-operation`, and is withheld by itself until a person fixes
  or deletes it. The other pages are published.

**Rendering is gated by the validator** (security review of 2026-11-28, ruling 1). Confining a
fault to its page is safe only on this condition. The renderer builds a page only from the
tree the validator produced for a page with no page error; it never parses a page file
itself. For a page with a page error, preview and dashboard show only its slug, finding codes
and line numbers: never its frontmatter title or description, and no excerpt of its source. A
finding's `message` contains no bundle text.

- This holds for every page error, `invalid-frontmatter` included. A title or description
  that failed validation is never shown, and neither is one that passed on a page that has
  another page error. Earlier wording had such a page "listed and marked in the same way" as
  a page with a blocker, which would have shown its title.
- Where preview or the dashboard lists such a page in navigation, the entry is its slug, not
  its title and not the manifest's `label`.
- A page withheld for blockers only has no page error. Its tree comes from the validator like
  any other, and preview shows it in full.

**A link to a withheld page is a warning.** Each `guide:` link or `<Card>` `href` on a page
that is not withheld, whose target is a withheld page, is reported as `link-to-withheld-page`
on the linking page, one finding per link, with the withheld page's path in `target`
(section 5). It blocks nothing. It tells the author that a published page points at a page
readers cannot see. A link from one withheld page to another, or from a withheld page to
itself, is not reported.

**The guides entry point.** The portal must not depend on any one page being published, the
quickstart included. Where the portal links to the guides as a whole, the target is the first
page in `nav` order that is published and not `hidden`, or the first published page if all of
them are `hidden`. A withheld quickstart is skipped like any other page, and anything the
portal attaches to a `quickstart` page (9) is absent with it. If every page is withheld the
portal shows no guides section and no link to one; the bundle is still published, and its
predecessor's pages are gone.

**In preview nothing is left out.** The preview of a staged bundle has an entry for every
page, including the withheld ones. A page withheld for a blocker is shown and is marked as
withheld on the page and in navigation, with its findings, and each `<Todo>` is rendered as a
clearly marked placeholder. Links to a withheld page work there. A page withheld for a
`page-error` is the exception: it is listed by its slug with the codes and line numbers of
its findings and nothing else, as "Rendering is gated by the validator" above requires. Its
title, description and body are not shown, there or anywhere, and a link to it in preview
leads to that listing. The preview of a staged bundle is not the private preview of
section 9: a bundle published into a portal that is a private preview has its withheld pages
left out, exactly as in a public portal.

**Incomplete content is resolved in Git.** Once the tenant has connected a repository, the bundle
lives there (section 6). A person resolves a `<Todo>`, or finishes a `draft` or `review` page, by
editing the page file in that repository: replacing the `<Todo>` with the missing content, or
setting `status: ready`. The portal ingests the new commit and validates it like any other bundle,
and the page is published with the next publish. The portal offers no editor for a bundle and
never changes what a page says. What it sends to the repository is the guides module's output, as
a pull request that a person merges (section 6).

**Before a repository is connected** the portal holds the generated bundle, and it is read-only:
there is nowhere to edit it. The rule is the same in both cases: the pages that carry a blocker
or a page error are withheld and the others are published. A withheld page of a held bundle stays withheld until
the tenant connects a repository and a person finishes it there, or a regenerated bundle arrives
without the blocker.

Two things follow.

- Guides are generated, so **regenerating must not overwrite a person's edits.** The requirement
  is the portal's, because a publish that loses a person's work is a defect of the product
  whichever side caused it. It is met in two parts.

  *The portal's part.* A regeneration reaches the repository only as a pull request (section 6).
  The portal never commits to the branch it ingests from and never merges. Nothing a person wrote
  is replaced until a person has seen the difference and accepted it.

  *The guides module's part.* The pull request is only reviewable if its difference is small and
  true. Three requirements bind the guides module:

  1. **Deterministic.** The same inputs give a byte-identical bundle directory and a
     byte-identical run report (5.2). The inputs are the bytes of the published spec, the existing bundle when one is
     given, the tenant's settings (the bundle's `settings.json`, 5.4) and the module's version. Output does not depend on the clock,
     randomness, locale, environment or the order in which a directory is listed. A module run by
     the portal therefore leaves `generatedAt` out (section 3).
  2. **Stable.** A file changes between two runs only for a reason in the inputs. When the
     published spec changes, a page whose content does not depend on what changed comes out byte
     for byte as before, with the same slug and the same place in `nav`. Rewrapped lines,
     reordered keys and changed whitespace with no cause in the inputs do not conform.
     `guides.json` changes on every spec change, because `spec.sha256` does; that is the one
     expected difference. A new version of the module may change its output, and that difference
     is then reviewed like any other.
  3. **Does not revert a person's edits.** The module accepts the existing bundle directory as an
     optional input: the bundle as it stands on the branch the portal ingests from. When it is
     given, no change a person made to a page since the module wrote it is dropped or reverted in
     the output. Emitting an edited page byte for byte as given always conforms. Merging newly
     generated content into an edited page conforms only if every change the person made
     survives. Without an existing bundle, on a first run or before a repository is connected,
     the module generates in full. A page a person edited or added is recognised by the
     generation record, as 5.3 defines.
  4. **Does not bring back a page a person deleted.** A page the module wrote and a person
     then deleted from the bundle is not written again. The generation record carries the
     deletion from run to run under `deleted` (5.3), and a person brings the page back by
     taking its slug out of that list.
  5. **Does not depend on the run report.** The report is information for people and is not
     in the bundle (5.2). The module is never given the report of an earlier run: the
     existing-bundle input holds none (section 6). What must survive between runs is in
     `guides.lock.json` (5.3) and `settings.json` (5.4), and the module emits `settings.json`
     byte for byte as it was given.

  *Still the guides module's own design:* whether it keeps an edited page whole or merges into
  it; and what it does with an edited page that no longer fits the new spec, for example one
  that names a removed operation, provided it keeps the person's text and says so in
  the run report (5.2). Such a page is withheld by itself (above). How an edited or deleted page
  is recognised is no longer the module's own design: it is the generation record of 5.3, a
  file with a defined shape, because it has to survive in the tenant's repository and the
  portal tells the tenant what it is. The bundle root allows no other file of the module's
  (section 2). If the module needs an input beyond the published spec and the existing
  bundle, it says so and the portal side decides whether to supply it.
- Every rule in this contract applies to the bundle as ingested, whoever wrote each line. Where the
  contract says "a generator writes", an edit made by hand is held to the same rule and gets the
  same finding.

## 5. Validation

The portal validates every bundle before staging it and returns a machine-readable report.

```json
{
  "contractVersion": "0.3",
  "ok": true,
  "publishable": true,
  "withheld": ["quickstart"],
  "findings": [
    {
      "code": "todo-present",
      "severity": "blocker",
      "file": "pages/quickstart.md",
      "line": 18,
      "message": "This page is withheld from publishing until its <Todo> is resolved."
    },
    {
      "code": "link-to-withheld-page",
      "severity": "warning",
      "file": "pages/payments/accept-a-payment.md",
      "line": 9,
      "target": "pages/quickstart.md",
      "message": "This link points at a page that is withheld. It will be shown as plain text."
    }
  ]
}
```

| Severity | Meaning |
|---|---|
| `error` | **The whole bundle** is invalid. It is not staged, cannot be previewed, and no page of it is published. |
| `page-error` | **One page** is invalid and is withheld from publishing: the page named in `file`. The bundle is valid, is staged for preview and can be published; its other pages are published. Nothing of the page is rendered, in preview or anywhere: preview lists its slug with its findings' codes and line numbers (4.7). |
| `blocker` | **One page** is waiting for a person and is withheld from publishing: the page named in `file`. The bundle is valid, is staged for preview and can be published; its other pages are published (4.7). |
| `warning` | Nothing is blocked and nothing is withheld. |

The three blocking severities differ in reach and in cause. An error stops every page, wherever
it is. A page error and a blocker each stop only the page that carries them: a page error because
the page is invalid, a blocker because it is unfinished. Neither ever becomes an error, and no
number of them makes a bundle unpublishable. Each code has exactly one severity (5.1), and it
does not depend on who wrote the page (4.7).

- `ok` is true when there is no finding of severity `error`.
- `publishable` is one value for the bundle. It is true when there is no finding of severity
  `error`: the bundle can be published. Blockers and page errors do not make it false. In 0.3 it
  therefore has the same value as `ok`; it stays in the report so that "can be staged" and "can be published"
  remain separate questions with separate answers.
- `withheld` is the per-page answer: the slugs of the withheld pages, each once, sorted by Unicode
  code point. It is always present and is empty when no page is withheld. A page is in it exactly
  when a finding of severity `blocker` or `page-error` names its file. When `ok` is false nothing
  is published and the list is only information.
- The `file` of a blocker or a page error is always a page file.
- `target` is present on `link-to-withheld-page` only and is the path of the withheld page.
- `file` is relative to the bundle root. `line` is 1-based and is omitted when a finding is about a
  whole file or the whole bundle. `message` is for people, and its wording is not part of the
  contract. One rule about it is: a finding's `message` contains no bundle text. It is the
  portal's own fixed text for the code, and what the finding is about is carried by `code`,
  `file`, `line` and `target` (4.7).
- The portal reports every finding it can, not only the first.

### 5.1 Codes

The codes and their severities are part of the contract. A generator's own validator uses the same
names for the same conditions.

**Errors.** Each stops the whole bundle.

| Code | Condition |
|---|---|
| `missing-manifest` | No `guides.json` at the bundle root. |
| `invalid-manifest` | `guides.json` is not JSON, is nested deeper than 64, or fails the schema. |
| `unsupported-contract-version` | `contractVersion` is not one the portal accepts. |
| `missing-page` | A nav entry names a page with no file. |
| `unlisted-page` | A file under `pages/` is not in `nav`. |
| `duplicate-page` | A slug appears in `nav` more than once. |
| `nav-depth` | A group is nested deeper than depth 3. |
| `unexpected-file` | A file, directory or link that the layout in section 2 does not allow. A `report.json` in the bundle is one. |
| `invalid-path` | A path breaks the character or length rules. |
| `invalid-encoding` | Not UTF-8, or has a byte order mark, CR line endings or NUL. |
| `size-limit` | A size or count limit in section 2 is exceeded, including the limits on `guides.json`, `guides.lock.json`, `settings.json` and frontmatter. |
| `asset-type` | An asset's extension is not allowed, or its content does not match it. |

**Page errors.** Each withholds the page it is reported on, and only that page (4.7). Up to
0.2 these were errors.

| Code | Condition |
|---|---|
| `nesting-limit` | Markdown nesting deeper than 32. See 4.1. The parser stops reading the page there. |
| `invalid-frontmatter` | Frontmatter is missing, is not plain YAML, or breaks the field rules. |
| `heading-h1` | The body contains an `h1`. |
| `disallowed-syntax` | Raw HTML in any form, or an angle-bracket autolink. |
| `unknown-component` | A tag that is not in 4.2. |
| `unknown-attribute` | An attribute the component does not have. |
| `invalid-attribute` | A missing required attribute, a repeated one, a bad value or bad quoting. |
| `invalid-nesting` | A component where its parent does not allow it, or disallowed content. |
| `unbalanced-component` | Opening and closing tags do not match. |
| `invalid-tag-placement` | A tag is not alone on one line, lacks its blank lines, or is inside a list, block quote, table or footnote. |
| `unknown-variable` | See 4.6. |
| `unknown-operation` | An operation id that is not in the spec, in an attribute, a link or frontmatter. |
| `unknown-schema` | A schema name that is not in the spec. |
| `unknown-guide` | A `guide:` slug that is not in the bundle. |
| `unknown-anchor` | A `guide:` anchor that the target page does not have. Not checked where the target page carries another page error (4.7). |
| `unknown-asset` | An `asset:` path that is not in the bundle. |
| `unknown-response` | A `<Response>` status the operation does not define. |
| `unknown-example` | An `example` name that selects nothing. |
| `link-not-allowed` | A link or image destination in a form 4.5 does not allow, an external link that fails the checks in 4.5, or a target that is not valid UTF-8 once decoded. |
| `invalid-sample` | See 4.3. |
| `invalid-capture` | See 4.3. |
| `invalid-code-info` | A code block info string that breaks 4.4. |

**Blockers.** Each withholds the page it is reported on, and only that page (4.7).

| Code | Condition |
|---|---|
| `todo-present` | A `<Todo>` is present. One finding per `<Todo>`. |
| `page-not-ready` | A page's `status` is `draft` or `review`. |

**Warnings**

| Code | Condition |
|---|---|
| `spec-hash-mismatch` | `spec.sha256` differs from the SHA-256 of the published spec (1.2): the patched document as the portal published it. |
| `deprecated-operation` | A sample, operation card or link targets a deprecated operation. |
| `image-missing-alt` | An image has empty alt text. |
| `page-unreferenced` | A page of type `quickstart`, `how-to` or `tutorial` has no `operations`. Pages of type `concept` and `reference` are exempt. |
| `api-request-code` | An ordinary code block contains `{{base_url}}`. See 4.4. |
| `undeclared-parameter` | A sample sends a header or query parameter the operation does not declare. |
| `invalid-report` | The run report (5.2) is not UTF-8 JSON, is larger than 2 MB, is nested deeper than 64, has a duplicate key, or fails its schema. The report is ignored. It is a finding on the run that wrote the report, not on a bundle: the report is not a bundle file. |
| `missing-lock` | No `guides.lock.json` at the bundle root. The next generation keeps every existing page as it is (5.3). |
| `invalid-lock` | `guides.lock.json` is present but is not JSON, is nested deeper than 64, has a duplicate key, fails its schema, or lists a slug twice. It is treated as absent (5.3). |
| `invalid-settings` | `settings.json` is present but is not JSON, is nested deeper than 64, has a duplicate key, or is not a JSON object. No generation is run with it (5.4). |
| `generated-value-as-secret` | A string in a `<Sample>` inline block holds `{{unique}}` or one of `{{unique_1}}` to `{{unique_9}}` and fills a property or parameter whose schema has `format: password`. One finding per such string (4.6). |
| `link-to-withheld-page` | A `guide:` link or a `<Card>` `href` on a page that is not withheld targets a withheld page. One finding per link, on the linking page, with the withheld page in `target`. The link is published as plain text, or the card without a link (4.5, 4.7). |

**Generator-side only**

| Code | Condition |
|---|---|
| `unsupported-syntax` | Never reported by the portal. A generator's pre-flight validator may use it for input the contract allows but that validator cannot check. |

### 5.2 The run report: `report.json`

Optional. **It is an output of a run, beside the bundle, and not a file of the bundle**
(security review of 2026-11-28, F1). It carries what the generator wants a person to know
about the run: pages it skipped, things the spec did not say, problems it found in the spec,
and the vendor extensions it saw.

- **Where it is written.** A generator writes the report apart from the bundle directory: as
  a file named `report.json` beside that directory and never inside it, or, when it is called
  as a library, as a value of its own apart from the bundle's files. A `report.json` inside a
  bundle is `unexpected-file` (section 2).
- **Where it is kept.** The portal keeps `report.json` for the dashboard and does not include
  it in a pull request. It stores the report with the run that wrote it and shows it to
  signed-in members of the tenant's account, and to nobody else. The report is never in the
  tenant's repository. The reason: `extensions[].example` carries values of `x-` fields
  whether or not any setting shows them, and `specProblems` is a list of a spec's defects; in
  a public repository both would be public, against the rule below and against the private
  doctor report.
- **It is never published**, and it never affects validation of a bundle.
- **How it is displayed.** Shown as text nodes, never linkified; control and bidirectional
  formatting characters are removed or shown visibly; `fix` has no action attached; `pointer`
  is displayed, not resolved.

**It is information and nothing else** (0.3). Nothing reads it to decide anything: not the
portal's validator, and not the generator on its next run (4.7, requirement 5). It is not an
input of any run, and no copy of it exists that a tenant could edit. What a generator needs
from one run to the next is in `guides.lock.json` (5.3).

The JSON Schema is in [`guides-report.schema.json`](./guides-report.schema.json). The minimum shape:

```json
{
  "pages": [
    { "page": "quickstart", "outcome": "written", "placeholderValues": true },
    { "page": "pagination", "outcome": "skipped", "reason": "No operation takes a cursor or page parameter." }
  ],
  "gaps": [
    { "page": "quickstart", "message": "The spec does not describe how credentials are issued." }
  ],
  "specProblems": [
    {
      "code": "no-examples",
      "severity": "high",
      "title": "Requests have no examples",
      "message": "412 of 795 operations have a request body with no example.",
      "fix": "Add an example to each request body.",
      "count": 412
    },
    { "pointer": "/paths/~1pets/get", "message": "No operationId." }
  ],
  "extensions": [
    {
      "name": "x-required-permission",
      "count": 212,
      "usedIn": ["operation"],
      "valueKinds": ["string"],
      "example": "orders:write",
      "suggestedRole": "permission"
    }
  ]
}
```

- Every top-level member is optional. `pages[].page` is a slug; for a skipped page no file exists.
- `placeholderValues: true` means sample values on that page were built from types because the spec
  had no examples.
- `pointer` is a JSON Pointer into the published spec (1.2).
- Members the schema does not define are allowed anywhere and are ignored by the portal. A
  generator may keep its own detail there.
- `pages`, `gaps`, `specProblems` and `extensions` hold at most 1,000 items each, and a slug is at
  most 197 characters, the longest a page path allows. These are in the schema.
- The report is UTF-8 JSON of at most 2 MB, nested at most 64 deep, and no object in it has a
  duplicate key. The schema cannot express these four; the portal checks them as it reads.
- **`specProblems`** (0.3). Besides `message` and `pointer`, an item may carry:

  | Member | Shape | Meaning |
  |---|---|---|
  | `code` | `^[a-z][a-z0-9-]{0,63}$` | The generator's own name for the kind of problem. It is not a code of this contract or of the portal's spec doctor. |
  | `severity` | `high`, `medium` or `low` | How much the problem limited the guides. The generator's own scale; it has nothing to do with the severities of section 5. |
  | `title` | 1 to 200 characters | A short name for the problem. |
  | `fix` | 1 to 1,000 characters | What a person could change in the spec, in words. |
  | `count` | An integer, 0 or more | How many places in the spec it was found. |

  All are optional. `fix` is advice in plain text. It is not a patch: the portal never applies
  it, never turns it into a spec-doctor fix, and shows it apart from the spec doctor's own
  findings, marked as coming from the guide generator. Anything else a generator records about
  a problem stays an extra member, which the portal ignores.
- **`extensions`** (0.3). One item for each vendor extension (`x-` field) name the generator saw
  in the spec:

  | Member | Shape | Meaning |
  |---|---|---|
  | `name` | Required. Starts with `x-`, at most 200 characters | The extension's name. |
  | `count` | An integer, 0 or more | How many times it appears. |
  | `usedIn` | At most 20 strings of 1 to 100 characters | The kinds of place it appears, in the generator's words, such as `operation` or `schema`. |
  | `valueKinds` | A list of `string`, `number`, `boolean`, `null`, `array`, `object` | The JSON types of its values. |
  | `example` | A string of at most 200 characters | One value, as text. A value that is not a string is given as its JSON text. The generator cuts it to fit. |
  | `suggestedRole` | `^[a-z][a-z0-9-]{0,31}$` | The role its name suggests. The roles are the generator's (5.4). A suggestion changes no page. |

  `name`, `usedIn` and `example` are copied from the spec, so they are text a tenant, or
  whoever wrote the tenant's spec, chose. The portal treats every string in the report as
  untrusted and shows it as plain text only: never as Markdown, HTML or a link, and never as
  the name of anything it looks up. `example` may hold something the spec's owner did not
  mean to show, so it is shown only to signed-in members of the tenant's account, like the
  rest of the report, and the report is kept out of the repository.
- A report that is not UTF-8 JSON, is larger than 2 MB, is nested deeper than 64, has a
  duplicate key, or fails the schema, is `invalid-report`, a warning on the run. The report
  is ignored and the run's bundle is unaffected. That includes a `severity` outside the three values and an
  `example` longer than 200 characters.

### 5.3 The generation record: `guides.lock.json`

At the bundle root. It records what the generator last wrote, so that its next run can tell a
page a person edited from one it wrote, and a page a person deleted from one that never
existed. 0.2 left this to the module, which kept it in `report.json`, a file people may delete.
It is a file of its own, with a defined shape, so that the report stays information only.

The JSON Schema is in [`guides-lock.schema.json`](./guides-lock.schema.json).

```json
{
  "pages": [
    { "page": "payments/accept-a-payment", "sha256": "5d41…" },
    { "page": "quickstart", "sha256": "9b74…" }
  ],
  "deleted": ["pagination"],
  "navSha256": "1f3a…",
  "settingsSha256": "c0de…"
}
```

- `pages`: required. One entry for each page the generator wrote and still tracks: the slug,
  and the SHA-256, in lowercase hex, of the page file's bytes exactly as the generator wrote
  them. Each slug appears once. At most 5,000 entries, the most files a bundle may hold, so
  every page has one.
- `deleted`: the slugs of pages the generator wrote and a person then deleted. Each slug
  appears once and is not also in `pages`. At most 5,000.
- `navSha256`: optional. A hash the generator defines over `nav` as it last wrote it, so that
  it can tell whether a person reordered the navigation. The portal does not interpret it.
- `settingsSha256`: the SHA-256 of the bytes of the `settings.json` the run used (5.4). Absent
  when the run had no settings. It is the generator's own note. The portal does not decide
  from it whether to run (section 6).
- Both lists are sorted by slug, by Unicode code point, so the file changes only where its
  content does.
- Members the schema does not define are allowed and are ignored by the portal.

**What the record means.** This binds a generator that is given an existing bundle:

| In the existing bundle | It means | The generator |
|---|---|---|
| The page file is there, with an entry in `pages` whose hash equals the file's | The generator's page, untouched | May rewrite or remove it |
| The page file is there, with an entry whose hash differs | A person edited it | Keeps the person's changes (4.7, requirement 3) and leaves the entry as it was |
| The page file is there, with no entry | A person's page | Keeps it (requirement 3) and adds no entry |
| The page file is there and its slug is in `deleted` | A person put a page back | Keeps it as a person's page and takes the slug out of `deleted` |
| No page file, and an entry in `pages` | A person deleted it | Does not write it; moves the slug from `pages` to `deleted` (requirement 4) |
| No page file, and the slug is in `deleted` | Deleted on an earlier run | Does not write it; the slug stays in `deleted` |
| No page file, in neither list | Never written, or handed back | May write it |

- **With no valid record**, missing or `invalid-lock`, every page in the existing bundle and
  its `nav` are a person's. The generator keeps them byte for byte and writes a new record
  with no entry for them. Nothing a person wrote is lost. Nothing is brought up to date
  either, and a page deleted earlier cannot be recognised, so it may be written again.
- **Two edits to the record by hand have a defined meaning.** To get a deleted page back, take
  its slug out of `deleted`. To hand an edited page back to the generator, delete the page
  file, its `nav` entry and its entry in `pages`. Any other hand edit is not supported.
- A person who deletes a page also deletes its `nav` entry; otherwise the bundle has
  `missing-page`.
- The generator writes the record on every run, the first included, and it is covered by the
  determinism rule (4.7).

**What the portal does with it.**

- It checks the shape. A record that is not JSON, is nested deeper than 64, has a duplicate
  key, fails the schema, lists a slug twice in `pages` or in `deleted`, or lists one slug in both, is `invalid-lock`
  and is treated as absent. A bundle with no record gets `missing-lock`. Both are warnings:
  published pages do not depend on the record, so neither blocks a bundle or withholds a page.
- It never publishes or serves the file, and never uses it to decide a finding (4.7).
- It reads only slugs and hashes from it, to tell the tenant which pages are kept as edited
  and which stay deleted (section 6).
- The step's existing-bundle input omits `report.json`, and omits `guides.lock.json` when it is
  `invalid-lock`. Slugs from the record are lookup keys and are never joined into paths. So a
  generator is never handed a record the portal found malformed; it sees a bundle with no
  record and keeps every page, as above.
- The record is a file the tenant can edit, and it is trusted for nothing else. An edit to it
  can freeze a page, bring back a deleted one, or mark an edited page as untouched so that
  the generator rewrites it. Each of those arrives as a pull request a person reviews, and
  whoever can edit the record can edit the page.

### 5.4 Settings: `settings.json`

Optional, at the bundle root. It holds the tenant's settings for the generator: today, the role
of each vendor extension (`x-` field), which decides whether its values are written into pages.
**What the file contains is the generator's to define**, and this contract does not describe it.
What the contract fixes is where the settings live and how they are handled.

- **Settings are the third input of the step that runs the generator** (section 6), beside the
  published spec and the existing bundle. Their only source is this file, in the bundle on the
  branch the portal ingests from. The portal keeps no other copy and has no screen that sets
  them. They are in the tenant's repository so that a change to them is versioned and reviewed
  in the same place as the pages it changes.
- **Without the file the generator runs with no settings**, and its output is what it was under
  0.2: no vendor extension reaches a page. A bundle the portal holds before a repository is
  connected has no settings, because there is nowhere to write them.
- **It is tenant-supplied data.** The portal checks three things: the file is at most 64 KB
  (`size-limit`), it is JSON nested at most 64 deep with no duplicate key, and its top level
  is an object (`invalid-settings`, a warning). It interprets nothing else in it, never evaluates it, and
  never publishes or serves it.
- **The portal passes the file's bytes to the generator unchanged.** With `invalid-settings`
  it runs no generation until the file is corrected. A generator may also refuse settings
  whose contents it does not accept; that is a failed run (section 6).
- **The generator emits `settings.json` byte for byte as given** and never creates or changes
  it. It records the hash of the bytes it used as `settingsSha256` in the generation record
  (5.3).
- **A change to the settings takes effect at the next generation.** The portal regenerates
  when the bytes of `settings.json` on the ingested branch are not those of the last run it
  recorded (section 6). It compares against its own record of that run, not against
  `settingsSha256`, which is in a file the tenant can edit. Until that pull request is
  merged, the pages are those of the earlier settings.
- Text that settings put on a page, such as a label, is bundle content like any other: it is
  validated with the page and is never trusted because a setting produced it.
- **Settings can publish what the spec kept out of sight.** A vendor extension has no declared
  meaning, and specs use them for internal notes, owners, ticket numbers and rollout flags. The
  published spec of a hosted portal is not a public download by default (1.2), so those values
  are normally not public. A setting that gives an extension a role writes its values into
  guide pages, which are public. The safeguards are that nothing is shown without a setting;
  that a setting changes a page only through a pull request whose difference shows the exact
  text that would be published; and that the portal says so there. Every pull request from a
  run that had a `settings.json` carries the warning (section 6), not only the one a change
  to the settings started: once an extension has a role, a later change to the spec can put
  new values of it on a page. A person still has to read the difference.

## 6. Delivery

**The directory layout in section 2 is the contract.** A generator's obligation ends when it has
written a conforming bundle directory. It does not upload, archive, commit or push anything.

Decided by the user on 2026-11-27. The GitHub App is built in M4 and everything specific to
guides in M5. Earlier drafts of 0.2 said that transport would be settled in M5 and named two
candidates. This replaces that.

- **The portal runs the guides module**, for a tenant, as a step of the portal's own pipeline. The
  tenant does not run it. The step has three inputs: the bytes of the published spec (1.2);
  optionally, the existing bundle directory (4.7); and, when that bundle holds one, the bytes of
  its `settings.json` (5.4). Settings have no other source. The step's existing-bundle input
  omits `report.json`, and omits `guides.lock.json` when it is `invalid-lock`. Slugs from the
  record are lookup keys and are never joined into paths (5.3). Its output is a bundle
  directory, with `guides.lock.json` (5.3) in it, and, apart from that directory, the run
  report if the module writes one (5.2). The step is given no network access and no
  credential, and needs neither. How the step is isolated is the portal's and is in ADR 0007.
- **The step takes the bundle directory and the run report, and nothing else.** Whatever else
  the module writes, such as a file for a person beside the bundle, is discarded, and so is
  the module's own validation result: the portal validates the output itself. The portal
  never asks the module for a timestamp. The files the step returns pass the section 2
  limits where they cross out of the step, before anything else reads them.
- **The report stays with the portal.** The portal keeps `report.json` for the dashboard and
  does not include it in a pull request (5.2). It is not part of what is proposed, held,
  staged or published.
- **When it runs.** For a tenant's first bundle; when the published spec's hash differs from
  the bundle's `spec.sha256`; when the bytes of `settings.json` on the ingested branch have
  changed (5.4); and when the portal moves to a new version of the module. The portal decides
  all four from its own records and never from a hash written in the repository. The portal
  records the input hashes (spec, settings, existing bundle, module version) of each run and
  does not repeat one; runs are rate-limited per tenant; one open pull request per API
  version. `settingsSha256` in the generation record is the generator's note and starts
  nothing: the record is a file the tenant edits, and a wrong or missing value would
  otherwise start a run on every ingest. A run the rate limit holds back waits; it is not
  dropped. When a run finishes while a pull request for that API version is open, the portal
  updates that pull request or replaces it, and never opens a second.
- **A run that fails changes nothing.** If the module fails, exceeds the step's limits, or
  writes a bundle that has an `error`, no pull request is opened, the bundle in place stays as
  it is, and the tenant is told in the dashboard. Anything the module says about the failure is
  untrusted text. It is cut at 2,000 characters and shown under the display rule of 5.2. A
  bundle whose only faults are page errors and blockers is not a failed run: it is proposed,
  and the pull request names the withheld pages.
- **Running the module on tenant specs is blocked** (security review of 2026-11-28, ruling 8).
  This is a note to the guides module, and it is not a rule about bundles. Two things are
  needed from the module's owner first.
  1. *What the module gives Ajv, its schema-compiling dependency.* Ajv compiles a JSON Schema
     to JavaScript. Given only this contract's own schemas, that is acceptable. Given a
     schema taken from a tenant's spec, for example to check sample values against it, it is
     tenant content compiled to code, which the portal does not allow in a step it runs.
     **Until the owner confirms which it is, the portal runs the module on no tenant's spec.
     If the module compiles tenant schemas, the module must change before it can be run.**
  2. *A licence for the module.* It declares none. That blocks it under ADR 0001 rule 5,
     whatever the answer to the first. It is not a security matter.

  Neither holds back the release of this contract or the module's own work on 0.3. The
  isolation the step has either way is in ADR 0007.
- **Once the tenant has connected a repository**, the portal's GitHub App proposes the generated
  bundle as a pull request on the tenant's repository. The tenant reviews it, edits it and merges
  it. The portal ingests the bundle from that repository. A regeneration arrives the same way, as
  a pull request against the bundle that is there. The portal never commits to the branch it
  ingests from and never merges a pull request.
- **What the pull request's description says.** The repository is where a tenant meets the
  bundle's files, so the description explains them, each time:
  - Pages may be edited, and edits are kept by later regenerations.
  - `guides.lock.json` is how edits and deletions are recognised. It is to be left in place.
    Without it nothing is lost, but every existing page is from then on treated as edited and
    is no longer brought up to date. The description says how to hand a page back to the
    generator and how to get a deleted page back (5.3).
  - The run report is not among the files: the portal keeps it and shows it in the dashboard.
  - A deleted page stays deleted. Deleting a page means deleting its file and its `nav` entry.
  - `settings.json` is where the generator's settings go, and a change to it shows up as a
    later pull request.
  - For this run: the pages kept as a person left them, the pages that would be withheld with
    the codes of their findings, and the slugs under `deleted`. The portal works the first out
    itself, from the record's hashes and the page files, and does not take it from the run
    report.
  - When the existing bundle had no valid record: that every existing page was kept as it was.
  - When the run had a `settings.json`, whatever started the run: that the settings may put
    values of the spec's `x-` fields on public pages, and that the difference shows the text.
    Every pull request from a run that had a `settings.json` carries the warning.

  The description is made of the portal's own fixed text, slugs, finding codes and counts. No
  text from the run report, from a page or from the spec is copied into it. The title, branch
  name and commit message follow the same rule as the description. Slugs appear in code
  spans. Each list is cut at 50 slugs, with a count of the rest. The Git host renders all of
  these, so a bare slug of hex digits would otherwise be linked as a commit, and a full list
  of 5,000 slugs would not fit a description.
- **Before a repository is connected**, the portal holds the generated bundle. It is read-only:
  there is no editor and no upload. It is validated, staged and published like any other bundle:
  a page that carries a blocker or a page error is withheld and the others are published (4.7).
  It has no `settings.json`, so the module runs for it with no settings (5.4).
- **Where the bundle root lives in the tenant's repository is a setting**, not part of this
  contract: a directory in the repository, set per API version (section 3), that holds the bundle
  and nothing else. Section 2 applies from that directory down. Its name and its place in the
  repository are not significant.

Not designed yet: the GitHub App's permissions and how its tokens are held (M4); the exact
branch and pull request names within the rule above, whether a newer run updates the open
pull request or replaces it, the values of the rate limit, and how the portal learns of a
merge (M5); hosts other than GitHub. The App holds write access
to tenants' repositories, so its design goes to the security reviewer before it starts (ADR
0007).

What is fixed besides:

- Git is the editing surface. The portal writes to a tenant's repository only by opening or
  updating a pull request that carries the guides module's output. It never changes a bundle on
  the branch it ingests from, and never changes one it holds.
- The guides module is handed the published spec by the portal (1.2) and fetches nothing. A
  hosted portal's published spec is not a public download unless the tenant chooses that.
- A valid bundle is staged, not published. Publishing is a separate step. In this contract,
  publishing a bundle means making it part of the portal's content. The product brief also uses
  "publishing" for making a portal public, which is a different step: a bundle published into a
  private preview is still seen only by signed-in members of the tenant's account (section 9).
- Publishing is atomic. A bundle replaces the previous one as a whole, and a failed bundle leaves
  the live portal unchanged. What is published is the bundle without its withheld pages (4.7);
  a page of the previous bundle that is withheld in the new one is removed with the rest.
- Whatever the transport, the step that extracts or reads the bundle enforces the section 2 limits
  on actual bytes, as it reads them and not from sizes an archive declares, and rejects links,
  absolute paths and `..`. Bytes are counted after content decoding: a limit applies to a file as
  it will be read, not to its compressed or transfer-encoded form. It stops at the first limit it
  passes.
- That step belongs to the control plane. The validator is a pure function of file contents and
  cannot see a symbolic link, so the control plane makes that check and reports it as
  `unexpected-file`.
- An archive used for transport is not an asset. A `zip` under `assets/` is never unpacked
  (section 2).

## 7. Versioning

- `contractVersion` is `major.minor`.
- **While the major version is 0, any minor version may change or remove things**, and a portal
  accepts exactly one version. A portal implementing this document accepts `0.3` only, and a
  `0.2` bundle is `unsupported-contract-version`. 0.3 differs from 0.2, and 0.2 from 0.1, in ways
  that would otherwise need a major version; see sections 12 and 10. A change made after a
  version has been released to the guides module carries a new version, as 0.3 does. No portal
  validator had been built when 0.3 was written, so no published bundle is affected.
- From 1.0: minor versions only add optional fields, components, attributes, variables and codes.
  Major versions may remove or change. The portal supports the previous major for at least 6 months
  and rejects a bundle whose major version it does not support.

## 8. Questions from v0.1, answered

| Question | Answer |
|---|---|
| Content the contract cannot express | A marker for incomplete content was needed and is added (4.7). Diagrams, video and widgets are not in 0.3. A `mermaid` block is shown as code. Rendering diagrams is a candidate for a later version and needs a security review first. |
| More than one spec version per guide | No. A bundle is pinned to one spec document by hash. One bundle belongs to one version of one API, and the portal keys bundles by project, API and version (section 3). |
| Localization | Out of scope. If it comes into scope, it will be one bundle per locale, not a locale dimension in the layout. |
| Disabling "Try it" per sample | Yes: `tryIt="false"` (4.3). |

Decided on 2026-11-27:

| Question | Answer |
|---|---|
| Which document guides are generated from, and which hash is compared | The published spec: the root document with the accepted spec-doctor fixes applied, as the portal published it (1.2, 3). |
| How a `<Todo>` or a page that is not `ready` gets resolved | A person edits the bundle in its Git repository and the portal ingests the new commit. Regenerating must not overwrite those edits (4.7). |
| What a `<Todo>` or a page that is not `ready` holds back | Its own page, not the bundle, whether the portal holds the bundle or a repository is connected. The other pages are published. A `guide:` link or `<Card>` `href` to a withheld page is published as plain text or an unlinked card and reported as the warning `link-to-withheld-page`; the page's `nav` entry is absent; the validation report lists withheld pages in `withheld`. An error still blocks the whole bundle (4.7, 5). This was open item 6. |
| Transport: how a bundle reaches the portal | The portal runs the guides module. With a repository connected, the portal's GitHub App proposes the bundle as a pull request on the tenant's repository, the tenant merges it, and the portal ingests from that repository. A regeneration is another pull request. Before a repository is connected the portal holds the bundle, read-only (6). The App is built in M4, the rest in M5. |
| How the guides module gets the published spec | The portal passes the bytes to the step that runs the module. Nothing is fetched (1.2, 6). |
| Who keeps a regeneration from overwriting edits | Both sides. The portal delivers a regeneration only as a pull request. The guides module's output is deterministic and stable, and it does not revert an edited page when given the existing bundle (4.7). |
| How a reader learns where to get a key | The portal renders a "get a key" link from a URL the tenant supplies. A guide does not need to say how credentials are issued (9). The portal never issues keys. |
| Several APIs in one portal, and versions of one API | One bundle per API version. Nothing in the bundle format changes (3). |
| Swagger 2.0 | Out of scope. The portal rejects it with a clear message (1.1). |
| Where the allowed hosts are listed for a server with an open host variable, such as `https://{host}/v1` with no `enum` | In the spec, as the variable's `enum`. The tenant supplies the values through a spec-doctor fix, so they are in the published spec. This decision did not change the rule in 4.3; the security review of the same day tightened it (10). A generator is not affected. A verified domain suffix, for hosts that cannot be listed, is planned for a later milestone and is not part of this contract. |

Still open, and not blocking 0.3:

1. The design of the GitHub App (M4) and of ingestion from the tenant's repository (M5), after
   a security review (section 6). Transport itself is decided.
2. Capturing a value whose key is not a plain identifier, such as `user-id`. The path grammar in 4.3
   cannot express it.
3. Linking to a webhook's documentation. There is no link form for it.
4. Specs split over several files. The published spec and its hash cover the root document only
   (1.2). A fix accepted in a file the root refers to is not in the published spec, and the hash
   does not change with that file. Operation ids are not affected, because a fix never changes an
   id. Whether the portal also publishes the patched referenced files is not decided; it does not
   block M1.
5. Whether a guide can ask for the "get a key" link at a particular place. In 0.3 it cannot: the
   portal places the link and nothing in a bundle refers to it (9). A way to place it would be an
   addition to the contract and needs a security review first.
6. A generated value for a field whose schema is a number. `{{unique}}` is always a string (4.6).
7. A screen in the dashboard that lists the report's `extensions` and helps a tenant choose
   roles. It is not designed. It would change `settings.json` only by proposing a pull request,
   and it shows text from a spec, so it needs a security review first (5.2, 5.4).
8. Whether publishing asks for confirmation when a new bundle would withhold a page that is
   live. From 0.3 a page error removes one page instead of stopping the bundle, so a faulty
   regeneration can take live pages down. That is the same reach a blocker already has. A
   question for the product manager. The security review of 2026-11-28 recommends
   confirmation: what one page's writer gains from a page error is removing a live page
   quietly.
9. Whether a generated page should be published before anyone has run it. The guides module
   marks every page it writes `ready`, and in its first run against a real API a call failed
   on 136 of 236 pages (9). A question for the product manager and the user. It must be
   decided before a bundle the portal holds is published unattended (security review of
   2026-11-28, F6). The rules for "Try it" in section 9 limit the harm in the meantime and do
   not answer it.

## 9. What the portal must handle

Facts about real bundles from the guides module, and duties this contract puts on the portal's
engine and renderer. They are here so they are written down on the portal side.

**Engine**

- Implement the operation id algorithm in 1.1 exactly, on the patched document, and expose for
  each operation its id and whether the id was derived. Every other part uses the engine's ids. If
  the two projects differ, every link and sample for a spec without `operationId`s fails.
- A spec-doctor fix that adds or replaces an `operationId` writes exactly the id the operation
  already has, so no fix changes an id (1.2; ADR 0004).
- The model carries the hash of the published spec, and bundle validation compares `spec.sha256`
  with it (ADR 0002, `source.publishedHash`).
- Operation ids are not URL-safe. Real ids contain `/` (`gists/create`) and other punctuation. The
  URL of a reference page must be built from an id by a mapping the portal owns; an id must never
  be used as a path segment as is.
- Define one default sample per operation, deterministic, used by the reference page and by
  `<Sample operation="x" />`.
- Define the sample media type as in 4.3.
- The sample generator adds credentials from the operation's security requirements, and nothing
  else places a credential. `{{api_key}}` is not a bundle variable: in a bundle it is
  `unknown-variable` (4.6). The guides module never writes it and relies on the generator.
- Variables are structure in the request representation and in generated code, never marker text
  (4.6, item 6; ADR 0005). The engine never searches a string for `{{`. A string from the spec is
  literal, whatever it contains.
- Inline blocks contain only the keys that have values. A block with only `path` is normal.
- Captured values arrive as quoted strings even where the parameter is an integer. Apply the typed
  substitution rule in 4.6. A captured value is a scalar within the limits in 4.6. The module
  writes captured names inside `body` at any depth, inside arrays included, and chains up to
  eleven calls on one page.
- Every value that reaches generated code, from a bundle, a spec or a captured response, is data.
  The sample generator must encode it for the target language, including shell quoting, so that a
  value cannot change the meaning of the code a reader copies. This holds for a value filled in at
  run time in the browser exactly as for one known at publish time: it goes through the same
  language encoder and location encoder (4.6). Replacing a placeholder string inside emitted code
  does not conform.
- Enforce the parser limits while parsing: frontmatter size and plain-YAML checks on the token
  stream, manifest size and nav depth, the JSON depth cap of 64, and the Markdown nesting cap
  (sections 2 to 4).
- Export the closed list of credential variable names (4.3), the closed list of encoder ids
  (4.6), the closed list of the thirteen built-in variable names, and the reserved pattern
  `unique(_[0-9]+)?` for captured names (4.3, 4.6).
- The engine never generates a `unique` value: it has no source of randomness and stays pure.
  It carries each one as a `Var` with its encoders, like any other variable, and gives its
  display text (4.6; ADR 0005).
- Work out which parameters are portal-supplied (4.3) from the model, and never fill one from
  the spec's example, default or schema where it carries a credential or is a controlled
  header. An API key header that is also declared as a parameter appears in a request once,
  and a credential is placed only for the security requirement in effect (4.3; ADR 0005).
  This part is M1 work: the sample builder and the spec doctor need it (ADR 0004, ADR 0005).
- Build `Cookie` alone, from the credential cookie and declared non-credential cookies, each
  through the cookie encoder (4.3; ADR 0005). M1 for samples, M2 for requests that are sent.
- Report `generated-value-as-secret` (4.6). M5, with the bundle validator.
- Give each code its one severity (5.1). Find page errors other than `unknown-anchor` before
  checking anchors (4.7). Severity never depends on `guides.lock.json`.
- Bundle validation is a pure function of the bundle's file contents and the normalized model. The
  control plane does the reading and unpacking, and the checks in section 6 that a pure function
  cannot make. Besides the report of section 5 it returns the tree of each page that has no
  page error, which is the only thing the renderer builds a guide page from (4.7; ADR 0003).
  A finding's `message` is fixed text of the portal's and holds no bundle text.
- Sample values built from types (`"email": "string"`) pass the schema but are not realistic. 149
  of Stripe's 186 generated pages have them. `report.json` marks those pages, and since the
  module's 0.3.0 each such page also opens with a `<Callout type="warning">` that says so, which
  readers see.

**Renderer**

- Follow the order of operations in 4.6. It is a security requirement.
- Do not enable GFM autolink literals. Text taken from spec descriptions contains bare `http://` URLs.
- Substitute reader-specific variables in the browser, into placeholders only. Published pages are
  static and carry no `{{` marker text for client code to find (4.6, item 6).
- Generate `unique` values in the browser when the page loads, one per `<Sample>` for
  `{{unique}}` and one per page for each of `{{unique_1}}` to `{{unique_9}}`, from the browser's
  cryptographic random source, as eight decimal digits. Fill them through the encoders. Show
  `UNIQUE` and `UNIQUE_1` to `UNIQUE_9` until then, without JavaScript, and in twins,
  `llms.txt`, search and the docs MCP. Each digit is drawn by rejection sampling from
  `crypto.getRandomValues`. If that is unavailable the placeholder keeps its display text;
  `Math.random` is never used. A value is never written to storage, a URL or analytics. Give
  the reader a control that replaces all of them on the page together (4.6). The control is
  UX's to design. M5.
- Render `<Todo>` in preview only.
- Build a guide page only from the tree the validator produced for a page with no page
  error, and never parse a page file. For a page with a page error, show only its slug,
  finding codes and line numbers, in preview and in the dashboard: never its title or
  description, and no excerpt of its source (4.7). M5.
- "Try it" sends nothing while a captured name in the request is unfilled; there is no
  run-all; a write shows the final request before it is sent (security review of 2026-11-28,
  F6). These are M2 requirements on the console and are stated in ADR 0003, "Live calls and
  example-response mode". The first has its effect from M5, when guides bring captured names.
- Leave a withheld page out of everything published, as 4.7 lists: no page and no URL, no twin,
  no `llms.txt` entry, no search record, no docs MCP entry, no `nav` entry and no group left
  empty by it, no back-link from a reference page, and no asset that only withheld pages refer
  to. Render a `guide:` link or `<Card>` `href` to it as text or an unlinked card. The set of
  withheld pages comes from the validation report's `withheld`; the renderer does not work it
  out again. In the preview of a staged bundle, show withheld pages and mark them. M5.
- Take the guides entry point from `nav` and the withheld set, never from a fixed slug or from a
  page's `type` (4.7).
- Render the "get a key" link (decided 2026-11-27, for M2). The tenant supplies the URL as a
  setting. The portal renders the link itself, as its own element: where it shows the control a
  reader pastes a key into, which every sample that needs a credential has; in the reference's
  authentication section; and, if the portal chooses, on a guide page whose `type` is
  `quickstart`. A guide page about authentication cannot be told from a bundle (the slug
  `authentication` is the generator's habit, not a rule), so the link reaches it through a
  sample's credential control only; see section 8, open item 5. Nothing in a
  bundle places it, names it or carries its URL, and no variable or component stands for it. A
  guide therefore does not need to say how credentials are issued, and a generator should not
  leave a `<Todo>` for that alone; it may still report the gap in `report.json`. The URL is
  tenant-supplied: it is held to the external link checks of 4.5 and rendered as a link with the
  `rel` value there, never as markup. The setting and where it is rendered go to the security
  reviewer with M2.
- Build every URL of a guide, a reference page and a twin from the base of the page's own API
  version (section 3; ADR 0003). An `op:`, `schema:`, `guide:` or `asset:` target resolves within
  the bundle's own API version.
- Guide slugs are chosen by the generator and include fixed names such as `authentication`, `errors`,
  `pagination`, `idempotency`, `rate-limits`, `webhooks` and, where settings name a permission,
  `permissions`. That is why section 3 reserves a prefix for guides.
- Prefix every `id` derived from a heading (4.5), and render external links with the `rel` value
  in 4.5.
- Build every `asset:` URL from the asset's type (section 2). For svg, pdf, json and zip, and for
  an image that was not re-encoded, it is an absolute URL on the tenant's asset origin and does
  not go through the portal's base path. Only a re-encoded png, jpg, webp or gif may get a URL on
  the page origin.
- Check an external link with the regex in 4.5, then parse it with the WHATWG parser and compare
  hosts.
- An unknown encoder id on a placeholder means the placeholder is not filled (4.6).
- The guides module sanitizes spec text before writing it into a page. The portal must not rely on
  that. Every page is untrusted input.
- Scale seen so far, from the module's 0.3.0: 186 pages from a spec with 612 operations, 257
  from one with 795, and 20 from one with 908.
- Navigation from the module is wide and flat: one group per tag, 52 top-level groups for one
  spec, and a single group of about 170 entries for a spec with no tags. The module expects to
  add a second level. The sidebar has to stay usable at that size.
- A page's `operations` lists operations of other resources too, because a guide creates the
  records it depends on first. One operation, such as "create customer", can therefore be
  listed by very many pages. The links back to guides on a reference page need an order and a
  limit, and nothing may assume that a page belongs to one resource.

**Control plane, proxy and MCP**

- The proxy and MCP enforce the header, destination, method and path rules in 4.3 on every request,
  server-side, from the published model. The bundle validator is not in the path of a direct call.
- The proxy sends requests to `https` servers only, follows no redirects, and strips `X-Ezdp-`
  headers from inbound requests (4.3; ADR 0003, "Proxy destination policy"). For an `http://` or
  localhost server the samples still render and live calls are withheld with a spec-doctor
  finding (ADR 0003, "Live calls and example-response mode").
- The proxy does not send a request whose parsed host differs from the host built by position
  (4.3). This is an M2 requirement.
- The hosted portal does not serve the published spec for public download unless the tenant
  chose that. It passes the bytes to the step that runs the guides module, so no path exists for
  fetching them (1.2, 6; ADR 0003, ADR 0007). M4 and M5.
- Run the guides module as an isolated step: its own OS process or container, apart from the
  one that fetches specs and the one that holds the App token, with no network access and no
  credential. ADR 0007 states the requirements in full; the per-tenant publish worker of ADR
  0003 does not meet them and is not the control. Its output is untrusted and is validated
  like any bundle, whoever ran the module.
- Give that step three inputs and no others: the published spec, the existing bundle, and the
  bytes of that bundle's `settings.json`. Leave `report.json` out of the existing bundle, and
  `guides.lock.json` when it is `invalid-lock`. Take the bundle directory and the run report
  from it and discard everything else it writes, its own validation result included. Handle a
  failed run and cut its text at 2,000 characters. Record the input hashes of each run, repeat
  none, rate-limit runs per tenant and keep one open pull request per API version. Write the
  pull request's title, branch name, commit message and description from fixed text, slugs in
  code spans, codes and counts only, with each list cut at 50 (section 6).
- Keep the run report with its run. Show it only to signed-in members of the tenant's account
  and only under the display rule of 5.2. Never put it in a pull request, a repository or
  anything published.
- Facts about the module as it is today (its status file, 2026-11-28). It is a library with one
  pure function and a command; the command also writes a file for a person beside the bundle
  directory. It needs Node 22.18 or later, has no build step and no published package, and is
  pinned by Git commit. At run time it uses `ajv`, `ajv-formats` (MIT) and `yaml` (ISC), inside
  the step we run. **It declares no licence**, which blocks it under ADR 0001 rule 5 until
  its owner chooses one. **Ajv compiles a schema to JavaScript**, which the engine ruled out
  for a tenant's schemas (ADR 0003). Whether the module gives Ajv a schema from the tenant's
  spec, or only the contract's own schemas, is not known on the portal side, and its
  validator is suspected of checking sample values against spec schemas. **Running the
  module on tenant specs is blocked until its owner confirms which it is; if it compiles
  tenant schemas, the module must change before it can be run** (section 6; ADR 0007).
- Its bundles do not all work when run. In its first run against a real API, 7 of 236 pages
  succeeded as written, 77 once a fixed example value was changed (the reason for `{{unique}}`),
  16 found an empty list, and on 136 a call failed; 32 of those failed because of the kind of
  key used. Every page it writes is `ready`. Nothing in this contract holds such a page back
  (section 8, open item 9).
- The reader's key is supplied by the reader. The portal never issues one. A key pasted into
  "Try it" is held in the reader's browser only and is passed through per request; it is never
  stored or logged by the portal (4.6, item 5; ADR 0003, "Reader keys"). A later handoff of the
  reader's key from the tenant's site after sign-in is not designed and needs a security review.
- Key every bundle, published spec and model by project, API and version (section 3; ADR 0002).
- The MCP has four meta-tools: find operations, describe an operation, call a read operation and
  call a write operation (decided 2026-11-27; ADR 0003, "MCP tools: reads and writes"). Which call
  tool an operation belongs to is decided server-side from the published model by its method:
  `GET` and `HEAD` are reads, and every other method, `OPTIONS` included, is a write. A tenant may
  mark a read as a write, never a write as a read. A call to the wrong tool is refused, with a
  result that names the right one. Writes are off until the tenant enables each operation,
  enforced server-side, and the write tool refuses one that is not enabled. Both call tools
  refuse the controlled headers of 4.3, `X-HTTP-Method-Override` among them, and reject a
  parameter the operation does not declare. Tool names are under 60 characters, and tool input
  schemas contain no `$ref`, `oneOf`, `anyOf` or `allOf`. These are M2 requirements. The
  `undeclared-parameter` warning in 4.3 is about values a guide sample sends; it does not make
  MCP accept them.
- Extraction enforces the section 2 limits on actual bytes, counted after content decoding, and
  rejects links, absolute paths and `..` (section 6).
- Publishing a bundle runs under the same per-tenant worker and time limit as publishing a spec
  (ADR 0003).
- Publishing a spec writes the published spec (1.2) as a file with fixed bytes and records its
  SHA-256. The publisher does this; the engine only serializes (ADR 0003, "The published spec").
- Write to a tenant's repository only by opening or updating a pull request that carries the
  guides module's output. Never commit to the branch the bundle is ingested from, never merge,
  and never change a bundle the portal holds. Incomplete content is resolved by a person in Git
  (4.7, 6). The GitHub App that opens the pull request has write access to tenants' repositories
  and is designed only after a security review (ADR 0007).
- Serve assets as section 2 says: svg, pdf, json and zip always from the dedicated per-tenant
  asset origin with the headers listed there; png, jpg, webp and gif from the asset origin, or,
  once re-encoded, on the page origin with `nosniff`.
- **M5 acceptance test.** The asset design is sound as far as is known and has not been verified
  in a browser. A browser test in Chrome, Firefox and Safari is an M5 acceptance item. It loads
  each image type through an image element on a portal page, including an svg sent with
  `Content-Disposition: attachment` and the sandbox policy from the asset origin, and asserts that
  the image shows. It opens each asset type directly and asserts that nothing in it runs. Guides
  with assets do not ship until it passes in all three.

**What asset serving means for hosting.** Two product decisions are affected. Neither changes.

- *Subpath hosting.* Pages under `host.com/docs` stay same-origin with the customer's site, which
  is the point of that mode: the customer's licensed fonts still load. Re-encoded png, jpg, webp
  and gif images may be served on the page origin, through the customer's reverse proxy like the
  pages themselves, and then the customer has nothing to change for them. svg, pdf, json and zip
  never come through the customer's reverse proxy. They load cross-origin from an origin we host,
  so that an asset opened directly cannot run in the customer's origin and the customer's proxy
  cannot strip its headers. The customer has nothing to route. A customer whose site sends a
  `Content-Security-Policy` must allow the asset origin in `img-src` only where guides show svg
  images, or where the portal keeps other images on the asset origin, and onboarding has to say so.
- *Static export.* Core pages still need no per-request server logic. An export whose guide assets
  are all png, jpg, webp or gif is self-contained: the re-encoded images are exported beside the
  pages, and whoever hosts the export must send `X-Content-Type-Options: nosniff` with them. Where
  guides have svg, pdf, json or zip assets, the exported pages point at the asset origin for those
  files, and whoever hosts the export either keeps using the asset origin we host or runs a second
  origin that sends the same headers. Copying svg, pdf, json or zip files into the export beside
  the pages does not conform, and neither does copying any image as it came in the bundle.
- *Private preview.* Decided 2026-11-27: a portal is a free private preview until the tenant
  makes it public, which needs a plan and proof of domain control. Until then nothing of it is
  served to anyone who is not signed in as a
  member of the tenant's account, and that includes files on the asset origin and the published
  spec. The asset origin is a different origin from the dashboard, so a member's session does not
  reach it by itself, and the headers in section 2 authorize nobody. How a request to the asset
  origin is authorized for a private preview is designed in M4 with the security reviewer. The
  headers in section 2 are unchanged in either state.
- *When "Try it" is live, and example-response mode.* Decided 2026-11-27. One rule says when
  the console sends a request, and it is in ADR 0003, "Live calls and example-response mode";
  it is not restated here. In short: a callable server whose host the tenant has verified, and,
  in a private preview, a caller signed in as a member of the tenant's account. Otherwise the
  console is in example-response mode, on a public portal as in a private preview (decided
  2026-11-28); it is never absent. In
  that mode it sends no request, to the proxy or to the API. It shows an example the spec
  declares for the response, labelled as an example, and says so where the spec declares none;
  it never shows a value made from a schema as a response. Nothing is captured from an example,
  so a `capture` name stays unfilled as if the sample had not been run (4.3). Where 4.3 says
  "Try it" is withheld for a server, this is what it means. Host verification arrives in M4b,
  so until then every private preview is in the mode. The MCP is off in a private preview. A
  generator is not affected.
- The naming and isolation of the asset origin are designed with custom domains (M5 and M6) and
  go to the security reviewer.

**Not exercised by the guides module today**, so the portal needs its own fixtures for them:
`<Tabs>`, assets and images, `label` and `hidden` in nav, pages of type `reference`, multiple
`capture` pairs, percent-encoded link targets, `guide:` links with anchors, form 4 of `<Sample>`,
`status` and `<Todo>`, and with them every rule for a withheld page in 4.7. Until the module
moves to 0.3, also: `{{unique}}` and `{{unique_1}}` to `{{unique_9}}`, `guides.lock.json` and
the rules for a deleted page, a page error on one page of a bundle, a sample for an operation
that declares a portal-supplied parameter, and the new members of `report.json`.

No bundle has yet been through a portal validator. The first real ingestion is a test of both
validators.

## 10. Changes in 0.2

Added:

- `status` in frontmatter, the `<Todo>` component, and the `blocker` severity (4.7, 5).
- `tryIt` on `<Sample>` (4.3).
- A named example combined with inline values (4.3).
- Optional `report.json` and its schema (5.2). In 0.2 it was a file of the bundle; 0.3 moves
  it out (section 12).
- The full list of codes (5.1).
- The operation id algorithm with a collision rule (1.1).
- The heading anchor algorithm and `unknown-anchor` (4.5).
- Percent-encoding in link targets, so any operation id can be linked (4.5).
- The order of operations for variables (4.6).
- New codes: `unlisted-page`, `invalid-tag-placement`, `unknown-anchor`, `nesting-limit`,
  `todo-present`, `page-not-ready`, `undeclared-parameter`, `invalid-report`,
  `link-to-withheld-page`.

Changed:

- The validation report: `errors` is renamed `findings`; `publishable`, `withheld` and
  `contractVersion` are added, and a finding may carry `target`.
- `<Sample operation="x" />` with no inputs renders the operation's default sample.
- `example` is defined in OpenAPI terms and may select parameter examples as well as a body example.
- A header or query parameter that the operation does not declare is a warning, not an error.
  Headers the portal controls are an error.
- Hand-written request code is a warning with a defined heuristic.
- `page-unreferenced` no longer applies to `concept` and `reference` pages.
- The derived operation id is described as the method immediately followed by the transformed path.
  v0.1's companion brief said `{method}_{path}`, which read literally gives a double underscore.
- Attribute values are always double-quoted, including numbers and booleans.
- Variables are no longer recognised in code spans. They cannot be escaped there.
- Image sources must be `asset:` targets.
- Angle-bracket autolinks are disallowed. GFM autolink literals are stated to be off.
- `{…}`, `import` and `export` in prose are plain text, not errors. v0.1 listed them as not allowed,
  which no validator could check without rejecting ordinary sentences. Nothing is evaluated either way.
- File paths may contain one extension; v0.1's character list omitted the `.`.
- The bundle root is the directory that holds `guides.json`; v0.1 showed it as `guides/`.
- Delivery: the upload endpoint of v0.1 is gone. The portal runs the guides module and delivers
  the bundle as a pull request on the tenant's repository, which is where people edit it; see the
  decisions of 2026-11-27 below (6).
- Versioning: 0.x minors may break; the portal accepts exactly one 0.x version.

Required by the security design review of 2026-11-26 and its re-review, and made before 0.2 was
released:

- `{{api_key}}` is removed. It is not available to bundles and is `unknown-variable` wherever
  variables are recognised. Credentials are placed only by the portal's sample generator. No
  credential variable name can be a captured name: `api_key`, `access_token`, `username` and
  `password` (4.6, 4.3).
- Published output carries variables as structure, never as marker text. Text from the spec never
  contains a variable (4.6, item 6).
- A captured value is a string, number or boolean of at most 2,048 characters. It is substituted
  into an ordinary code block only if it matches `^[A-Za-z0-9_][A-Za-z0-9._:~-]{0,255}$`, which
  excludes a leading `-`, and into a sample or request only through the language and location
  encoders. An unknown encoder id leaves the placeholder unfilled, and a typed scalar is written by
  JSON serialization (4.3, 4.6).
- The escape for a literal `{{` in a `<Sample>` string is written out: `\u007b` (4.6). The earlier
  draft lost the escape sequence.
- Header names must be RFC 9110 tokens and values must not contain CR, LF or NUL. The check is
  repeated after substitution, and if the value fails then, the request is not sent (4.3).
- The list of headers a sample cannot set is longer: forwarding, hop-by-hop and method-override
  headers, `Origin`, `Referer`, `Expect`, every `Proxy-*` and `Sec-*` name, and the portal's
  internal prefix `X-Ezdp-`, which the proxy also strips from inbound requests. An operation that
  requires a controlled header gets a spec-doctor finding and "Try it" is withheld (4.3).
- The sample checks are stated to be a bundle check. The proxy and MCP enforce the same rules
  server-side. A server variable with no `enum` is validated by its position in the server URL
  (4.3). The rule for a variable in the host was replaced on 2026-11-27; see below.
- The portal sends requests to `https` servers only. For any other server the samples still
  render, and "Try it" and MCP are withheld with a spec-doctor finding (4.3).
- svg, pdf, json and zip assets are always served from a dedicated per-tenant asset origin with
  fixed response headers, which include `Cross-Origin-Resource-Policy` and a policy of its own for
  svg. png, jpg, webp and gif use the asset origin or, once re-encoded by the portal, the page
  origin with `nosniff`. SVG sanitizing is an allowlist. A zip is never unpacked (2).
- Limits: `guides.json` is at most 1 MB and frontmatter at most 16 KB; duplicate frontmatter keys
  are `invalid-frontmatter`; Markdown nesting is capped at 32, with the new code `nesting-limit`;
  JSON in a bundle is nested at most 64 deep; `report.json` arrays hold at most 1,000 items
  (2, 3, 4, 4.1, 5.2).
- External links must match a fixed regex and contain no `\`: `https`, a lowercase ASCII host, an
  optional port, then printable ASCII. The portal also parses the link with the WHATWG parser and
  rejects it if the parsed host differs (4.5).
- A link target that is not valid UTF-8 after percent-decoding is `link-not-allowed` (4.5).
- Guides are served under a reserved prefix. This was a note to the renderer and is now a rule (3).
- A heading anchor is not the HTML `id`; the portal prefixes ids (4.5).
- Extraction enforces the limits on actual bytes, counted after content decoding, and rejects
  links, absolute paths and `..` (6).

Product decisions of 2026-11-27, also made before 0.2 was released:

- Guides are generated from the published spec: the root document with the accepted spec-doctor
  fixes applied, written out by the portal when it publishes. `spec.sha256` is the SHA-256 of that
  document's bytes as published, and `spec-hash-mismatch` compares against it. With no fix applied
  the published spec is the original, byte for byte. Earlier drafts of 0.2 hashed "the root
  OpenAPI document" without saying which (1.2, 3, 5.1).
- The operation id algorithm runs on the published spec. A fix that adds an `operationId` writes
  the id the operation already had, so a fix never changes an id (1.1, 1.2).
- A changed published spec, including one changed by accepting a further fix, gives existing
  guides `spec-hash-mismatch` until they are regenerated (1.2).
- A `<Todo>` or a page that is not `ready` is resolved by a person editing the bundle in its Git
  repository. Regenerating must not overwrite a person's edits. The contract's rules apply to the
  bundle as ingested, whoever wrote it (4.7, 6).
- Swagger 2.0 is stated to be out of scope (1.1).
- The allowed hosts of a server with an open host variable are listed as the variable's `enum`,
  written by a spec-doctor fix and so present in the published spec. This decision did not change
  the rule in 4.3 (1.2, 4.3, 8).
- One item is added to the open list: specs split over several files (8).
- The MCP's `call` tool is split into a read tool and a write tool (9). Nothing in a bundle
  names an MCP tool, so a generator is not affected.

Required by the security review of 2026-11-27, also made before 0.2 was released. None of it
changes what a generator writes:

- The rule for a host variable with no `enum` is replaced. Such a variable is callable only when
  its label is followed by literal text that holds a registrable domain under the Public Suffix
  List. The earlier draft allowed any single label that was not the last, which made
  `https://{x}example.com` and `https://{x}.github.io` callable (4.3).
- An empty `enum` allows no value (4.3).
- After substitution the parsed host must equal the host built by position, or the request is
  not sent (4.3, 9).
- The published spec of a hosted portal is not a public download unless the tenant chooses that.
  The portal removes nothing from the published spec (1.2, 6, 8). The review's authenticated
  path for the guides module was replaced the same day: the portal passes the bytes to the
  module, so nothing is fetched (below).

Required by four further decisions of the user on 2026-11-27 (guides delivery, reader keys, free
private preview, several APIs per portal), also made before 0.2 was released:

- Delivery is decided. The portal runs the guides module as a step of its pipeline, with the
  published spec bytes and optionally the existing bundle as inputs and no network access. With
  a repository connected, the portal's GitHub App proposes the bundle, and each regeneration, as
  a pull request on the tenant's repository, and the portal ingests from that repository. Before
  that the portal holds the bundle, read-only. Where the bundle root sits in the repository is a
  setting (1.2, 6, 8).
- "The portal never writes to a bundle" is restated: the portal never changes what a bundle
  says, never commits to the branch it ingests from and never merges; it does open pull requests
  that carry the guides module's output (4.7, 6, 9).
- Regenerating without losing edits is split between the two sides, and the guides module's
  part is stated as three requirements: deterministic output, stable output, and no reverting of
  an edited page when the existing bundle is given. A module run by the portal leaves
  `generatedAt` out (4.7). **This binds a generator.**
- In a bundle held by the portal before a repository is connected, a page with a blocker is
  never published. An earlier draft of 0.2 said the rules as written blocked the whole bundle
  and left page-by-page publishing undesigned; the decision below replaces that (4.7, 8).
- The portal renders the "get a key" link from a URL the tenant supplies. No variable or
  component is added for it, and a guide need not explain how credentials are issued. The
  example `<Todo>` in 4.7 was about that and is replaced (4.7, 8, 9).
- A portal that is a private preview serves nothing without sign-in, the asset origin and the
  published spec included (9). No rule for a generator changed.
- One bundle belongs to one version of one API, and the portal keys bundles by project, API and
  version. Nothing in the bundle format changed (3, 8, 9).

Required by two more decisions of the user on 2026-11-27 (withholding by page; "Try it" in a
private preview), also made before 0.2 was released. Neither changes what a generator writes;
the first changes what a generator's own validator reports:

- **A blocker withholds its own page, not the bundle.** Earlier drafts of 0.2 said a bundle with
  a `todo-present` or `page-not-ready` finding could not be published. It can: the pages that
  carry a blocker are withheld and the others are published, whether the portal holds the bundle
  or a repository is connected. 4.7 states what withheld means for the page, its URL, navigation
  and empty groups, links and cards that point at it, its twin, `llms.txt`, search, the docs
  MCP, back-links from reference pages, its assets and the guides entry point. Preview still
  shows every page. An `error` still blocks the whole bundle (4.7, 5, 6).
- The validation report: `publishable` stays one value for the bundle and no longer turns false
  for a blocker; `withheld` is added and lists the withheld pages; a finding may carry `target`
  (5).
- New code: `link-to-withheld-page`, a warning, for a `guide:` link or `<Card>` `href` from a
  page that is not withheld to one that is (4.5, 4.7, 5.1).
- Open item 6 of section 8 is decided and removed from the open list (8).
- Where "Try it" makes no live call it shows the spec's declared example response and sends
  nothing, and nothing is captured from it. That is the case for a server that is not callable
  or whose host is not verified; a private preview
  makes live calls to a verified host for a signed-in member. The MCP is off in a private
  preview (9; ADR 0003, "Live calls and example-response mode").

## 11. Decisions on the v0.1 feedback

Numbers are those in [`guides-contract-feedback.md`](./guides-contract-feedback.md).
**Confirmed** means the contract now says what the guides module assumed or proposed. **Changed**
means it says something different, and a generator built on the assumption needs to change.
**Rejected** means the proposal or assumption does not hold.

### Proposals

| # | Proposal | Decision | The contract now says |
|---|---|---|---|
| 1 | Marker for incomplete content | Confirmed | Frontmatter `status: draft\|review\|ready`, default `ready`, and `<Todo title="…">`. Both show in preview and withhold their own page from publishing, as `page-not-ready` and `todo-present`, severity `blocker`. The rest of the bundle is published. (4.7, 5) |
| 2 | `tryIt` on `<Sample>` | Confirmed | `tryIt="true"\|"false"`, default `true`. `false` is binding on the portal. `true` is a request; the portal may still withhold "Try it". (4.3) |
| 3 | Named example with inline values | Confirmed, with a rule for `body` | `example` and an inline block may be combined. Inline `path`, `query` and `headers` are merged per parameter and win over the example. A `body` from both is `invalid-sample`. (4.3) |
| 4 | Exempt `concept` pages from `page-unreferenced` | Confirmed, and extended | The warning applies only to `quickstart`, `how-to` and `tutorial` pages with no `operations`. `concept` and `reference` are exempt. (5.1) |
| 5 | Publish the full list of codes | Confirmed | The list in 5.1. All of the module's names are kept. `api-request-code` becomes a warning, `unsupported-syntax` is generator-side only, and nine codes are added. |
| 6 | A place for the run report | Confirmed | Optional `report.json` at the bundle root, with a minimum shape and a schema; extra members are allowed and ignored. An invalid report is the warning `invalid-report`. (5.2) **Changed in 0.3:** the report is an output of the run that the portal keeps. It is no longer a file of the bundle and is never in the tenant's repository. |

### Assumptions

| # | Topic | Decision | The contract now says |
|---|---|---|---|
| 1 | `<Sample>` with no inputs | Confirmed, and extended | `<Sample operation="x" />` is valid for any operation and renders the operation's default sample, the one on its reference page. (4.3, form 1) |
| 2 | What `example` names | Changed: made exact | Key `N` in the `examples` map of a request body media type (sample media type first, then document order), together with the `examples` entry `N` of every path, query and header parameter that has one. At least one must exist, or `unknown-example`. (4.3) |
| 3 | Variables and schema validation | Confirmed, and made exact; limits added | A JSON string that is exactly one variable is replaced by the value with its own JSON type. A variable inside a longer string is interpolation. Any string containing a variable is exempt from schema validation. A captured value is a string, number or boolean of at most 2,048 characters, and reaches a sample or request only through the language and location encoders; a value its location rejects leaves the placeholder in place. It is filled into an ordinary code block only if it matches `^[A-Za-z0-9_][A-Za-z0-9._:~-]{0,255}$`. `{{api_key}}` is not a bundle variable. (4.6) |
| 4 | `capture` syntax | Changed | Pairs are separated by exactly one space. Commas are not accepted. Names match `[a-z][a-z0-9_]*`; paths use `$`, `.member` and `[index]` only. A name may be captured once per page and may not be a built-in or a credential variable name (`api_key`, `access_token`, `username`, `password`). Only a string, number or boolean of at most 2,048 characters is captured. (4.3) |
| 5 | Literal `<` and `{` in prose | Confirmed | `\<` and `\{` are CommonMark escapes and produce text. `\<` is required before a letter, `/`, `!` or `?`. `\{` is allowed but not required: a `{` that is not part of `{{` is always text. An escaped character never opens a tag or a variable. (4.1) |
| 6 | Attribute values | Confirmed, with one change | Double quotes only. No escapes and no entity decoding. A value cannot contain `"` or a line break. Braces are literal and **need not be removed**. Variables are not recognised in attributes or in code spans. (4.2, 4.6) |
| 7 | Markdown inside components | Confirmed, as a requirement | A tag is alone on one line, with blank lines around it, except the fenced block inside `<Sample>`. Violations are `invalid-tag-placement`. Components may not sit inside lists, block quotes, tables or footnotes. (4.2) |
| 8 | Card links | Confirmed | `href` on `<Card>` takes the same forms as a Markdown link and is optional. (4.2, 4.5) |
| 9 | Fragment links | Confirmed, and anchors defined | `#anchor` alone is `link-not-allowed`. `guide:slug#anchor` is valid, the anchor algorithm is in 4.5, and a missing anchor is `unknown-anchor`. |
| 10 | Webhooks | Confirmed | Webhooks and callbacks are not operations. Referring to one is `unknown-operation`. (1.1) |
| 11 | Derived `operationId` | Confirmed, with a collision rule | The lowercase method immediately followed by the path with each code point outside `A-Z a-z 0-9` replaced by `_`: `get_payments__id_`. Collisions are resolved by sorting on path then method and appending `_2`, `_3`, …. Duplicate explicit ids are resolved the same way. (1.1) |
| 12 | Identifier characters | Changed: widened | Any identifier is accepted. In attributes and frontmatter it is written verbatim; only `"` and line breaks cannot be written. In link targets, characters outside `A-Z a-z 0-9 _ . - / : ~ @ $ ! * + , ; =` are percent-encoded and the portal decodes once. Ids matching the module's current pattern need no encoding. A target that is not valid UTF-8 after decoding is `link-not-allowed`. (4.5) |
| 13 | Nav labels | Confirmed | `label` is optional on a page entry and replaces the title in the sidebar only. (3) |
| 14 | Hand-written request code | Changed | A warning, not an error. The portal's check is: an ordinary code block that contains `{{base_url}}` is `api-request-code`. `curl` to another host is not flagged. A generator may be stricter with its own output. (4.4) |
| 15 | Unknown header in a sample | Changed | An undeclared header or query parameter is the warning `undeclared-parameter` and is sent, unless it is one of the following, which are `invalid-sample`: a header the portal controls, declared or not (the list in 4.3, which includes forwarding, hop-by-hop and method-override headers, `Proxy-*`, `Sec-*` and `X-Ezdp-*`); a name that carries a credential; a header name that is not an RFC 9110 token; a header value with CR, LF or NUL. An unknown `path` name is `invalid-sample`. These are bundle checks; the proxy and MCP enforce the same rules server-side on every request, the proxy strips `X-Ezdp-*` from inbound requests, and both MCP call tools reject undeclared parameters. (4.3, 9) |
| 16 | OpenAPI 3.2 | Confirmed | The contract covers 3.0 and 3.1. A 3.2 document is read as 3.1; 3.2-only constructs are ignored and cannot be referenced. (1.1) |
| 17 | Bare URLs in prose | Confirmed, and tightened | GFM autolink literals are off: a bare URL is text. Angle-bracket autolinks are `disallowed-syntax`. The module does not need to break URLs up. (4.1) |
| 18 | Entities | Confirmed, and extended, as a requirement on the portal | A variable exists only where its braces are literal characters in the source. Braces from character references, backslash escapes or JSON `\u` escapes are text. Substitution is a single pass and its output is never parsed again. Published output carries variables as structure, never as marker text; client-side substitution fills only those placeholders and never searches text or code for `{{`; text taken from the spec never contains a variable. The feedback's example, `{{api_key}}`, is no longer a variable at all. (4.6) |

## 12. Changes in 0.3

0.3 answers the guides module's feedback on 0.2. 0.2 had been released and implemented, so
these changes carry a new version. Section 13 gives the decision on each item.

Added:

- The severity `page-error`. A fault in one page's content withholds that page and no longer
  stops the bundle (4.7, 5, 5.1).
- The generated values `{{unique}}` and `{{unique_1}}` to `{{unique_9}}` (4.6).
- `guides.lock.json`, the generation record, with its schema
  [`guides-lock.schema.json`](./guides-lock.schema.json) (2, 5.3).
- `settings.json`, the tenant's settings for the generator, as a third input of the step that
  runs it (2, 5.4, 6).
- In `report.json`: `code`, `severity`, `title`, `fix` and `count` on a `specProblems` item, and
  the `extensions` list (5.2).
- The definition of a portal-supplied parameter and of a name that carries a credential (4.3).
- What the pull request's description says, when the step runs, and what a failed run does (6).
- New codes, all warnings: `missing-lock`, `invalid-lock`, `invalid-settings` and
  `generated-value-as-secret` (5.1).

Changed. **Each of these binds a generator built on 0.2:**

- `contractVersion` is `"0.3"`. A portal on 0.3 rejects `"0.2"` (3, 7).
- Twenty-two codes move from `error` to `page-error`: `nesting-limit`, `invalid-frontmatter`,
  `heading-h1`, `disallowed-syntax`, `unknown-component`, `unknown-attribute`,
  `invalid-attribute`, `invalid-nesting`, `unbalanced-component`, `invalid-tag-placement`,
  `unknown-variable`, `unknown-operation`, `unknown-schema`, `unknown-guide`, `unknown-anchor`,
  `unknown-asset`, `unknown-response`, `unknown-example`, `link-not-allowed`, `invalid-sample`,
  `invalid-capture` and `invalid-code-info`. A generator's validator reports them with the new
  severity and lists their pages in `withheld`. Twelve codes stay errors (5.1).
- `withheld` lists pages with a blocker or a page error. `unknown-anchor` is not checked
  against a page that carries another page error (4.7, 5).
- A page a person edited is recognised from `guides.lock.json`, not from `report.json`. The
  record holds a hash for every page, not the first 1,000. The generator reads no report of
  an earlier run (4.7, 5.2, 5.3).
- **`report.json` is no longer a file of the bundle.** The generator writes it beside the
  bundle directory, or returns it apart from the bundle's files, and the portal keeps it. A
  `report.json` inside a bundle is `unexpected-file`, an error (2, 5.1, 5.2, 6).
- A page a person deleted is not written again (4.7, 5.3). Under 0.2 the module wrote it again.
- With no valid record the generator keeps every existing page and the navigation as they are.
  That was the module's behaviour; it is now a rule (5.3).
- Settings reach the generator only as the existing bundle's `settings.json`, and the
  generator emits that file unchanged (5.4, 6).
- A required parameter that is portal-supplied is not counted as missing. A cookie parameter
  is portal-supplied (4.3). 0.2 made a sample for such an operation impossible to write.
- `{{idempotency_key}}` is recognised only in a `<Sample>` inline block. In prose or an
  ordinary code block it is `unknown-variable` (4.6). The module never wrote it there.
- A captured name cannot match `unique(_[0-9]+)?` (4.3).
- The `extensions` list in `report.json` now has a shape and limits; a report that breaks them
  is `invalid-report` and is ignored (5.2).
- The schema `$id`s end in `-0.3.json`.

Confirmed, with no change to the rules:

- A page may hold any number of `<Steps>`, each under its own heading (4.2).
- A sample cannot set a controlled header or a name that carries a credential, declared or
  not (4.3).
- The run report stays optional (5.2).
- Every rule applies to the bundle as ingested, whoever wrote each line (4.7).

Required by the security review of 2026-11-28
(`docs/reviews/2026-11-28-security-review-contract-0.3.md`), which passed this draft subject to
these fixes. They were made before 0.3 was released to the guides module, so the version is
unchanged. The review accepted the 22 and 12 split of codes, the `unique` variables, the
placement and limits of `settings.json`, the report schema and the generation record.
**The first four below bind a generator**; the rest bind the portal.

- **The run report leaves the bundle** (F1). The portal keeps `report.json` for the dashboard
  and does not include it in a pull request. It is an output of a run, written beside the
  bundle directory. The bundle root no longer lists it, a `report.json` in a bundle is
  `unexpected-file`, its 2 MB limit is checked on the report and gives `invalid-report`
  where it gave `size-limit`, and `invalid-report` is a finding on the run (2, 4.7, 5.1,
  5.2, 6).
- **No duplicate keys** in `settings.json`, `guides.lock.json` or the run report:
  `invalid-settings`, `invalid-lock`, `invalid-report` (ruling 4; 2, 5.1 to 5.4).
- **New warning `generated-value-as-secret`**, where a generated value fills a property or
  parameter with `format: password` (F5; 4.6, 5.1).
- **A blocking note to the module.** The portal runs the module on no tenant's spec until its
  owner confirms what Ajv is given; if it compiles tenant schemas the module must change
  first. The missing licence blocks it under ADR 0001 rule 5 (ruling 8; 6, 9).
- **Rendering is gated by the validator.** The renderer builds a page only from the
  validator's tree for a page with no page error. A page with a page error shows its slug,
  codes and line numbers and nothing else, so the title and description of a page with
  `invalid-frontmatter` are never shown; earlier wording would have shown them. A finding's
  `message` holds no bundle text (ruling 1; 4.7, 5).
- **How a `unique` value is drawn**: rejection sampling from `crypto.getRandomValues`, never
  `Math.random`, display text when that is unavailable, and never stored (ruling 2; 4.6).
- **Which security requirement places a credential** for a portal-supplied parameter: the one
  in effect for the request, and of alternatives only the one selected (ruling 3; 4.3).
- **The portal alone builds `Cookie`**, through a cookie encoder, and a name equal to a
  credential cookie's is never filled from the spec. Earlier wording both forbade and
  allowed a spec value in that header (F4; 4.3).
- **How report text is displayed** (ruling 5; 5.2).
- **The existing-bundle input** omits `report.json`, and the record when it is
  `invalid-lock`; slugs from the record are lookup keys (ruling 6; 5.3, 6).
- **The pull request**: its title, branch name and commit message are fixed text like the
  description, slugs are in code spans, and each list is cut at 50 (ruling 7; 6).
- **The `x-` warning is on every pull request** from a run that had a `settings.json`, not
  only on one a settings change started (F2; 5.4, 6).
- **When the step runs** is decided from the portal's own record of each run's input hashes,
  not from `settingsSha256`; no run is repeated, runs are rate-limited per tenant, and there
  is one open pull request per API version (F3; 5.3, 5.4, 6).
- **A failed run's text** is cut at 2,000 characters (6).
- **"Try it"** sends nothing while a captured name in the request is unfilled, has no
  run-all, and shows a write before sending it (F6; 4.3, 8, 9). Open item 8 carries the
  review's recommendation, and open item 9 must be decided before a held bundle is published
  unattended.

Not changed by the review, and still open: the isolation of the step is the portal's and is
in ADR 0007; the guides module's code and its use of Ajv were not reviewed.

## 13. Decisions on the v0.2 feedback

Items are those under "On v0.2" in
[`guides-contract-feedback.md`](./guides-contract-feedback.md), in its order and with its
numbers. **Confirmed**, **Changed** and **Rejected** mean what they mean in section 11.

### The gap

| Topic | Decision | The contract now says |
|---|---|---|
| A required parameter that a sample may not set | Confirmed, and made exact | A declared parameter that is a controlled header, carries a credential, or is a cookie is **portal-supplied**. A sample never sets it, and it is never counted as missing, so the two rules no longer meet. The portal decides what is sent: a credential is placed by the sample generator only for the schemes of the security requirement in effect for the request, and the parameter's own example is never used. The portal alone builds `Cookie`. An API key header declared both as a scheme and as a parameter is sent once, holding the credential. `Authorization`, `Content-Type` and `Accept` parameters are not in the portal's model at all, as OpenAPI says. (4.3) |

### Proposals

| # | Proposal | Decision | The contract now says |
|---|---|---|---|
| 1 | Withhold an invalid page instead of blocking the bundle, when a person wrote it | Changed: confirmed for every page, whoever wrote it | A fault in one page's content has the new severity `page-error` and withholds that page; the other pages are published. Twenty-two codes have it. A fault in the bundle's structure stays an `error` and stops the bundle: the manifest, the version, `nav` against the files, the layout, paths, encodings, size limits and asset types. **Authorship plays no part**: severity is a function of the bundle's content and the spec, and the validator does not read the generation record. Nothing of an invalid page is rendered, in preview either: preview lists its slug and its findings' codes and line numbers, and the renderer builds a page only from the validator's tree. (4.7, 5, 5.1) |
| 2 | Severity and a fix in `specProblems` | Confirmed, with limits | A `specProblems` item may carry `code`, `severity` (`high`, `medium`, `low`), `title` (200 characters), `fix` (1,000 characters) and `count`. `fix` is advice in plain text, never a patch, and is shown apart from the spec doctor's findings. Other members stay extra and are ignored. (5.2) |
| 3 | A variable for a value that must be new each time | Confirmed, and extended | `{{unique}}`: eight decimal digits generated in the reader's browser, one value per `<Sample>`, recognised in a sample's inline block only. `{{unique_1}}` to `{{unique_9}}`: the same kind of value, one each per page, so a later step can send the value an earlier step sent. Always a string. Published pages, twins and a page without JavaScript show `UNIQUE` or `UNIQUE_1` to `UNIQUE_9`. Nothing is generated at publish time. Each digit comes from `crypto.getRandomValues` by rejection sampling, and a value is never stored. A value that fills a `format: password` field is reported as `generated-value-as-secret`. Which fields need one is the module's to work out. (4.6) |
| 5 | Settings as an input of the portal's step | Confirmed, with the place fixed | Settings are the third input. They live in the bundle as `settings.json`, in the tenant's repository, at most 64 KB, and have no other source. The portal passes the bytes unchanged and interprets nothing in them; the generator emits the file unchanged. Their contents are the module's. A bundle the portal holds before a repository is connected has none. A setting that shows an `x-` field publishes its values; the change arrives as a pull request, and every pull request from a run that had settings says so. (5.4, 6) |
| 6 | Define `extensions` in the report schema | Confirmed, with limits | At most 1,000 items, each with `name`, and optionally `count`, `usedIn`, `valueKinds`, `example` (200 characters, as text) and `suggestedRole`. Every string is untrusted and shown as plain text, to signed-in members of the tenant's account only. For that reason the report is kept by the portal and is not in the bundle or the tenant's repository. The screen that would use it is not designed and needs a security review. (5.2) |

### Questions and assumptions

| # | Topic | Decision | The contract now says |
|---|---|---|---|
| 1 | Should a page a person deleted stay deleted? | Yes | A generator does not write again a page it wrote and a person deleted. The deletion is carried from run to run in `deleted` in the generation record, which is in the bundle. A person brings the page back by taking its slug out of that list. With no valid record a deletion cannot be recognised. (4.7, 5.3) |
| 2 | Edits are recognised by a hash in `report.json`, which may be deleted | Changed | The record moves out of `report.json` into `guides.lock.json`, with a defined shape and a hash for every page. The run report stays optional and is information only; it is an output of the run that the portal keeps, not a file of the bundle, so no run can read one. A bundle with no record is still valid and gets the warning `missing-lock`; the generator then keeps every existing page as it is. The portal's pull request description says what each file is, that the record is to be left in place, and what happens without it. (5.2, 5.3, 6) |
| 4 | Several `<Steps>` on a page | Confirmed | Any number of `<Steps>` may appear on a page, each under its own `h2` or not. A `<Steps>` cannot be inside a `<Step>` at any depth. (4.2) |

### Rejected alternatives

- **Withholding by authorship** (proposal 1 as written). Validation would depend on the
  generation record, a file the tenant can edit, and two pages with the same fault would be
  treated differently. The rule is by the kind of fault instead.
- **Making the run report required.** A bundle would stop publishing because a file of
  information was missing.
- **Keeping `report.json` in the bundle**, as drafts of 0.3 did until the security review. It
  would be committed to the tenant's repository, and on a public repository the spec's
  defects and the values of its `x-` fields would be public.
- **Making the generation record required.** Published pages do not depend on it, and a
  missing record loses nothing a person wrote, so a warning and a plain statement in the pull
  request are enough.
- **Keeping settings in the portal.** They would not be versioned or reviewed beside the pages
  they change, a bundle could not be regenerated from the repository and the spec alone, and
  there would be two sources once a repository is connected.
- **One `{{unique}}` value per page, or per sample only.** Per page, two records created on
  one page would collide. Per sample only, a later step could not send the same value unless
  the API returned it. A name chosen by the author, by a new attribute, was also rejected: it
  adds a second kind of name to check against captured ones, where a closed list of nine adds
  none.
- **Letters in a generated value.** A field that takes letters and digits takes digits, and so
  does a field that takes digits only. A field that needs a letter gets one as literal text
  beside the value.
