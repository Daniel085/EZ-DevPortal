# Guides Bundle Contract

Status: **draft v0.1**, proposed by the portal side. Not yet agreed with the guides module.

This is the interface between two projects:

- **Guides module** (separate project): takes an OpenAPI spec and produces developer guides.
- **EZ-DevPortal** (this project): renders the API reference, code samples, theme and hosting, and
  ingests the guides.

The guides module produces a **guides bundle**. The portal validates it, renders it, and never edits it.

## 1. Division of responsibility

| Concern | Owner |
|---|---|
| Guide prose, structure, ordering, which operations a guide covers | Guides module |
| API reference pages, schema rendering | Portal |
| API request code samples in every language | Portal |
| Theme, layout, navigation chrome, search, `llms.txt`, Markdown twins | Portal |
| Resolving links to operations, schemas and other guides | Portal |
| Substituting the reader's API key and base URL | Portal |

The rule that follows from this table: **a guide never contains hand-written API request code.** It
names an operation and the values to send, and the portal renders the sample in every language. This
keeps guides in step with the reader's language choice and with the samples the portal tests.

## 2. Bundle layout

```
guides/
  guides.json          manifest (required)
  pages/               one file per guide, .md
    quickstart.md
    payments/accept-a-payment.md
  assets/              images and downloadable files (optional)
    payments/flow.png
```

- Encoding is UTF-8, line endings LF.
- File paths are lowercase, `a-z 0-9 - /` only.
- Maximum 2 MB per page, 5 MB per asset, 200 MB per bundle.
- Allowed asset types: `png`, `jpg`, `webp`, `gif`, `svg`, `pdf`, `json`, `zip`. SVG is sanitized by
  the portal.

## 3. Manifest: `guides.json`

The JSON Schema is in [`guides-manifest.schema.json`](./guides-manifest.schema.json).

```json
{
  "contractVersion": "0.1",
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
        { "page": "payments/refunds" }
      ]
    }
  ]
}
```

- `spec.sha256` is the hash of the exact OpenAPI document the guides were generated from. The portal
  compares it with the spec it is publishing and warns when they differ. This is how drift is caught.
- `nav` is the single source of ordering and grouping. Groups nest to a maximum depth of 3.
- Every page file must appear in `nav` exactly once. A page that should not appear in the sidebar
  sets `hidden: true` on its nav entry.
- A `page` value is the file path under `pages/` without the extension. It is also the URL slug.

## 4. Page format

Each page is Markdown with YAML frontmatter.

```markdown
---
title: Accept a payment
description: Create a payment, confirm it, and handle the result.
type: how-to
operations: [createPayment, confirmPayment]
---
```

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Plain text, max 80 characters. Rendered as the page `h1`. |
| `description` | yes | Plain text, max 200 characters. Used for search, SEO and `llms.txt`. |
| `type` | yes | `quickstart`, `concept`, `how-to`, `tutorial` or `reference` |
| `operations` | no | `operationId`s the guide covers. The portal links back from each reference page. |
| `tags` | no | Free-form strings for search filtering. |

The body must not contain an `h1`. Headings start at `h2`.

### 4.1 Markdown dialect

CommonMark plus GitHub-flavored tables, task lists, strikethrough and footnotes.

**Not allowed:** raw HTML, `import`/`export`, JSX expressions (`{…}`), `<script>`, `<style>`,
`<iframe>`, inline event handlers.

The reason is tenant isolation. The portal is multi-tenant and treats guide content as data. It
parses pages into a syntax tree and renders only known nodes. Nothing in a bundle is ever executed.

### 4.2 Components

A closed set of components is available, written as tags with literal string, number or boolean
attributes. Unknown tags or attributes fail validation.

| Component | Purpose |
|---|---|
| `<Callout type="note\|tip\|warning\|danger" title="…">` | Highlighted aside |
| `<Steps>` / `<Step title="…">` | Numbered procedure |
| `<Tabs>` / `<Tab title="…">` | Alternative content, for example per platform |
| `<CardGroup cols="2">` / `<Card title="…" href="…">` | Link cards |
| `<Operation id="createPayment" />` | Summary card for an endpoint, linked to its reference page |
| `<Schema ref="Payment" />` | Inline rendering of a schema from the spec |
| `<Sample operation="createPayment">` | Multi-language request sample, see 4.3 |
| `<Response operation="createPayment" status="201" />` | Example response from the spec |

### 4.3 API samples

`<Sample>` tells the portal which operation to call and with what values. The portal generates the
code for each language, applies the reader's language choice, and can offer "Try it".

Use a named example from the spec:

```markdown
<Sample operation="createPayment" example="card-payment" />
```

Or supply values inline, as a single fenced `json` block:

````markdown
<Sample operation="createPayment" title="Create a 20.00 USD payment">
```json
{
  "path": {},
  "query": {},
  "headers": { "Idempotency-Key": "{{idempotency_key}}" },
  "body": { "amount": 2000, "currency": "usd" }
}
```
</Sample>
````

Inline values are validated against the operation's schema. A mismatch is a validation error.

To carry a value from one step into the next, name it with `capture` and reuse it as a variable:

```markdown
<Sample operation="createPayment" example="card-payment" capture="payment_id=$.id" />
<Sample operation="confirmPayment">
```

`capture` takes `name=JSONPath` pairs evaluated against the response. Captured names are available
as `{{name}}` in later samples on the same page.

### 4.4 Ordinary code blocks

Fenced code blocks are allowed for anything that is not an API request: install commands,
configuration, webhook handler code, expected output.

````markdown
```bash title="Install the CLI"
npm install -g acme-cli
```
````

The info string is a language identifier, then optional `title="…"` and `highlight="2,4-6"`.

### 4.5 Links

| Form | Resolves to |
|---|---|
| `[text](op:createPayment)` | The operation's reference page |
| `[text](schema:Payment)` | The schema's reference entry |
| `[text](guide:payments/refunds)` | Another guide. `#anchor` may be appended. |
| `[text](asset:payments/flow.png)` | A file under `assets/`. Also valid as an image source. |
| `[text](https://…)` | External link. Only `https` is allowed. |

Relative and absolute path links are not allowed. The portal owns URL structure and may change it.

### 4.6 Variables

Written as `{{name}}` in prose, code blocks and sample values.

| Variable | Value |
|---|---|
| `{{base_url}}` | The server URL selected by the reader |
| `{{api_key}}` | The signed-in reader's test key, or a placeholder |
| `{{idempotency_key}}` | A generated UUID |
| `{{api_name}}` | The API title from the spec |
| captured names | See 4.3 |

Unknown variables fail validation. A literal `{{` is written `\{{`.

## 5. Validation

The portal validates every bundle before publishing and returns a machine-readable report.

```json
{
  "ok": false,
  "errors": [
    {
      "code": "unknown-operation",
      "severity": "error",
      "file": "pages/payments/refunds.md",
      "line": 42,
      "message": "Operation 'refundPayment' is not in the spec."
    }
  ]
}
```

**Errors** block publishing: schema-invalid manifest, missing or duplicate page, unknown component,
attribute, variable or link target, disallowed syntax, sample values that fail the operation schema,
size limits exceeded.

**Warnings** do not block: `spec.sha256` differs from the published spec, operation is deprecated,
image without alt text, page not referenced by any operation.

The error codes are part of the contract. New codes may be added in a minor version.

## 6. Delivery

Proposed, and the least settled part of this document:

- **Upload:** `PUT /v1/projects/{projectId}/guides` with a `.tar.gz` of the bundle directory. The
  response is the validation report. A valid bundle is staged, not published.
- **Git:** the bundle lives in a directory of a connected repository and is ingested on push.

Publishing is atomic. A bundle replaces the previous one as a whole, and a failed bundle leaves the
live portal unchanged.

## 7. Versioning

- `contractVersion` is `major.minor`.
- Minor versions only add: new optional fields, components, variables, error codes.
- Major versions may remove or change. The portal supports the previous major for at least 6 months.
- The portal rejects a bundle whose major version it does not support.

## 8. Open questions

1. Does the guides module need content that this contract cannot express, such as diagrams
   (Mermaid), embedded video, or interactive widgets?
2. Should a guide be able to target more than one spec version?
3. Is localization in scope for the guides module? If so the layout needs a locale dimension.
4. Should the guides module be able to request "Try it" be disabled for a specific sample, for
   example destructive operations?
