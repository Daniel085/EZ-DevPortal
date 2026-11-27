# ADR 0005: Code samples and the request representation

Status: accepted, 2026-11-26. Milestone: M1, with M2 and M5 consumers. Revised the same day to
apply the security design review (`docs/reviews/2026-11-26-security-design-review.md`, H1, H2,
H3, M6). The re-review (`docs/reviews/2026-11-26-security-design-re-review.md`) passed it
subject to required fixes: R1, R3, R5, the encoder rule and the MCP note. They are applied in this
text. The M1 language list was also changed from three to the eight in `docs/milestones/m1.md`.
Revised 2026-11-27 for the product decision on allowed hosts: the tenant-listed set under "Server
variables" is the variable's `enum` after the spec doctor's fix (ADR 0004).
Revised again that day to apply the security review of that fix
(`docs/reviews/2026-11-27-security-review-allowed-hosts-and-published-spec.md`): the host clause
under "Server variables" is replaced (F1), an empty `enum` allows no value, and the parsed host
must equal the host built by position.
Revised again that day for the user's decision to split the MCP's `call` tool into a read tool
and a write tool (ADR 0003, "MCP tools: reads and writes"). `CallValues` is unchanged and is the
input shape of both.
Revised again that day for the user's decisions on live calls: the consequences below point to
the one rule in ADR 0003 for when "Try it" sends. No type or function is changed.
Revised again that day to close gaps a readiness audit found: "What an M1 sample shows" makes
the base URL agree with criterion 15, `buildRequest` reports where each value came from, and
"The local mock" says how tests run samples without calling a real API.
Revised again that day to close gaps a second audit found: `HttpRequest.basicAuth` and "Basic
authentication" say how a Basic credential is carried and emitted; the local mock has a fixed
port and names `selectResponseExample`. "Basic authentication" goes to the security reviewer
with the emitters.

## Context

M1 renders samples in several languages on every reference page. M2's "Try it" and the MCP's two
call tools send real requests for the same operations with caller-supplied values. M5's guides
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

type CallValues = Omit<RequestValues, 'templates'>; // the proxy and MCP input shape, the same
                                                    // for both MCP call tools; it has no method

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
  baseUrl: Text;                                    // the chosen server's URL as literal text; a
                                                    // `base_url` Var only where the spec gives no
                                                    // absolute URL. See "What an M1 sample shows".
  path: Text;                                       // serialized and percent-encoded
  query: { name: string; value: Text }[];
  headers: { name: string; value: Text }[];         // includes auth and Content-Type, except
                                                    // Basic auth, which is in `basicAuth`
  basicAuth?: { username: Var; password: Var };     // http basic. See "Basic authentication".
  body?: | { kind: 'json'; value: JsonText }
         | { kind: 'form'; fields: { name: string; value: Text }[] }
         | { kind: 'multipart'; parts: { name: string; value: Text; filename?: string; contentType?: string }[] }
         | { kind: 'text'; text: Text; contentType: string }
         | { kind: 'binary'; filename: string };
}

type SampleLanguage = 'curl' | 'javascript' | 'python' | 'go' | 'java' | 'csharp' | 'php' | 'ruby';
interface Sample { language: SampleLanguage; label: string; code: (string | Var)[]; highlight: string }
```

Rules:

- `buildRequest` fills anything the caller did not supply, in this order: named example, schema
  `examples`, `default`, first `enum` value, then `synthesizeExample` (deterministic, recursion cut
  on the second visit to a schema, and bounded by the node and byte budgets in `Limits`, ADR 0003).
  Over budget, the value is truncated and a finding goes into `issues`. Only required parameters
  are filled when nothing is supplied. A declared request body is always included, required or
  not, in the media type that contract 4.3's sample rule picks. `buildRequest` also returns
  `values`, one `SampleValue` for each value it filled, saying which of these places it came
  from (ADR 0003, "The portal bundle"; criterion 7).
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
- **Server variables.** A value comes from the variable's `enum`. An empty `enum` allows no
  value. With no `enum`: a variable in the port is `[0-9]{1,5}`; in the path, `[A-Za-z0-9._~-]+`
  segments joined by `/`, none `.` or `..`. With no `enum`, a variable in the host is callable
  only if: (a) its value matches `[A-Za-z0-9_-]{1,63}` and the label it sits in is at most 63
  characters; (b) that label is followed by `.` and then literal text to the end of the host,
  with no variable in it; (c) that literal text is not an IP address and is not a public suffix
  under the Public Suffix List, ICANN and private sections, so it contains a registrable domain.
  Any other host variable needs an `enum`, or the server is not callable. The list is a pinned
  snapshot shipped as data; the caller passes it to the engine (ADR 0004, "The Public Suffix
  List", which also has worked examples). The substituted URL is then parsed and vetted.
  Position is read from the server URL as the spec writes it; a variable in the scheme,
  userinfo, query or fragment makes the server not callable. The engine does the position
  check and the substitution, and reports `server-not-callable` (ADR 0004). Parsing the result
  and vetting the address are the caller's, under ADR 0003. After substitution, the parsed host
  must equal the host built by position, lower-cased; otherwise the request is not sent. In M2
  `resolveRequest` returns that host with the URL: the host part of the server URL as written,
  with the values placed, lower-cased, without the port. The proxy compares it with the host its
  URL parser reports. A server with a variable and a literal host that the parser would rewrite,
  such as a non-ASCII name, is therefore never sent to; the tenant writes the `xn--` form.
  **Decided 2026-11-27:** there is no set of allowed values outside the spec, and no caller
  passes one in. The tenant lists the values by accepting the spec doctor's fix on
  `server-not-callable`, which adds them as the variable's `enum` in the patched spec (ADR 0004).
  The engine reads that `enum` from the model. A server with an open host variable, such as
  `https://{host}/v1` with no `enum`, is reported `server-not-callable` until the fix is accepted
  or the source spec gains an `enum`. The finding and the fix are M1; the proxy enforces the
  rule in M2. A verified domain suffix, for hosts that cannot be listed, is planned for M4b and
  not designed here; it would be a second way to meet this rule and needs its own security
  review (ADR 0004).
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

### Basic authentication

An `http` scheme whose `scheme` is `basic`, compared without regard to ASCII case. The header
value is the Base64 of `username:password`, which `Text` cannot express and must not: an
encoded credential in literal text would be marker text by another name.

- `buildRequest` sets `basicAuth` to the two credential variables, `username` and `password`,
  both with `scope: 'credential'` and the scheme's id. It adds no `Authorization` header to
  `headers`. The security statement is unchanged: header `Authorization`, prefix `Basic `
  (ADR 0003).
- Each emitter gives the pair to its client, or calls the language's own Base64 at run time.
  No emitter writes an encoded value, and the engine encodes nothing in M1.

  | Language | How the pair is written |
  |---|---|
  | `curl` | `-u 'YOUR_USERNAME:YOUR_PASSWORD'` |
  | `javascript` | Header `Authorization`: `'Basic ' + btoa('YOUR_USERNAME:YOUR_PASSWORD')` |
  | `python` | `auth=('YOUR_USERNAME', 'YOUR_PASSWORD')` |
  | `go` | `req.SetBasicAuth("YOUR_USERNAME", "YOUR_PASSWORD")` |
  | `java` | Header `Authorization`: `"Basic " + Base64.getEncoder().encodeToString("YOUR_USERNAME:YOUR_PASSWORD".getBytes(StandardCharsets.UTF_8))` |
  | `csharp` | `new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes("YOUR_USERNAME:YOUR_PASSWORD")))` |
  | `php` | `CURLOPT_USERPWD => 'YOUR_USERNAME:YOUR_PASSWORD'` |
  | `ruby` | `request.basic_auth('YOUR_USERNAME', 'YOUR_PASSWORD')` |

  Where the two share one string literal, each is still its own `Var` segment in
  `Sample.code`, with the `:` between them a literal part.
- On the wire every sample sends `Authorization: Basic WU9VUl9VU0VSTkFNRTpZT1VSX1BBU1NXT1JE`,
  the Base64 of `YOUR_USERNAME:YOUR_PASSWORD`. That is the hand-written expected header of the
  matrix's Basic row (criterion 14), and what the local mock accepts for Museum.
- In M2 `resolveRequest` builds the header from the two real values with our own Base64 of
  their UTF-8 bytes, and refuses a username that contains `:`.
- Where two schemes of one requirement would both set `Authorization`, the first in the
  requirement's order is placed and the other is reported in `issues` as `request-invalid`
  (ADR 0004).

### What an M1 sample shows

A static M1 sample is `renderSample` of `buildRequest(model, id, undefined, { limits })`. No server is
chosen, so (criterion 15):

- **Base URL.** The first of the operation's effective servers (`Operation.servers[0]`, ADR
  0002), written as literal text with each variable replaced by its `default`. A variable with
  no `default` takes its first `enum` value; with neither, its `{name}` stays as written, and
  the doctor has already reported it.
- **No absolute URL.** If there is no server, or the first one's URL is relative, `baseUrl` is
  the `base_url` variable followed by the relative URL, if any. This is the only case in which
  a static sample has a `base_url` variable.
- **Display text.** M1 has no client code that fills a variable, so every variable is shown as
  fixed text, the same in the page, the copied code and the twin: `YOUR_` and the name in upper
  case for a credential (`YOUR_API_KEY`, `YOUR_ACCESS_TOKEN`, `YOUR_USERNAME`,
  `YOUR_PASSWORD`), and `https://YOUR_API_HOST` for `base_url`.
- A sample is a complete program that runs as copied. The display text is what it sends until
  the reader replaces it, and no sample or page has a field that accepts a real credential.

### The local mock

For criteria 14, 18 and 25. It is test code under the publisher's tests, never shipped, and it
adds no dependency: Node's `http` module.

- **Samples reach it through the spec, not through an option.** A test build uses an overlay
  with one hand-written patch that replaces the first server's `url` with
  `http://127.0.0.1:14010` and the server's base path. The overlay file is its owner's to edit
  (ADR 0004, "The overlay file", which shows this overlay), so this is the ordinary publish path, and the samples of that build use the first
  declared server as criterion 15 says. A build without that overlay is what readers see and is
  unchanged. The matrix of criterion 14 is a fixture of QA's whose server is the mock already.
- **The port is fixed: 14010.** The matrix fixture is a committed spec and the overlays are
  committed files, so both must know the address before any test runs. If the port is taken
  the mock fails to start and the test fails; there is no second port, because a sample built
  for one address must never be run against another. Tests that use the mock run one at a
  time.
- **It is built from the same patched spec** and may use these engine functions and no others:
  `parseDocument`, `applyFixes`, `buildModel`, `getOperation`, `validateValue`,
  `synthesizeExample` and `selectResponseExample` (ADR 0003). All are built by step 2 of ADR
  0003, "Build order in M1", so the mock is written after that step. It matches a request to an
  operation by method and path template and records the method, URL, headers and body bytes it
  received.
- **It accepts a request** when the operation exists, every required parameter is present, the
  credential's display text is where the security scheme puts it, and a JSON body has no
  `errors` under `validateValue`. For Basic the credential is the header of "Basic
  authentication". It answers with what `selectResponseExample(model, id)` returns: that
  status when it is an exact 2xx code, else 200; the example's value as the body, else a
  value from `synthesizeExample` for that media type's schema, else no body. Otherwise it
  answers 400 with the reason.
- **Expected values are written by hand.** For criterion 14 the expected method, URL, headers
  and body of each matrix row are in the fixture. They are not taken from `buildRequest` or
  `HttpRequest`, or a serialization bug would agree with itself.
- **It never calls a real API.** It listens on `127.0.0.1` only and makes no outbound request.
  Before running any sample the harness checks that the sample's base URL is the mock's, and
  fails otherwise, so a sample that still points at a real server is never run.

Alternative rejected: an option on `buildRequest` or the CLI that overrides the base URL for
tests. It is a second way to choose a destination, which every later reader of the proxy rules
would have to rule out, and samples built with it would no longer show the first declared
server.

## Consequences

- Guides `<Sample>` (M5) is `buildRequest` with the block's values. Captured variables are `Var`
  parts with `scope: 'captured'`. Validation of supplied values against the schema is added to
  `issues` then, with the `validateValue` that M1 builds (ADR 0003).
- "Try it" and MCP send exactly the request the sample shows, because both come from one
  `HttpRequest`. A serialization bug is fixed once.
- In example-response mode "Try it" builds the same `HttpRequest` and shows it, and sends
  nothing. When the console is live and when it is in that mode is one rule, in ADR 0003,
  "Live calls and example-response mode"; it is not restated here. The example shown as the result is
  chosen from the operation and a status alone. It does not depend on the request or on any
  value the reader entered, so nothing in `RequestValues` selects or alters it. The `example`
  key of `RequestValues` names a request example and has no part in it.
- The proxy and MCP do not trust that request. They enforce the rules of contract 4.3 on every
  request, server-side, from the published model: destination only from the model's servers, with
  server variables limited as "Server variables" above says, subject to the proxy destination
  policy in ADR 0003; final method and path must match an operation the tenant enabled; the
  controlled-header list applies. The client-side checks are for the reader's benefit only.
- The proxy sends to `https` servers only. A sample is still rendered for an `http://` or
  localhost server, because a sample is text; live calls are withheld for it (ADR 0003, "Live
  calls and example-response mode") with the `server-not-callable` finding (ADR 0004).
- Both MCP call tools, the read tool and the write tool, reject a parameter the operation does
  not declare. This is an M2 requirement. The `undeclared-parameter` warning of contract 4.3
  applies to guide samples and does not loosen it.
- `CallValues` is the input shape of both call tools, with an operation id beside it. It carries
  no method and no choice of tool: the method comes from the operation in the published model,
  so no value a caller sends can change whether an operation is a read or a write. Which tool an
  operation belongs to, the tenant's write-only override, the refusal of a call to the wrong
  tool and the rule that writes are off until the tenant enables each one are in ADR 0003, "MCP
  tools: reads and writes".
- Eight emitters mean eight sets of string-escaping rules, each a place where a hostile value
  could break out of a literal. Each emitter's encoder is tested with hostile values and goes to
  the security reviewer.
- The page file carries samples as segment lists. The renderer turns each `Var` into a placeholder
  element (ADR 0006). Markdown twins and `llms.txt` show a fixed display text for each variable
  and are never substituted.
- The MCP `describe` tool can return `CallValues`, which is `RequestValues` without `templates`, as
  the input shape of both call tools instead of inventing one.

## Alternative rejected

Per-language templates filled straight from the model. Each template would re-implement
serialization and escaping, and nothing would be left for "Try it" or MCP to reuse. Also rejected:
`httpsnippet` (MIT). Its input is HAR, which has no notion of a variable or placeholder, and it
brings Node-oriented dependencies (`form-data`, `event-stream`, `yargs`, `chalk`) into a package
that must stay pure and run in a browser. Eight emitters are more code than the three first
planned, but the two reasons above do not depend on the count.
