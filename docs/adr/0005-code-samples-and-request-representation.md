# ADR 0005: Code samples and the request representation

Status: accepted, 2026-11-26. Milestone: M1, with M2 and M5 consumers. Revised the same day to
apply the security design review (`docs/reviews/2026-11-26-security-design-review.md`, H1, H2,
H3, M6). The re-review (`docs/reviews/2026-11-26-security-design-re-review.md`) passed it
subject to required fixes: R1, R3, R5, the encoder rule and the MCP note. They are applied in this
text. The M1 language list was also changed from three to the eight in `docs/milestones/m1.md`.

## Context

M1 renders samples in several languages on every reference page. M2's "Try it" and MCP `call`
tool send real requests for the same operations with caller-supplied values. M5's guides
`<Sample>` names an operation and values and expects the portal to render every language. All of
them need the same hard part done once: parameter serialization (`style`, `explode`), path and
query encoding, body encoding and placing credentials.

## Decision

Two steps, with an intermediate request representation between them.

```
ApiModel + operationId + RequestValues  --buildRequest-->  HttpRequest  --renderSample-->  code
                                                               |
                                              M2: resolveRequest(vars) --> proxy sends it
```

```ts
interface RequestValues {                 // same keys as the guides contract's inline block
  path?: Record<string, Json>; query?: Record<string, Json>;
  headers?: Record<string, Json>; cookies?: Record<string, Json>; body?: Json;
  example?: string;                       // a named example from the spec; explicit keys override it
  contentType?: string;
  server?: { index: number; variables?: Record<string, string> };   // each value: in the variable's
                                                                    // enum, or valid for its position
                                                                    // in the URL. See "Server variables".
  security?: string[];                    // scheme ids to apply; default: first requirement
  templates?: { pointer: string; text: Text }[];   // string leaves that hold variables, by JSON
                                                   // Pointer into this object, under /path, /query,
                                                   // /headers, /cookies or /body only.
}

type CallValues = Omit<RequestValues, 'templates'>; // the proxy and MCP input shape

interface Var {
  var: string;                                      // 'base_url', 'payment_id', 'api_key'
  scope: 'builtin' | 'captured' | 'credential';     // three namespaces; a name never crosses them
  scheme?: string;                                  // credential scope only: the security scheme id
  encode: Encoder[];                                // applied in order when a value is filled in
}
type Encoder = string;                              // an id from a closed list the engine exports:
                                                    // one per parameter location, one per language context

type Text = (string | Var)[];                       // literal parts and variables, as structure

type JsonText =                                     // a JSON body whose string leaves are Text
  | null | boolean | number
  | { string: Text }
  | { array: JsonText[] }
  | { object: { key: string; value: JsonText }[] }; // keys are literal; entries, not a keyed object

interface HttpRequest {
  operationId: string; method: string;
  baseUrl: Text;                                    // [{ var: 'base_url', ... }] unless a server is chosen
  path: Text;                                       // serialized and percent-encoded
  query: { name: string; value: Text }[];
  headers: { name: string; value: Text }[];         // includes auth and Content-Type
  body?: | { kind: 'json'; value: JsonText }
         | { kind: 'form'; fields: { name: string; value: Text }[] }
         | { kind: 'multipart'; parts: { name: string; value: Text; filename?: string; contentType?: string }[] }
         | { kind: 'text'; text: Text; contentType: string }
         | { kind: 'binary'; filename: string };
}

interface Sample { language: SampleLanguage; label: string; code: (string | Var)[]; highlight: string }
```

Rules:

- `buildRequest` fills anything the caller did not supply, in this order: named example, schema
  `examples`, `default`, first `enum` value, then `synthesizeExample` (deterministic, recursion cut
  on the second visit to a schema, and bounded by the node and byte budgets in `Limits`, ADR 0003).
  Over budget, the value is truncated and a finding goes into `issues`. Only required parameters
  are filled when nothing is supplied.
- **Variables are structure, never marker text.** A variable is a `Var` part and nothing else. No
  engine function searches a string for `{{`, and no emitter writes `{{name}}` for a later step to
  find. A string that came from the spec (an example, a default, an enum value, a description) is
  a literal part whatever characters it holds, so text taken from the spec never contains a
  variable. A spec example `https://attacker.example/?k={{api_key}}` is those characters, in the
  request and in every sample.
- A caller that needs a variable in a value says so out of band, in `RequestValues.templates`. The
  only caller that does is the guides validator (M5), which finds variables from source positions
  as contract 4.6 requires and passes the parsed `Text`. A JSON string that is exactly one
  variable is a `{ string: [Var] }` leaf, which is how the typed substitution in contract 4.6 is
  recognised.
- `templates` pointers may target only `/path`, `/query`, `/headers`, `/cookies` and `/body`. The
  proxy and MCP input shape excludes `templates` and rejects it. So a template can never reach
  `server`, `security`, `contentType` or `example`; `buildRequest` reports a pointer anywhere else
  as an error in `issues` and does not apply it. "Try it" and MCP callers pass `CallValues`, plain
  values, and can never introduce a variable; a request to the proxy or MCP that carries
  `templates` is refused, not stripped.
- Credentials are always variables with `scope: 'credential'`, placed by `buildRequest` according
  to the security scheme and by nothing else. Their names come from a closed list the engine
  exports as `credentialVariableNames`: `api_key`, `access_token`, `username` and `password`.
  Where one request carries two credentials of the same kind, the name repeats and `Var.scheme`
  tells them apart, so the list stays closed. `templates` may not name a credential variable, and
  a captured name can never fill one, because the scopes are separate. A captured name must not be
  a credential variable name; the engine exports the closed list (contract 4.3), which removes
  the confusion by name as well as by scope.
  The engine never sees a real credential in M1. In M2 the real value is supplied per request to
  `resolveRequest`, a pure function, and is not stored anywhere.
- **Server variables.** A value comes from the variable's `enum`. With no `enum`: a variable in
  the host is one label, `[A-Za-z0-9_-]{1,63}`; in the port, `[0-9]{1,5}`; in the path,
  `[A-Za-z0-9._~-]+` segments joined by `/`, none `.` or `..`. A variable that forms or follows
  the last label of the host needs an `enum` or a tenant-listed set, or the server is not
  callable. The substituted URL is then parsed and vetted. Position is read from the server URL
  as the spec writes it; a variable in the scheme, userinfo, query or fragment makes the server
  not callable. The engine does the position check and the substitution, and reports
  `server-not-callable` (ADR 0004). Parsing the result and vetting the address are the caller's,
  under ADR 0003. A tenant-listed set is tenant configuration the caller passes in; where it is
  stored is M4's design.
- Variables being first-class lets each language decide how to show one (an environment variable
  in curl, a named constant in Python) and lets "Try it" substitute real values.
- One emitter per language: a function `(request: HttpRequest) => (string | Var)[]` written by
  hand, with its own string and shell escaping. Every value is escaped for the target language; a
  spec value must not be able to break out of a quoted string in copied code. Each emitter is
  tested on the fixture corpus with hostile values.
- **Runtime substitution is encoding, not string replacement.** Every runtime substitution into a
  sample or request goes through the target language's encoder and the parameter location's
  encoder (path segment: `/ ? # %` encoded, `.` and `..` rejected). String replacement into
  emitted code does not conform. Escaping done at publish time acts on a placeholder and protects
  nothing once a value is filled in later, so each `Var` carries the encoders for its position, and
  the engine exports them as pure functions. The browser fills a placeholder with the encoded
  value. An encoder may refuse a value; the placeholder then stays and no request is sent with it.
- An unknown encoder id means the placeholder is not filled. A typed scalar is written by JSON
  serialization: a captured number, boolean or string that fills a `{ string: [Var] }` leaf goes
  through the JSON serializer and then the encoders, never into the body as its own text.
- A runtime value is a string, number or boolean of at most 2,048 characters (contract 4.6).
  Header names match the RFC 9110 `token` and header values contain no CR, LF or NUL; `buildRequest`
  reports a violation in `issues`, and `resolveRequest` checks again after substitution.
- Emitters target an HTTP client that needs no generated SDK: the language's standard library,
  or its most conventional client where the standard library is not what people reach for. M1 has
  eight emitters, the list in `docs/milestones/m1.md`. Each emitter is one function, and adding a
  language is adding one function and its string encoder.

  | Language | `SampleLanguage` | Client the emitter targets | Kind |
  |---|---|---|---|
  | cURL | `curl` | The `curl` command line, quoted for a POSIX shell | The tool itself |
  | JavaScript | `javascript` | `fetch` | Built into browsers and Node 18 and later |
  | Python | `python` | `requests` | Third-party; the conventional client |
  | Go | `go` | `net/http` | Standard library |
  | Java | `java` | `java.net.http.HttpClient` | Standard library, Java 11 and later |
  | C# | `csharp` | `System.Net.Http.HttpClient` | Standard library |
  | PHP | `php` | The cURL extension, `curl_*` | Bundled with PHP; no Composer package |
  | Ruby | `ruby` | `Net::HTTP` | Standard library |

  Python is the one emitter that targets a package outside the standard library. `requests` is
  what Python readers expect and what the milestone names; `urllib.request` is the alternative if
  running a sample with nothing installed matters more. For PHP the cURL extension was chosen over
  Guzzle, which needs Composer. No emitter adds a dependency to the engine: a client is something
  the emitted text mentions, not something the engine imports.
- Samples are generated at publish time for every language and stored in the page file
  (ADR 0003). Switching language in the browser needs no server and no engine code. Filling in a
  runtime value (M2, M5) needs the engine's encoders in the browser and nothing else from it.
- Syntax highlighting is not the engine's job. It returns code and a language id (ADR 0006).

## Consequences

- Guides `<Sample>` (M5) is `buildRequest` with the block's values. Captured variables are `Var`
  parts with `scope: 'captured'`. Validation of supplied values against the schema is added to
  `issues` then.
- "Try it" and MCP send exactly the request the sample shows, because both come from one
  `HttpRequest`. A serialization bug is fixed once.
- The proxy and MCP do not trust that request. They enforce the rules of contract 4.3 on every
  request, server-side, from the published model: destination only from the model's servers, with
  server variables limited as "Server variables" above says, subject to the proxy destination
  policy in ADR 0003; final method and path must match an operation the tenant enabled; the
  controlled-header list applies. The client-side checks are for the reader's benefit only.
- The proxy sends to `https` servers only. A sample is still rendered for an `http://` or
  localhost server, because a sample is text; "Try it" and MCP are withheld for it with the
  `server-not-callable` finding (ADR 0004).
- MCP `call` rejects a parameter the operation does not declare. This is an M2 requirement. The
  `undeclared-parameter` warning of contract 4.3 applies to guide samples and does not loosen it.
- Eight emitters mean eight sets of string-escaping rules, each a place where a hostile value
  could break out of a literal. Each emitter's encoder is tested with hostile values and goes to
  the security reviewer.
- The page file carries samples as segment lists. The renderer turns each `Var` into a placeholder
  element (ADR 0006). Markdown twins and `llms.txt` show a fixed display text for each variable
  and are never substituted.
- The MCP `describe` tool can return `CallValues`, which is `RequestValues` without `templates`, as
  its input shape instead of inventing one.

## Alternative rejected

Per-language templates filled straight from the model. Each template would re-implement
serialization and escaping, and nothing would be left for "Try it" or MCP to reuse. Also rejected:
`httpsnippet` (MIT). Its input is HAR, which has no notion of a variable or placeholder, and it
brings Node-oriented dependencies (`form-data`, `event-stream`, `yargs`, `chalk`) into a package
that must stay pure and run in a browser. Eight emitters are more code than the three first
planned, but the two reasons above do not depend on the count.
