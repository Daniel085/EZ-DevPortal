# Guides Bundle Contract

Status: **draft v0.2**. Revised by the portal side in response to the guides module's feedback on
v0.1 ([`guides-contract-feedback.md`](./guides-contract-feedback.md)). Every proposal and assumption
in that feedback is answered by number in [section 11](#11-decisions-on-the-v01-feedback). This
draft also carries the corrections required by the security design review of 2026-11-26. They were
made before 0.2 was released to the guides module, so the version is unchanged; section 10 lists
them. Awaiting the guides module's re-sync and confirmation.

This is the interface between two projects:

- **Guides module** (separate project): takes an OpenAPI spec and produces developer guides.
- **EZ-DevPortal** (this project): renders the API reference, code samples, theme and hosting, and
  ingests the guides.

The guides module produces a **guides bundle**. The portal validates it, renders it, and never edits it.

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
| Transport of the bundle into the portal | Portal |

The rule that follows from this table: **a guide never contains hand-written API request code.** It
names an operation and the values to send, and the portal renders the sample in every language. This
keeps guides in step with the reader's language choice and with the samples the portal tests.

### 1.1 The spec, and how operations are identified

- The contract is defined for OpenAPI **3.0 and 3.1**. A 3.2 document is read as 3.1 by both sides;
  constructs that exist only in 3.2 are ignored and cannot be referenced.
- An **operation** is an HTTP operation under `paths`. Webhooks and callbacks are not operations in
  this contract and are not valid targets for `op:` links, `<Operation>`, `<Sample>`, `<Response>`
  or the `operations` frontmatter field. Each of those reports `unknown-operation`.
- An operation is referred to by its **operation id**, compared exactly, code point for code point,
  case-sensitively. A schema is referred to by its key under `components/schemas`, compared the same
  way.

**Operation ids.** Both projects must derive identical ids, so the algorithm is fixed:

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

## 2. Bundle layout

The bundle is a directory. The directory that contains `guides.json` is the **bundle root**; its own
name is not significant. All paths in this contract and in validation reports are relative to it.

```
guides.json          manifest (required)
report.json          generator's run report (optional, see 5.2)
pages/               one file per guide, .md
  quickstart.md
  payments/accept-a-payment.md
assets/              images and downloadable files (optional)
  payments/flow.png
```

- The root may contain only `guides.json`, `report.json`, `pages/` and `assets/`. Anything else,
  including dotfiles, symbolic links, empty directories outside this layout, and files under
  `pages/` that do not end in `.md`, is `unexpected-file`.
- `guides.json`, `report.json` and every page are UTF-8 without a byte order mark, with LF line
  endings and no NUL characters. A violation is `invalid-encoding`.
- A file path under `pages/` or `assets/` is one or more segments separated by `/`. Each segment
  matches `[a-z0-9-]+`. The last segment is followed by one extension matching `\.[a-z0-9]+`. The
  whole path is at most 200 characters. A violation is `invalid-path`.
- Limits: 1 MB for `guides.json`, 2 MB per page, 16 KB for a page's frontmatter (section 4), 2 MB
  for `report.json`, 5 MB per asset, 200 MB and 5,000 files per bundle. A violation is `size-limit`.
- Allowed asset extensions: `png`, `jpg`, `webp`, `gif`, `svg`, `pdf`, `json`, `zip`. Any other
  extension, or a file whose content is not of the type its extension names, is `asset-type`.
- Assets are untrusted. The portal shows images only through image elements and never inlines an
  asset into a page as markup. SVG sanitizing is an allowlist that rejects DOCTYPE, entities,
  `script`, `foreignObject`, event attributes and external references. A zip is never unpacked.
- Assets are served from a dedicated per-tenant asset origin, never the portal's or the customer's
  origin. Every response has: `Content-Type` from the portal's extension table;
  `X-Content-Type-Options: nosniff`; `Content-Security-Policy: default-src 'none'; sandbox`;
  `Content-Disposition: attachment` for svg, pdf, json and zip. A generator is not affected: it
  writes `asset:` targets and the portal builds the URL. What this means for the portal's hosting
  modes is in section 9.

## 3. Manifest: `guides.json`

The JSON Schema is in [`guides-manifest.schema.json`](./guides-manifest.schema.json).

```json
{
  "contractVersion": "0.2",
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

- A missing manifest is `missing-manifest`. One that is not JSON or fails the schema is
  `invalid-manifest`. One larger than 1 MB is `size-limit`.
- `contractVersion` must be exactly `"0.2"` for a portal implementing this document. Anything else
  is `unsupported-contract-version`. See section 7.
- `spec.sha256` is the SHA-256, in lowercase hex, of the bytes of the root OpenAPI document the
  guides were generated from, with no normalization. The portal compares it with the spec it is
  publishing and reports `spec-hash-mismatch` (a warning) when they differ. A bundle is pinned to
  one spec document; the portal holds one bundle per spec version.
- `generatedAt` is optional. A generator may leave it out to make output byte-identical.
- `nav` is the single source of ordering and grouping. A group at the top level of `nav` is at depth
  1; a group inside it is at depth 2. A group at depth 4 or deeper is `nav-depth`. Pages may appear
  at the top level or inside any group. The portal checks nav depth while it parses the manifest,
  and stops at the first group that is too deep; it does not build the tree first.
- A `page` value is the file path under `pages/` without the `.md` extension. It is the page's
  **slug**. The portal builds the page's URL from it; the URL itself is the portal's.
- Guides are served under a prefix reserved for them. No slug can therefore collide with one of
  the portal's own routes, and a generator may use any slug the path rules in section 2 allow.
- Every page file must appear in `nav` exactly once. A nav entry with no file is `missing-page`. A
  file under `pages/` with no nav entry is `unlisted-page`. A slug that appears twice is
  `duplicate-page`.
- `hidden: true` keeps a page out of the sidebar. The page is still published and linkable.
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

- It must be valid JSON whose top level is an object with no duplicate keys.
- The only top-level keys are `path`, `query`, `headers` and `body`. All four are optional. A
  generator includes only the keys that have values; an absent key means no values of that kind.
  `{}` is valid and means a request with no values, which is not the same as form 1.
- `path`, `query` and `headers` are objects that map a parameter name to its value. Path and query
  names are case-sensitive. Header names are compared case-insensitively.
- `body` is the request body as JSON. For a JSON media type it is sent as is. For
  `application/x-www-form-urlencoded` and `multipart/form-data` it is an object whose members the
  portal serializes as form fields. For a `text/*` media type it is a JSON string. A binary body
  cannot be expressed in 0.2.
- Any violation of the rules in this list is `invalid-sample`.

**Merging forms 2 and 3.** The named example supplies its values first. Inline `path`, `query` and
`headers` are then added one parameter at a time, and an inline value replaces the example's value
for the same parameter. If the named example supplies a request body and the inline block has a
`body` key, the sample is `invalid-sample`: there is exactly one source for the body.

**Validation of values.** For forms 2, 3 and 4 the portal validates the merged values against the
operation. Nothing is filled in from defaults except credentials.

| Condition | Result |
|---|---|
| A value does not match its parameter's schema, or `body` does not match the request body schema of the sample media type | `invalid-sample` |
| A required parameter or a required request body has no value | `invalid-sample` |
| A `path` name is not a parameter in the operation's path template | `invalid-sample` |
| A `body` is given and the operation has no request body | `invalid-sample` |
| A `query` or `headers` name is not a declared parameter of the operation | `undeclared-parameter`, a **warning**. The value is sent as written, unless a row below applies. |
| A `headers` name is one the portal controls, listed below, whether or not the operation declares it | `invalid-sample` |
| A `headers` or `query` name is one that a security scheme in the spec uses to carry a credential | `invalid-sample` |
| A `headers` name is not an RFC 9110 `token`, or a header value contains CR, LF or NUL | `invalid-sample` |

A declared parameter is one listed on the operation or on its path item, after references are
resolved. A string value that contains a variable is exempt from schema validation, as 4.6 defines.

**Headers the portal controls.** Names are compared case-insensitively.

- These names: `Authorization`, `Cookie`, `Host`, `Content-Type`, `Content-Length`,
  `Transfer-Encoding`, `Connection`, `Forwarded`, `X-Real-IP`, `Via`, `TE`, `Trailer`, `Upgrade`,
  `Keep-Alive`, `Expect`, `Origin`, `Referer`, `X-HTTP-Method`, `X-HTTP-Method-Override`,
  `X-Method-Override`.
- Every name that begins with `X-Forwarded-`, `Proxy-` (which covers `Proxy-Authorization`) or
  `Sec-`.
- Every name that begins with the portal's internal prefix, `X-Ezdp-`.

**Header syntax.** Header names match the RFC 9110 `token`; values contain no CR, LF or NUL;
otherwise `invalid-sample`. Checked again after substitution: the bundle check sees the value as
written, with JSON escapes decoded, and the portal repeats the check on the final value once
variables have been filled in (4.6). A value that fails then is not sent.

**This table is a bundle check, not a security control.** The proxy and MCP enforce the same rules
on every request, server-side, from the published model: destination only from the model's servers
(server variables limited to their `enum`, or `[A-Za-z0-9.-]+`), subject to the URL policy in
ADR 0003; final method and path must match an operation the tenant enabled. A request that never
passed through a bundle validator, such as a direct call to the proxy, meets the same rules.

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
- A name must not be one of the built-in variables in 4.6, must not be `api_key`, and must not be
  captured more than once on the same page.
- A violation of the grammar or of these rules is `invalid-capture`.
- The path is evaluated against the JSON response body when the reader runs the sample. A captured
  value is a string, number or boolean of at most 2,048 characters, read by own-property lookup;
  otherwise nothing is captured. For a number or boolean the length is that of its JSON text. An
  object, an array, `null`, a missing member, an inherited member and a longer value all capture
  nothing, and the name stays unfilled exactly as if the sample had not been run.
- The captured value keeps its JSON type. The path is not checked against the response schema in
  0.2.
- A captured name is in scope from the end of its `<Sample>` to the end of the page. It is not
  available on other pages.

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

**External links.** An external destination is parsed with the WHATWG URL parser and must have the
scheme `https`, a host, no userinfo and no control characters. One that does not parse, or breaks
any of these, is `link-not-allowed`. The portal renders an external link with
`rel="noopener noreferrer nofollow ugc"`. Whether the target exists is not checked.

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

`<Step>` and `<Tab>` titles and footnotes have no anchors in 0.2.

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
| captured names | The value captured by an earlier `<Sample>` on the same page (4.3) | the JSON type of the captured value |

`{{api_key}}` is not available to bundles; anywhere in a bundle it is `unknown-variable`.
Credentials are placed only by the portal's sample generator, from the operation's security
requirements, so a generator needs no variable to authenticate a sample. The name cannot be
captured either (4.3). "Anywhere" means each of the three places below where variables are
recognised; in the places where no variable is recognised, the same characters are literal text,
as for any other name, and nothing ever fills them in (item 6 below).

**Where variables are recognised.** In exactly three places:

1. Prose text, including headings, list items and table cells.
2. The content of ordinary code blocks, fenced or indented.
3. String values in a `<Sample>` inline block.

Everywhere else `{{name}}` is literal text: code spans, link destinations and titles, image sources
and alt text, component attributes, code block info strings, frontmatter, object keys in a
`<Sample>` block, the manifest and `report.json`.

**Unknown variables.** In the three places above, every unescaped `{{` must begin a well-formed
variable whose name is a built-in or a captured name in scope. Anything else is `unknown-variable`:
an unknown name, a captured name used before its `<Sample>` or on another page, or a `{{` that is
not followed by a name and `}}`.

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
  `^[A-Za-z0-9._:~-]{1,256}$`; otherwise the placeholder stays. The test is applied to the value's
  text, which for a number or boolean is its JSON text.
- Every runtime substitution into a sample or request goes through the target language's encoder
  and the parameter location's encoder (path segment: `/ ? # %` encoded, `.` and `..` rejected).
  String replacement into emitted code does not conform. A value its location rejects is not
  substituted: the placeholder stays, and no request is sent with it.
- A header value is checked again after substitution (4.3).
- In prose a value is inserted as text and nothing else.

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
5. Values that are specific to the reader (the selected `base_url`, `idempotency_key`, captured
   values, and the credentials the sample generator places) are filled in in the reader's browser.
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
<Todo title="How credentials are issued">

The spec does not say how a developer obtains an API key. Add the steps here.

</Todo>
```

Both are **visible in preview and block publishing**:

- A page whose `status` is `draft` or `review` is reported as `page-not-ready`.
- Each `<Todo>` is reported as `todo-present`.

These two codes have the severity `blocker` (section 5). A bundle whose only findings are blockers
and warnings is valid: the portal stages it and shows it in preview, with each `<Todo>` rendered as
a clearly marked placeholder. It cannot be published until a new bundle arrives without them. A
`<Todo>` therefore never appears in a published page, a Markdown twin, `llms.txt`, the search index
or the docs MCP.

`draft` and `review` block publishing equally. The difference is information for people.

The portal never edits a bundle, so a `<Todo>` is resolved by producing a new bundle.

## 5. Validation

The portal validates every bundle before staging it and returns a machine-readable report.

```json
{
  "contractVersion": "0.2",
  "ok": true,
  "publishable": false,
  "findings": [
    {
      "code": "todo-present",
      "severity": "blocker",
      "file": "pages/quickstart.md",
      "line": 18,
      "message": "This page has a <Todo> that must be resolved before publishing."
    }
  ]
}
```

| Severity | Meaning |
|---|---|
| `error` | The bundle is invalid. It is not staged and cannot be previewed. |
| `blocker` | The bundle is valid and is staged for preview. It cannot be published. |
| `warning` | Nothing is blocked. |

- `ok` is true when there is no finding of severity `error`.
- `publishable` is true when there is no finding of severity `error` or `blocker`.
- `file` is relative to the bundle root. `line` is 1-based and is omitted when a finding is about a
  whole file or the whole bundle. `message` is for people and is not part of the contract.
- The portal reports every finding it can, not only the first.

### 5.1 Codes

The codes and their severities are part of the contract. A generator's own validator uses the same
names for the same conditions.

**Errors**

| Code | Condition |
|---|---|
| `missing-manifest` | No `guides.json` at the bundle root. |
| `invalid-manifest` | `guides.json` is not JSON or fails the schema. |
| `unsupported-contract-version` | `contractVersion` is not one the portal accepts. |
| `missing-page` | A nav entry names a page with no file. |
| `unlisted-page` | A file under `pages/` is not in `nav`. |
| `duplicate-page` | A slug appears in `nav` more than once. |
| `nav-depth` | A group is nested deeper than depth 3. |
| `unexpected-file` | A file, directory or link that the layout in section 2 does not allow. |
| `invalid-path` | A path breaks the character or length rules. |
| `invalid-encoding` | Not UTF-8, or has a byte order mark, CR line endings or NUL. |
| `size-limit` | A size or count limit in section 2 is exceeded, including the limits on `guides.json` and on frontmatter. |
| `nesting-limit` | Markdown nesting deeper than 32. See 4.1. |
| `asset-type` | An asset's extension is not allowed, or its content does not match it. |
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
| `unknown-anchor` | A `guide:` anchor that the target page does not have. |
| `unknown-asset` | An `asset:` path that is not in the bundle. |
| `unknown-response` | A `<Response>` status the operation does not define. |
| `unknown-example` | An `example` name that selects nothing. |
| `link-not-allowed` | A link or image destination in a form 4.5 does not allow, an external link that fails the checks in 4.5, or a target that is not valid UTF-8 once decoded. |
| `invalid-sample` | See 4.3. |
| `invalid-capture` | See 4.3. |
| `invalid-code-info` | A code block info string that breaks 4.4. |

**Blockers**

| Code | Condition |
|---|---|
| `todo-present` | A `<Todo>` is present. One finding per `<Todo>`. |
| `page-not-ready` | A page's `status` is `draft` or `review`. |

**Warnings**

| Code | Condition |
|---|---|
| `spec-hash-mismatch` | `spec.sha256` differs from the spec being published. |
| `deprecated-operation` | A sample, operation card or link targets a deprecated operation. |
| `image-missing-alt` | An image has empty alt text. |
| `page-unreferenced` | A page of type `quickstart`, `how-to` or `tutorial` has no `operations`. Pages of type `concept` and `reference` are exempt. |
| `api-request-code` | An ordinary code block contains `{{base_url}}`. See 4.4. |
| `undeclared-parameter` | A sample sends a header or query parameter the operation does not declare. |
| `invalid-report` | `report.json` is present but is not JSON or fails its schema. The report is ignored. |

**Generator-side only**

| Code | Condition |
|---|---|
| `unsupported-syntax` | Never reported by the portal. A generator's pre-flight validator may use it for input the contract allows but that validator cannot check. |

### 5.2 The run report: `report.json`

Optional, at the bundle root. It carries what the generator wants a person to know about the run:
pages it skipped, things the spec did not say, problems it found in the spec. The portal may show
it to the customer in the dashboard. It is never published, never affects validation of the rest of
the bundle, and its text is shown as plain text.

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
    { "pointer": "/paths/~1pets/get", "message": "No operationId." }
  ]
}
```

- Every top-level member is optional. `pages[].page` is a slug; for a skipped page no file exists.
- `placeholderValues: true` means sample values on that page were built from types because the spec
  had no examples.
- `pointer` is a JSON Pointer into the spec document.
- Members the schema does not define are allowed anywhere and are ignored by the portal. A
  generator may keep its own detail there.
- `pages`, `gaps` and `specProblems` hold at most 1,000 items each, and a slug is at most 197
  characters, the longest a page path allows. These are in the schema.
- A report that is not JSON, or that fails the schema, is `invalid-report`, a warning.

## 6. Delivery

**The directory layout in section 2 is the contract.** A generator's obligation ends when it has
written a conforming bundle directory. It does not upload, archive or push anything.

How that directory reaches the portal is the portal's concern and will be settled in milestone M5.
The candidates are an upload of an archive of the directory, and ingestion from a directory in a
connected Git repository. Neither changes the layout, and neither is part of 0.2.

What is fixed now:

- A valid bundle is staged, not published. Publishing is a separate step.
- Publishing is atomic. A bundle replaces the previous one as a whole, and a failed bundle leaves
  the live portal unchanged.
- Whatever the transport, the step that extracts or reads the bundle enforces the section 2 limits
  on actual bytes, as it reads them and not from sizes an archive declares, and rejects links,
  absolute paths and `..`. It stops at the first limit it passes.
- That step belongs to the control plane. The validator is a pure function of file contents and
  cannot see a symbolic link, so the control plane makes that check and reports it as
  `unexpected-file`.
- An archive used for transport is not an asset. A `zip` under `assets/` is never unpacked
  (section 2).

## 7. Versioning

- `contractVersion` is `major.minor`.
- **While the major version is 0, any minor version may change or remove things**, and a portal
  accepts exactly one version. A portal implementing this document accepts `0.2` only. 0.2 differs
  from 0.1 in ways that would otherwise need a major version; see section 10.
- From 1.0: minor versions only add optional fields, components, attributes, variables and codes.
  Major versions may remove or change. The portal supports the previous major for at least 6 months
  and rejects a bundle whose major version it does not support.

## 8. Questions from v0.1, answered

| Question | Answer |
|---|---|
| Content the contract cannot express | A marker for incomplete content was needed and is added (4.7). Diagrams, video and widgets are not in 0.2. A `mermaid` block is shown as code. Rendering diagrams is a candidate for a later version and needs a security review first. |
| More than one spec version per guide | No. A bundle is pinned to one spec document by hash. The portal holds one bundle per spec version. |
| Localization | Out of scope. If it comes into scope, it will be one bundle per locale, not a locale dimension in the layout. |
| Disabling "Try it" per sample | Yes: `tryIt="false"` (4.3). |

Still open, and not blocking 0.2:

1. Transport (section 6), for M5.
2. Capturing a value whose key is not a plain identifier, such as `user-id`. The path grammar in 4.3
   cannot express it.
3. Linking to a webhook's documentation. There is no link form for it.

## 9. What the portal must handle

Facts about real bundles from the guides module, and duties this contract puts on the portal's
engine and renderer. They are here so they are written down on the portal side.

**Engine**

- Implement the operation id algorithm in 1.1 exactly, and expose for each operation its id and
  whether the id was derived. Every other part uses the engine's ids. If the two projects differ,
  every link and sample for a spec without `operationId`s fails.
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
  substitution rule in 4.6. A captured value is a scalar within the limits in 4.6.
- Every value that reaches generated code, from a bundle, a spec or a captured response, is data.
  The sample generator must encode it for the target language, including shell quoting, so that a
  value cannot change the meaning of the code a reader copies. This holds for a value filled in at
  run time in the browser exactly as for one known at publish time: it goes through the same
  language encoder and location encoder (4.6). Replacing a placeholder string inside emitted code
  does not conform.
- Enforce the parser limits while parsing: frontmatter size and plain-YAML checks on the token
  stream, manifest size and nav depth, and the Markdown nesting cap (sections 2 to 4).
- Bundle validation is a pure function of the bundle's file contents and the normalized model. The
  control plane does the reading and unpacking, and the checks in section 6 that a pure function
  cannot make.
- Sample values built from types (`"email": "string"`) pass the schema but are not realistic. 85 of
  Stripe's 120 generated pages have them. The bundle marks them only in `report.json`.

**Renderer**

- Follow the order of operations in 4.6. It is a security requirement.
- Do not enable GFM autolink literals. Text taken from spec descriptions contains bare `http://` URLs.
- Substitute reader-specific variables in the browser, into placeholders only. Published pages are
  static and carry no `{{` marker text for client code to find (4.6, item 6).
- Render `<Todo>` in preview only.
- Guide slugs are chosen by the generator and include fixed names such as `authentication`, `errors`,
  `pagination`, `idempotency`, `rate-limits` and `webhooks`. That is why section 3 reserves a prefix
  for guides.
- Prefix every `id` derived from a heading (4.5), and render external links with the `rel` value
  in 4.5.
- Build every `asset:` URL as an absolute URL on the tenant's asset origin (section 2). Asset URLs
  do not go through the portal's base path.
- The guides module sanitizes spec text before writing it into a page. The portal must not rely on
  that. Every page is untrusted input.
- Scale seen so far: 120 pages from a spec with 612 operations, and 25 pages from one with 908.

**Control plane, proxy and MCP**

- The proxy and MCP enforce the header, destination, method and path rules in 4.3 on every request,
  server-side, from the published model. The bundle validator is not in the path of a direct call.
- Extraction enforces the section 2 limits on actual bytes and rejects links, absolute paths and
  `..` (section 6).
- Publishing a bundle runs under the same per-tenant worker and time limit as publishing a spec
  (ADR 0003).
- Serve assets from a dedicated per-tenant asset origin with the headers in section 2.

**What the asset origin means for hosting.** Two product decisions are affected. Neither changes.

- *Subpath hosting.* Pages under `host.com/docs` stay same-origin with the customer's site, which
  is the point of that mode: the customer's licensed fonts still load. Guide assets do not come
  through the customer's reverse proxy. They load cross-origin from an origin we host, so that an
  asset opened directly cannot run in the customer's origin and the customer's proxy cannot strip
  its headers. The customer has nothing to route, but a customer whose site sends a
  `Content-Security-Policy` must allow the asset origin in `img-src`, and onboarding has to say so.
- *Static export.* Core pages still need no per-request server logic. An exported portal is no
  longer self-contained when its guides have assets: the exported pages point at the asset origin.
  Whoever hosts an export either keeps using the asset origin we host or runs a second origin that
  sends the same headers. Copying `assets/` into the export beside the pages does not conform.
- The naming and isolation of the asset origin are designed with custom domains (M5 and M6) and
  go to the security reviewer.

**Not exercised by the guides module today**, so the portal needs its own fixtures for them:
`<Tabs>`, assets and images, `label` and `hidden` in nav, pages of type `reference`, multiple
`capture` pairs, percent-encoded link targets, `guide:` links with anchors, form 4 of `<Sample>`,
`status` and `<Todo>`.

No bundle has yet been through a portal validator. The first real ingestion is a test of both
validators.

## 10. Changes in 0.2

Added:

- `status` in frontmatter, the `<Todo>` component, and the `blocker` severity (4.7, 5).
- `tryIt` on `<Sample>` (4.3).
- A named example combined with inline values (4.3).
- Optional `report.json` and its schema (5.2).
- The full list of codes (5.1).
- The operation id algorithm with a collision rule (1.1).
- The heading anchor algorithm and `unknown-anchor` (4.5).
- Percent-encoding in link targets, so any operation id can be linked (4.5).
- The order of operations for variables (4.6).
- New codes: `unlisted-page`, `invalid-tag-placement`, `unknown-anchor`, `nesting-limit`,
  `todo-present`, `page-not-ready`, `undeclared-parameter`, `invalid-report`.

Changed:

- The validation report: `errors` is renamed `findings`; `publishable` and `contractVersion` are added.
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
- Delivery: the upload endpoint and Git ingestion are no longer proposed here. Transport moves to M5.
- Versioning: 0.x minors may break; the portal accepts exactly one 0.x version.

Required by the security design review of 2026-11-26, and made before 0.2 was released:

- `{{api_key}}` is removed. It is not available to bundles, is `unknown-variable` wherever variables
  are recognised, and cannot be a captured name. Credentials are placed only by the portal's sample
  generator (4.6, 4.3).
- Published output carries variables as structure, never as marker text. Text from the spec never
  contains a variable (4.6, item 6).
- A captured value is a string, number or boolean of at most 2,048 characters. It is substituted
  into an ordinary code block only if it matches `^[A-Za-z0-9._:~-]{1,256}$`, and into a sample or
  request only through the language and location encoders (4.3, 4.6).
- The escape for a literal `{{` in a `<Sample>` string is written out: `\u007b` (4.6). The earlier
  draft lost the escape sequence.
- Header names must be RFC 9110 tokens and values must not contain CR, LF or NUL (4.3).
- The list of headers a sample cannot set is longer: forwarding, hop-by-hop and method-override
  headers, `Origin`, `Referer`, `Expect`, every `Proxy-*` and `Sec-*` name, and the portal's
  internal prefix `X-Ezdp-` (4.3).
- The sample checks are stated to be a bundle check. The proxy and MCP enforce the same rules
  server-side (4.3).
- Assets are served from a dedicated per-tenant asset origin with fixed response headers. SVG
  sanitizing is an allowlist. A zip is never unpacked (2).
- Limits: `guides.json` is at most 1 MB and frontmatter at most 16 KB; duplicate frontmatter keys
  are `invalid-frontmatter`; Markdown nesting is capped at 32, with the new code `nesting-limit`;
  `report.json` arrays hold at most 1,000 items (2, 3, 4, 4.1, 5.2).
- External links are parsed with the WHATWG URL parser and must be `https` with a host, no userinfo
  and no control characters (4.5).
- A link target that is not valid UTF-8 after percent-decoding is `link-not-allowed` (4.5).
- Guides are served under a reserved prefix. This was a note to the renderer and is now a rule (3).
- A heading anchor is not the HTML `id`; the portal prefixes ids (4.5).
- Extraction enforces the limits on actual bytes and rejects links, absolute paths and `..` (6).

## 11. Decisions on the v0.1 feedback

Numbers are those in [`guides-contract-feedback.md`](./guides-contract-feedback.md).
**Confirmed** means the contract now says what the guides module assumed or proposed. **Changed**
means it says something different, and a generator built on the assumption needs to change.
**Rejected** means the proposal or assumption does not hold.

### Proposals

| # | Proposal | Decision | The contract now says |
|---|---|---|---|
| 1 | Marker for incomplete content | Confirmed | Frontmatter `status: draft\|review\|ready`, default `ready`, and `<Todo title="…">`. Both show in preview and block publishing, as `page-not-ready` and `todo-present`, severity `blocker`. (4.7) |
| 2 | `tryIt` on `<Sample>` | Confirmed | `tryIt="true"\|"false"`, default `true`. `false` is binding on the portal. `true` is a request; the portal may still withhold "Try it". (4.3) |
| 3 | Named example with inline values | Confirmed, with a rule for `body` | `example` and an inline block may be combined. Inline `path`, `query` and `headers` are merged per parameter and win over the example. A `body` from both is `invalid-sample`. (4.3) |
| 4 | Exempt `concept` pages from `page-unreferenced` | Confirmed, and extended | The warning applies only to `quickstart`, `how-to` and `tutorial` pages with no `operations`. `concept` and `reference` are exempt. (5.1) |
| 5 | Publish the full list of codes | Confirmed | The list in 5.1. All of the module's names are kept. `api-request-code` becomes a warning, `unsupported-syntax` is generator-side only, and eight codes are added. |
| 6 | A place for the run report | Confirmed | Optional `report.json` at the bundle root, with a minimum shape and a schema; extra members are allowed and ignored. An invalid report is the warning `invalid-report`. (5.2) |

### Assumptions

| # | Topic | Decision | The contract now says |
|---|---|---|---|
| 1 | `<Sample>` with no inputs | Confirmed, and extended | `<Sample operation="x" />` is valid for any operation and renders the operation's default sample, the one on its reference page. (4.3, form 1) |
| 2 | What `example` names | Changed: made exact | Key `N` in the `examples` map of a request body media type (sample media type first, then document order), together with the `examples` entry `N` of every path, query and header parameter that has one. At least one must exist, or `unknown-example`. (4.3) |
| 3 | Variables and schema validation | Confirmed, and made exact; limits added | A JSON string that is exactly one variable is replaced by the value with its own JSON type. A variable inside a longer string is interpolation. Any string containing a variable is exempt from schema validation. A captured value is a string, number or boolean of at most 2,048 characters, and reaches a sample or request only through the language and location encoders; a value its location rejects leaves the placeholder in place. `{{api_key}}` is not a bundle variable. (4.6) |
| 4 | `capture` syntax | Changed | Pairs are separated by exactly one space. Commas are not accepted. Names match `[a-z][a-z0-9_]*`; paths use `$`, `.member` and `[index]` only. A name may be captured once per page and may not be a built-in or `api_key`. Only a string, number or boolean of at most 2,048 characters is captured. (4.3) |
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
| 15 | Unknown header in a sample | Changed | An undeclared header or query parameter is the warning `undeclared-parameter` and is sent, unless it is one of the following, which are `invalid-sample`: a header the portal controls, declared or not (the list in 4.3, which includes forwarding, hop-by-hop and method-override headers, `Proxy-*`, `Sec-*` and `X-Ezdp-*`); a name that carries a credential; a header name that is not an RFC 9110 token; a header value with CR, LF or NUL. An unknown `path` name is `invalid-sample`. These are bundle checks; the proxy and MCP enforce the same rules server-side on every request. (4.3) |
| 16 | OpenAPI 3.2 | Confirmed | The contract covers 3.0 and 3.1. A 3.2 document is read as 3.1; 3.2-only constructs are ignored and cannot be referenced. (1.1) |
| 17 | Bare URLs in prose | Confirmed, and tightened | GFM autolink literals are off: a bare URL is text. Angle-bracket autolinks are `disallowed-syntax`. The module does not need to break URLs up. (4.1) |
| 18 | Entities | Confirmed, and extended, as a requirement on the portal | A variable exists only where its braces are literal characters in the source. Braces from character references, backslash escapes or JSON `\u` escapes are text. Substitution is a single pass and its output is never parsed again. Published output carries variables as structure, never as marker text; client-side substitution fills only those placeholders and never searches text or code for `{{`; text taken from the spec never contains a variable. The feedback's example, `{{api_key}}`, is no longer a variable at all. (4.6) |
