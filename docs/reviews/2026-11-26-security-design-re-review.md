# Security Design Re-review: Guides Contract v0.2 and M1 ADRs

Date: 2026-11-26. Reviewer: `security-reviewer` agent. Reviewed at commit `6f678b4`, against the
original review in [`2026-11-26-security-design-review.md`](./2026-11-26-security-design-review.md).

A document review. Nothing was reproduced.

## Verdict: pass with required fixes

All ten findings and five notes are closed in the text. No confirmed high remains. Contract 0.2 can
go to the guides module once R3 to R6 and rulings 7 and 10 are in. ADRs 0003 and 0005 can be
accepted once R1, R2 and ruling 7 are in. R1 and R4 correct wording the reviewer supplied in the
original review.

## Part 1: status of the original findings

| Item | Status | Checked |
|---|---|---|
| H1 | Closed | Contract 4.6, 4.3, 9; ADR 0005 `JsonText`, `Sample.code`; brief |
| H2 | Closed (see R4) | Contract 4.3 capture, 4.6 "Runtime values", header syntax; ADR 0005 |
| H3 | Closed (see R1) | Contract 4.3 list and "bundle check" paragraph; ADR 0005 consequences |
| H4 | Closed for spec fetch (see R2 for the proxy) | ADR 0003 "URL policy" |
| M5 | Closed, untested | Contract 2, 9; ADR 0006 |
| M6 | Closed | ADR 0003 "Budgets", worker; ADR 0005; ADR 0006 highlighting |
| M7 | Closed (loosen per ruling 7) | ADR 0003, 0004; contract 4.3 |
| L8 | Closed | Contract 2, 3, 4, 4.1; both schemas |
| L9 | Closed | Contract 4.5; ADR 0006 |
| L10 | Closed | ADR 0006 theme |
| Notes 1-4 | Closed | Contract 3, 4.5, 6; ADR 0006 |
| Note 5 | Nothing was required | |

## Part 2: rulings on the architect's objections

1. **`{{api_key}}` "anywhere" scoped to where variables are recognised: accept as written.**
   Literal text that nothing fills is safe; item 6 of 4.6 is the control.
2. **Credential pass-through: confirmed, with a change.** Split ADR 0003 into three parts: "Address
   vetting" (shared), "Spec fetch policy" and "Proxy destination policy". Proxy wording: "The portal
   sends none of its own credentials or cookies. The end user's credential is sent only to a
   destination built from the model's servers. The proxy does not follow redirects; a 3xx is
   returned to the caller."
3. **`https` only for the proxy: objection rejected.** Keep `https` only. The hosted proxy cannot
   reach localhost under address vetting anyway, and plain `http` puts the user's key on the wire in
   clear. Samples still render; "Try it" and MCP are withheld with the existing spec-doctor finding.
   A direct browser-to-localhost mode is a separate design and needs its own review.
4. **Spec fetching: accept, with one narrowing.** "A relative `$ref` in an uploaded spec resolves
   only against other files of the same upload, by lookup; it is never fetched." Tokens for private
   URLs and Git sync need their own reviewed path.
5. **Server variables: accept with a change** (R1). Validate by position, which allows ports, base
   paths and `_`.
6. **Controlled headers apply even when declared: accept as written.** Add: an operation that
   requires a controlled header gets a spec-doctor finding and "Try it" is withheld.
7. **Pointer segments: ban only `__proto__`.** The original wording was broader than needed.
   Replace with: "Reads use `Object.hasOwn` or a `Map`; writes use `Object.defineProperty` or a
   `Map`, never assignment with a tenant key. A `__proto__` segment is a conflict. `constructor` and
   `prototype` are ordinary names. A test resolves and patches through all three and asserts
   `Object.prototype` is unchanged."
8. **Code-block allowlist: accept as written; do not widen.** An ordinary code block has no encoder,
   so the allowlist is the only control. `/` with `.` gives `../`. `<Sample>` still takes the full
   value.
9. **Asset origin: sound as far as known; not verified.** Browsers ignore `Content-Disposition` and
   document CSP for `<img>` subresource loads. Required: a browser test in Chrome, Firefox and
   Safari as an M5 acceptance test. Add `Cross-Origin-Resource-Policy: cross-origin`. For svg, use
   `default-src 'none'; style-src 'unsafe-inline'; sandbox`. Narrower option for export and customer
   CSP: png, jpg, webp and gif, re-encoded by the portal, may be served on the page origin with
   `nosniff`. svg, pdf, json and zip always use the asset origin.
10. **URL parsing across languages: accept with a change.** Make the generator's check a regex:
    "The destination matches
    `^https://[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?(:[0-9]{1,5})?([/?#][\x21-\x7E]*)?$` and has no
    `\`. The portal also parses it with the WHATWG parser and rejects it if the parsed host differs."

### Items the architect invented

- **`X-Ezdp-`:** confirmed. Add that the proxy strips it from inbound requests.
- **`nesting-limit`:** confirmed.
- **`api_key` not capturable:** change per R5.
- **`Var`, `JsonText`:** confirmed. Add: an unknown encoder id means the placeholder is not filled;
  a typed scalar is written by JSON serialization.
- **`templates`:** change per R3.
- **`Limits`, `defaultLimits`, `{ result, findings }`, `budget-exceeded`:** confirmed.
- **`bindFix`:** confirmed. Add a 2,048-character cap per input.
- **Highlight caps:** confirmed.

## New required fixes

- **R1 (medium).** Contract 4.3 and ADR 0005: `[A-Za-z0-9.-]+` lets a server `https://{host}/`
  point anywhere. A prompt-injected agent could send the user's key to an attacker host. Replace
  with: "With no `enum`: a variable in the host is one label, `[A-Za-z0-9_-]{1,63}`; in the port,
  `[0-9]{1,5}`; in the path, `[A-Za-z0-9._~-]+` segments joined by `/`, none `.` or `..`. A variable
  that forms or follows the last label of the host needs an `enum` or a tenant-listed set, or the
  server is not callable. The substituted URL is then parsed and vetted."
- **R2 (medium).** ADR 0003 applies "redirect rules as written" to the proxy and defers what happens
  to the credential. Use the ruling 2 wording.
- **R3 (medium).** ADR 0005: `templates` pointers may target only `/path`, `/query`, `/headers`,
  `/cookies` and `/body`. The proxy and MCP input shape excludes `templates` and rejects it.
- **R4 (low).** Contract 4.6: the allowlist permits a leading `-`, which is argument injection
  (`-o.bashrc`). Use `^[A-Za-z0-9_][A-Za-z0-9._:~-]{0,255}$`.
- **R5 (low).** Contract 4.3: `access_token` is still capturable. "A captured name must not be a
  credential variable name; the engine exports the closed list."
- **R6 (low).** Contract 4.3: "A value that fails then is not sent" is ambiguous. Write "the request
  is not sent."

## Notes

- **Address vetting:** prefer "reject any address that is not global unicast, including NAT64 and
  6to4 forms of a blocked IPv4 address".
- **Size caps:** count bytes after content decoding.
- **Bundle JSON:** cap depth at 64, or treat a parser stack overflow as invalid.
- **MCP `call` (M2):** it should reject undeclared parameters.

## Not reviewed or verified

- Browser behaviour in ruling 9 and localhost behaviour in ruling 3.
- `guides-contract-feedback.md`, `guides-module-status.md`, the fixtures and dependency provenance
  (including the eight new GFM packages).
- M2 to M6 internals.
