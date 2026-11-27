# Security Design Review: Allowed-hosts Fix and the Published Spec

Date: 2026-11-27. Reviewer: `security-reviewer` agent. Reviewed at commit `be7dfe2`, following
[`2026-11-26-security-design-re-review.md`](./2026-11-26-security-design-re-review.md).

A document review. The only thing run was the two host regexes in ADR 0004 against Node 22's WHATWG
`URL`.

## Verdict: pass with required fixes

Nothing blocks M1 once F1 and the M1 items under "The published spec" are in the text.

## Rulings

**1. Contract 4.3 definition of the tenant-listed set: sound.** It narrows R1: there is no set
outside the spec, and the proxy vets every request. Add: "An empty `enum` allows no value."

**2. `bindFix` list inputs: acceptable.** The exception is decided by the engine-produced fix, not
the client. Add to ADR 0004:

- "A `list` input must declare a `format`."
- "Splitting is on LF only; a value containing CR or any other control character fails."
- "`pointer` and `firstPointer` address only the `value` of an `add` op in that fix's own patch."
- "The format check is input hygiene, not a security control; the proxy's parsing and address
  vetting are the control."

**3. Overwriting `default`: acceptable.** The `test` on the whole variable object makes it safe.
Required: the fix's title or label says the first value becomes the default, since that is where
"Try it" sends by default.

**4. Host regexes and the cap of 32: acceptable, no bypass found.**

- Rejected as intended: IPv4 forms (`127.0.0.1`, `0x7f.1`, `1.2.3.0x4`), a trailing dot, upper
  case, a trailing LF, and single labels under `host-name`.
- Internal names: `a.localhost`, `metadata.google.internal` and `127.0.0.1.nip.io` are admitted,
  and `host-suffix` admits `localhost` and `com`. ADR 0004 and ADR 0003 say address vetting refuses
  these and the connection is pinned to the vetted address.
- Punycode: invalid forms (`xn--a.com`, `a.xn--0`) are admitted, but the parser rejects them, so
  they fail closed.
- Normalisation: no admitted value was normalised to a different host.
- Recommended: the caller parses `https://<value>/` at accept time and refuses to store a value
  whose parsed host differs.

**5. A spec-authored `enum` is not syntax-checked: acceptable.** The tenant already controls its
servers, so there is no exploit. Recommended invariant: "After substitution, the parsed host must
equal the host built by position, lower-cased; otherwise the request is not sent." This stops an
`enum` value containing `/`, `?`, `#`, `\` or `:` from moving a boundary that the position rules for
other variables rely on.

**6. Gap confirmed (F1, medium), in the reviewer's own R1 wording.** `https://{x}example.com` is
callable as written and reaches `evilexample.com`. `https://{x}.github.io` and `https://{x}.co.uk`
are callable and reach a host anyone can register. A prompt-injected agent can use either to send
the user's key there. Replace the host clause in contract 4.3, ADR 0003 and ADR 0005 with:

> "With no `enum`, a variable in the host is callable only if: (a) its value matches
> `[A-Za-z0-9_-]{1,63}` and the label it sits in is at most 63 characters; (b) that label is
> followed by `.` and then literal text to the end of the host, with no variable in it; (c) that
> literal text is not an IP address and is not a public suffix under the Public Suffix List, ICANN
> and private sections, so it contains a registrable domain. Any other host variable needs an
> `enum`, or the server is not callable. The list is a pinned snapshot shipped as data."

- `api-{x}.example.com` and `{x}.example.com` stay callable.
- `{x}example.com`, `{x}.co.uk` and `{x}.github.io` become `server-not-callable`. No fix is offered
  for them, which is acceptable.
- ADR 0004's definition of that finding needs the same change.
- Residual, accepted: shared-hosting domains not on the list, and a tenant's own user-content
  subdomains.
- A public-suffix dependency needs a provenance check.

## The published spec

- **M1, written into a static directory: acceptable by default with two additions.** The CLI prints
  that the file is public and holds the whole root document, including comments and `x-` fields. A
  flag omits it.
- **No stripping.** It would break the byte-for-byte rule and give false assurance.
- **Hosted, to be recorded in ADR 0003 now and built in M4:** "Public download of the published
  spec is the tenant's explicit choice and is off by default. The guides module fetches it over an
  authenticated path. If any feature hides part of the spec from the portal, the public file is not
  served."
- **Origin and headers:** "The hosted portal serves it only from the per-tenant asset origin, never
  the page origin, with `Content-Type` fixed by the file name (`application/json` or
  `application/yaml`, `charset=utf-8`), `nosniff`, `Content-Disposition: attachment`,
  `Content-Security-Policy: default-src 'none'; sandbox`, and no CORS headers." This matches the
  brief's rule for JSON, and under subpath hosting headers cannot be guaranteed through the
  customer's reverse proxy.
- **Static export:** the host must send `nosniff`.

## Notes

- `model.json` already carries `extensions` (ADR 0002). If it is publicly fetchable, `x-` fields
  are exposed regardless of the published spec. Check this at M4.
- External `$ref` URLs stay as written in the published file and may reveal internal hostnames.

## Not verified

- Browser and non-Node URL parsers.
- Public Suffix List coverage.
- Browser handling of YAML content types.
- Anything in M2 to M6, which is not designed yet.
