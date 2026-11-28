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
Revised 2026-11-28 for guides contract 0.3: the closed list of built-in variable names, the
generated values `unique` and `unique_1` to `unique_9`, and portal-supplied parameters. No type
is changed.
Revised again that day to apply the security review of contract 0.3
(`docs/reviews/2026-11-28-security-review-contract-0.3.md`), which accepted all three subject
to fixes: which security requirement places a credential (ruling 3), how a `unique` value is
drawn (ruling 2), and who builds `Cookie` (F4). One type changes: `HttpRequest` gains
`cookies`, and "Cookies" is added. Ruling 3 and F4 change what the M1 sample builder and
emitters produce; "Portal-supplied parameters in M1" says how. The review did not read this
ADR's emitter text, so the cookie encoder goes to the security reviewer with the emitters.
Revised again that day for criterion 33 (text in any script): "Text outside ASCII" is added. It
fixes how a sample writes non-ASCII text (percent-encoded at publish time in the URL and a form
body, in one form; as itself in string literals), refuses non-ASCII header and cookie values
and multipart part names, and never writes a bidi control character as itself in a sample.
"The local mock" gains how a received request is compared with the hand-written one, for
criteria 14 and 33. No type is changed.
Revised again that day for the security review of that text
(`docs/reviews/2026-11-28-security-review-text-outside-ascii.md`), which blocked it on F1 and
F2: rulings A, B and C and findings F1 to F10 are applied in the reviewer's wording. Rules 1, 2
and 3 and "What an M1 sample shows", "Base URL", are revised for that review and await
re-review. Emitter work does not start until the re-review passes.

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
  security?: string[];                    // selects one requirement of the operation by its
                                          // scheme ids; default: the first. See the rule
                                          // "Portal-supplied parameters" below.
  templates?: { pointer: string; text: Text }[];   // string leaves that hold variables, by JSON
                                                   // Pointer into this object, under /path, /query,
                                                   // /headers, /cookies or /body only.
}

type CallValues = Omit<RequestValues, 'templates'>; // the proxy and MCP input shape, the same
                                                    // for both MCP call tools; it has no method

interface Var {
  var: string;                                      // 'base_url', 'unique_1', 'payment_id', 'api_key'
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
                                                    // Basic auth, which is in `basicAuth`.
                                                    // Never holds `Cookie`.
  cookies: { name: string; value: Text }[];         // every cookie of the request. See "Cookies".
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
- **Built-in names are a closed list**, exported as `builtinVariableNames`: `base_url`,
  `idempotency_key`, `api_name`, `unique`, and `unique_1` to `unique_9` (contract 4.6). Each is
  a `Var` with `scope: 'builtin'`. A captured name must not be one of them and must not match
  the reserved pattern `unique(_[0-9]+)?`, which the engine exports as
  `reservedCaptureNamePattern`, so a later built-in of that family cannot collide with a name
  a bundle already captures. Both constants are defined in ADR 0003, "Guides: what M5 adds",
  and are built with the guides validator in M5. M1 uses one built-in, `base_url`.
- **Generated values** (contract 4.6, "Generated values"; M5). `unique` and `unique_1` to
  `unique_9` stand for eight decimal digits, `^[0-9]{8}$`, new for each reader and visit.
  - The engine never produces one. It has no source of randomness, at publish time or in the
    browser, and stays pure. The renderer's client code draws the value and hands it to the
    `Var`'s encoders, as it does a captured value. Each digit is drawn by rejection sampling
    from `crypto.getRandomValues`. If that is unavailable the placeholder keeps its display
    text; `Math.random` is never used. A value is never written to storage, a URL or
    analytics. Published output holds the `Var` and its display text, so it is the same for
    the same input. The client code is the renderer's and is M5 (ADR 0006).
  - Which value a `Var` takes follows from its name alone. `unique` and `idempotency_key` take
    the value of the sample whose segment list holds them; `unique_1` to `unique_9` take the
    page's value for that name. `Var` has no field for it.
  - The value is always a string. A `{ string: [Var] }` leaf that holds one is serialized as a
    JSON string, never as a number.
  - It is exempt from no rule: the encoders, the header check after substitution and the
    code-block allowlist of contract 4.6 apply to it as to any runtime value. By construction
    it passes them.
  - The guides validator accepts `unique` and `idempotency_key` in `templates` only for a
    sample's inline block. In prose and in an ordinary code block they are `unknown-variable`.
- **Portal-supplied parameters** (contract 4.3). A declared parameter that is a controlled
  header, that carries a credential, or that is a cookie is never taken from a bundle and
  never counted as missing by the guides validator. `buildRequest` handles each kind once,
  for every caller, and the spec doctor reports from the same classification (ADR 0004):
  - **Which requirement is in effect.** A credential is placed only for the schemes of the
    one security requirement object in effect for the request: the operation's `security`,
    else the document's; `security: []` means none; where there are alternatives, only the
    one the reader selected. In the model that is one entry of `Operation.security`, which is
    already the effective list (ADR 0002). `RequestValues.security` selects the entry: its
    scheme ids must be exactly those of one entry, and with no `security` the first entry
    is used. Ids that match no entry are an error in `issues`, and then no credential is
    placed at all. No caller can apply a scheme the operation does not name, or a mixture of
    two alternatives.
  - A header, query or cookie name that a security scheme carries its credential in is
    filled only with that scheme's credential `Var`, and only when the scheme is in the
    requirement in effect. The parameter's own `example`, `default` and schema are never
    used for it, required or not, and the name appears in the request once. Where the scheme
    is not in the requirement in effect, nothing is placed under that name. The carriers are
    taken from every scheme in `model.securitySchemes`, used or not (contract 4.3).
  - A header parameter on the controlled list is never filled from the spec, required or
    not. `Accept`, `Content-Type` and `Authorization` are not in the model at all (ADR 0002,
    "Dropped header parameters").
  - A cookie parameter that carries no credential is filled like any other parameter, and
    goes into `cookies` under "Cookies" below.
  - A portal-supplied parameter that is not filled has no entry in `values`: nothing was
    filled, so there is no `SampleValue` for it.
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
  encoder (path segment: every byte outside the unreserved set encoded, which includes
  `/ ? # %`, and `.` and `..` rejected; "Text outside ASCII", rule 1). String replacement into
  emitted code does not conform. Escaping done at publish time acts on a placeholder and protects
  nothing once a value is filled in later, so each `Var` carries the encoders for its position, and
  the engine exports them as pure functions. The browser fills a placeholder with the encoded
  value. An encoder may refuse a value; the placeholder then stays and no request is sent with it.
- An unknown encoder id means the placeholder is not filled. A typed scalar is written by JSON
  serialization: a captured number, boolean or string that fills a `{ string: [Var] }` leaf goes
  through the JSON serializer and then the encoders, never into the body as its own text.
- A runtime value is a string, number or boolean of at most 2,048 characters (contract 4.6).
  Header names match the RFC 9110 `token` and header values contain no CR, LF or NUL; `buildRequest`
  reports a violation in `issues`, and `resolveRequest` checks again after substitution. The
  header value rule is narrowed to printable ASCII by "Text outside ASCII", rule 2.
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

### Cookies

Required by the security review of 2026-11-28 (F4). The portal alone builds `Cookie`, from
the credential cookie and declared non-credential cookies, each through a cookie encoder
(name is a token; value has no `;`, `,`, space, quote or control character). A name equal to
a credential cookie's is never filled from the spec.

- **`HttpRequest.cookies` is the only place a cookie is.** `buildRequest` puts there, in this
  order: each declared `in: cookie` parameter that it fills and that carries no credential,
  in `Operation.parameters` order; then the credential cookie of each `apiKey` scheme with
  `in: cookie` in the requirement in effect, in the requirement's order, with a credential
  `Var` as its value. `headers` never has an entry named `Cookie`, in any letter case.
- **The cookie encoder refuses; it never rewrites.** A name must be an RFC 9110 `token`. A
  value must hold none of `;`, `,`, space, `"`, `'` and no control character. Narrowed on
  2026-11-28 to an allowlist that also refuses non-ASCII text and `\` ("Text outside ASCII",
  rule 2). Cookies have no
  agreed escaping, so a value that fails is not percent-encoded or quoted: the cookie is
  left out, and `buildRequest` reports `request-invalid` in `issues` (ADR 0004). A cookie
  parameter serialized from an array or an object contains `,` and is refused in the same
  way. The encoder is one of the location encoders in the closed list, and a `Var` in a
  cookie value carries it, so a value filled in later meets the same test.
- **A credential cookie's name is taken.** A declared cookie parameter whose name equals a
  credential cookie's is never filled from the spec, whether or not the scheme is in effect
  (the rule for a name that carries a credential, above). A spec example therefore cannot
  shadow the credential or stand in for it.
- **Each emitter writes one `Cookie` header** from the list, through the code it uses for any
  header: the pairs as `name=value`, joined by `; `, in list order. With an empty list it
  writes none. No emitter uses a cookie jar or a client's cookie option, so all eight send
  the same bytes. The emitter table above is otherwise unchanged. One limit is known: a
  browser does not let `fetch` set `Cookie`, so the JavaScript sample sends its cookies when
  run in Node, which is where the tests run it.
- **In M2**, `resolveRequest` runs the encoder on every final cookie value after
  substitution and refuses the request if one fails. The proxy takes no `Cookie` text from a
  caller (ADR 0003, "Proxy destination policy").

Alternative rejected: have `buildRequest` write a `Cookie` entry into `headers` as text. The
pairs would then be marker-free but still text, the proxy would have to parse a header to
check a pair, and "the name appears once" could not be tested on the request's structure.

### Portal-supplied parameters in M1

What the rules above mean for the static sample of an operation, which is
`buildRequest(model, id, undefined, { limits })`. All of this is M1 work.

| The spec declares | The M1 sample shows |
|---|---|
| An `apiKey` scheme in a header, query or cookie, named by the operation's first security requirement, and also a parameter with that location and name | The name once, holding the credential placeholder (`YOUR_API_KEY`). The parameter's example or default is not shown. Doctor: `credential-parameter-redundant`. |
| The same parameter, required or not, where the first requirement does not include the scheme, or the operation has no effective security, or its `security` is `[]` | Nothing under that name. A required one is not filled. Doctor: `credential-parameter-unsecured` when no requirement names the scheme, else `credential-parameter-redundant`. |
| A required header parameter on the controlled list, such as `X-Forwarded-For` | Nothing under that name. Doctor: `controlled-header-required`. |
| A required cookie parameter that carries no credential | One `Cookie` header holding `name=value`, the value from the spec or synthesized, if the cookie encoder accepts it; else no cookie and `request-invalid`. |

- The security statement on the page (ADR 0003) and the sample come from the same placement
  code, so the page states the credential once as well. The parameter stays in the page's
  parameter list, because the spec declares it.
- An M1 static sample uses the first requirement. Selecting another is M2.

### Text outside ASCII

Decided 2026-11-28 for criterion 33. A spec can hold text in any script in a path template, a
parameter's value, a header's value and a body. Until now this ADR did not say how a sample
writes it, and the eight clients disagree. Rules 1 and 3 make every sample send the same bytes
for the same request; rule 2 refuses what clients cannot agree on. Rules 1, 2 and 3 are
**revised for the 2026-11-28 review and accepted by the security re-review of 2026-11-28**
(`docs/reviews/2026-11-28-security-review-text-outside-ascii.md`, rulings A to C, F1 to F10).
The emitters and encoders still go to the security reviewer as code.

1. **The URL and a form body are percent-encoded at publish time, in one form.**
   `buildRequest` writes `HttpRequest.path`, every query name and value, and every field name
   and value of a `form` body as literal text that is already encoded:
   - A value, after its `style` and `explode` serialization: its UTF-8 bytes, with every byte
     outside the RFC 3986 unreserved set `A-Z a-z 0-9 - . _ ~` written `%` and two
     **upper-case** hex digits. A space is `%20`, never `+`, and `+` is `%2B`. The delimiters
     the serialization itself adds (`,` between items, `=` and `&` between pairs, the `.` and
     `;` prefixes of `label` and `matrix`) are written as themselves. `allowReserved` is not
     honoured in M1: a reserved character in a value is encoded. Example: `q` = `שלום עולם`
     is `q=%D7%A9%D7%9C%D7%95%D7%9D%20%D7%A2%D7%95%D7%9C%D7%9D`.
   - The literal text of the path template, and the path of the server URL: each code point
     that is not an RFC 3986 `pchar` or `/` is percent-encoded the same way; a `%` followed by
     two hex digits is kept as written; everything else is kept. So `/مستخدمين/{id}` with
     `id` = `7` is `/%D9%85%D8%B3%D8%AA%D8%AE%D8%AF%D9%85%D9%8A%D9%86/7`.
   - The path-segment, query and form location encoders are this same function, so a value
     filled in later is encoded exactly as a value placed at publish time. It encodes every
     component that comes from the spec or a caller: a value, a parameter or field name, and
     a property name that `form` or `deepObject` serialization makes into a name or puts
     inside `[ ]`. Only the delimiters the serialization adds are written as themselves. A
     string that holds an unpaired surrogate (U+D800 to U+DFFF not part of a pair) is
     refused; it is never replaced, and the encoder never throws on it. The path-segment
     encoder still refuses the values `.` and `..`. In addition, once the path is assembled
     from the template's literal text, the style prefixes and the encoded values,
     `buildRequest`, and `resolveRequest` in M2, refuse the request if any segment into which
     a value was placed is empty, or is `.` or `..` when `%2E` and `%2e` are read as `.`.
     (Revised for the 2026-11-28 review, ruling A, F6, F9, F10; accepted by the security re-review of 2026-11-28. It
     replaces "`/ ? # %` encoded", which it includes.)
   - Each emitter writes the URL, query included, as one string literal, and a form body as
     one string literal with its `Content-Type`. No emitter uses its client's query or form
     builder (`params=`, `URLSearchParams`, `url.Values`, `http_build_query`,
     `URI.encode_www_form`): each would encode the `%` again, they disagree about a space,
     and Go's sorts the keys. That literal still goes through the emitter's string or shell
     encoder like any other text. Percent-encoding does not make it safe: the template's
     literal text keeps RFC 3986 sub-delims as written, so `'`, `$`, `(`, `)`, `!`, `*`, `&`
     and `;` can reach it.
   - The `curl` emitter passes `--globoff`, so a `{name}` left in a server URL, or any
     `{ } [ ]`, is sent as written and not expanded by curl.
2. **Header values, cookie values and part names are printable ASCII, or refused.**
   (Revised for the 2026-11-28 review, ruling B, F4, F7; accepted by the security re-review of 2026-11-28.)
   - A header name must be an RFC 9110 `token`, which is ASCII only, so a non-ASCII header
     name is already refused: the header is left out and `request-invalid` is in `issues`.
   - A header value, from the spec or filled in at run time, holds only HTAB, space and
     U+0021 to U+007E, and does not begin or end with a space or HTAB. Otherwise the header is
     left out and `request-invalid` is in `issues`. It is not percent-encoded, RFC
     8187-encoded or sent as Latin-1. The clients disagree: `fetch` takes code points up to
     U+00FF only and throws above it, Python's `http.client` encodes Latin-1 and raises,
     .NET refuses non-ASCII by default, and Go, PHP and curl send the bytes raw; and an
     encoding the API did not ask for sends a value other than the one the spec declares.
   - A cookie value holds only RFC 6265 `cookie-octet`s (U+0021, U+0023 to U+002B, U+002D to
     U+003A, U+003C to U+005B, U+005D to U+007E) other than `'`. That is the list in
     "Cookies" with non-ASCII text and `\` added to what is refused. A cookie name is a
     `token`. A refused cookie is left out with `request-invalid`, as "Cookies" says.
   - A multipart part's `name` and `filename` follow the header value rule and hold no `"`
     or `\`, and a `name` holds no `=`; otherwise the part is left out with
     `request-invalid`. (`=` is refused because `--form-string 'a=b=c'` sends the name `a`;
     the review recommended it.)
   - A part's `contentType` follows the header value rule and holds no `"` or `\`. A part's
     `filename`, and a binary body's `filename`, are only the name sent in
     `Content-Disposition`. In every language, the file a sample reads from the reader's disk
     is named by fixed display text of ours, `YOUR_FILE_PATH`, and no text from the spec
     names a path that a sample opens.
   - Basic authentication: a `username` or `password` filled in at run time holds only
     U+0020 to U+007E, and a `username` holds no `:`; otherwise `resolveRequest` refuses the
     request.
   - A refusal in `issues` names the parameter, scheme or part, the rule it failed and the
     position of the first character that fails, never the value. A refused credential's
     value appears in no issue, log, error report or trace.
   - `resolveRequest` (M2) applies the same rules after substitution, to a credential too,
     and refuses the request if one fails.
   - A required parameter left out this way makes the request one the API may reject. That
     is the honest result: the spec declared a value no client sends the same way.
   - The guides contract's bundle check (4.3, "Header syntax") still forbids only CR, LF and
     NUL. It is aligned with this rule in the next contract draft, and M5 ingests no guide
     bundle until it is.
3. **In a string literal, text is written as itself, except controls and bidi controls.**
   (Revised for the 2026-11-28 review, ruling C, F1, F2, F3, F5; accepted by the security re-review of 2026-11-28.) Every
   body (JSON, text, a multipart part's content) is sent as its UTF-8 bytes; an emitter whose
   client would pick another encoding converts explicitly (Python sends a text body as
   `data='…'.encode('utf-8')` and a JSON body with `json=`). In the sample's text, each
   code point of tenant text, a JSON key included, is written as itself, in UTF-8, except:
   (a) every code point in General Category Cc (U+0000 to U+001F and U+007F to U+009F, which
   include U+0085, a line terminator in C#), and every character the language's escaping
   writes as an escape, listed under "String literals" below. In `curl`, which has no escape
   inside a single-quoted word, each Cc code point other than LF and HTAB is written with the
   `printf` construct of (b). LF and HTAB are written as themselves inside the quoted word,
   because command substitution drops a trailing LF. In JSON text, in every language, each
   Cc code point and each code point of (b) is written as a `\uXXXX` escape.
   (b) the bidi control characters and the line and paragraph separators, U+061C, U+200E,
   U+200F, U+202A to U+202E, U+2066 to U+2069, U+2028 and U+2029, which are **never written
   as themselves anywhere in a sample**, in a literal. Each is written as an escape made of
   ASCII that the language turns back into that code point:

   | Language | Escape, for U+202E |
   |---|---|
   | `javascript`, `python`, `go`, `java`, `csharp`, `ruby` | `\u202E`: four upper-case hex digits. Go: in an interpreted string literal, never a raw one. Ruby: in a double-quoted string. |
   | `php` | `\u{202E}`, in a double-quoted string, with `$` escaped |
   | `curl` | In JSON body text, the JSON escape `\u202E`. Anywhere else, the single-quoted word is closed and the code point is written as `"$(printf '\342\200\256')"`, its UTF-8 bytes in octal, which POSIX `printf` supports; the command text holds no tenant text. |

   So a sample, and the twin's `## Example request`,
   which is the cURL sample, never holds a bidi control, and a copied sample cannot read
   differently from what it does ("Trojan Source"). In the URL and a form body these code
   points are already percent-encoded by rule 1, and in a header or cookie they are refused
   by rule 2, so (b) acts on body literals only.
   - **String literals.** Each string literal that holds tenant text is of one kind, and
     these characters are escaped in it. JavaScript: a single- or double-quoted string, never
     a template literal. Python: a string with no `f` prefix. Ruby: a double-quoted string,
     with `#` written `\#`. PHP: a double-quoted string, with `$` written `\$`. Go: an
     interpreted string literal. Java: a string literal in which `"`, `\`, CR and LF are
     written `\"`, `\\`, `\r` and `\n`, never as `\u` escapes, because Java decodes
     `\u0022` before it reads the string. C#: a regular string literal, never an
     interpolated or verbatim one. curl: a single-quoted word, with `'` written `'\''`.
   - **No tenant text in a comment.** No sample, in any language, holds tenant text in a
     comment. A comment holds only fixed text of ours. A comment has no escape: Java decodes
     `\u000a` in a comment as a line end, PHP ends a `//` comment at `?>`, C# ends one at
     U+0085, U+2028 and U+2029, and JavaScript ends one at U+2028 and U+2029.
   - **curl reads no file named by the spec.** The `curl` emitter sends an inline body with
     `--data-raw` and each multipart text value with `--form-string`. It never uses `-d`,
     `--data`, `--data-binary` or `-F` with tenant text: each reads a local file when the
     value starts with `@`, and `-F` also when it starts with `<`, and parses `;type=` in the
     value. `-F` and `--data-binary` appear only with `@YOUR_FILE_PATH`. A file part's tenant
     filename and content type follow as `;filename="…"` and `;type="…"`, which is
     unambiguous because rule 2 refuses `"` and `\`.
   - Alternative rejected: escape every non-ASCII code point. It is safe for any source
     encoding, but the readers criterion 33 serves would see `\u0645\u0631…` in place of
     their own language. All eight toolchains read UTF-8 source; the harness of criterion
     13 compiles Java with `-encoding UTF-8` so that it does not depend on the JDK's
     default.
4. **A JSON body** may be written as JSON text or as the language's own structure; the two
   send different bytes for the same value (Python's `json=` escapes non-ASCII, JavaScript's
   `JSON.stringify` does not), which is why the local mock compares JSON parsed.

### Display text for generated values

For M5. A `unique` variable is shown as `UNIQUE`, and `unique_1` to `unique_9` as `UNIQUE_1`
to `UNIQUE_9`: in the published page before any script runs, in code copied without
JavaScript, in the Markdown twin, `llms.txt`, the search index and the docs MCP. The text is
visibly a placeholder and passes the code-block allowlist. A sample sent with it behaves as a
fixed example does. The display text is also what a live page keeps when
`crypto.getRandomValues` is unavailable. Not yet defined, and needed by M5: the display text of `idempotency_key`
and of a captured name.

### What an M1 sample shows

A static M1 sample is `renderSample` of `buildRequest(model, id, undefined, { limits })`. No server is
chosen, so (criterion 15):

- **Base URL.** The first of the operation's effective servers (`Operation.servers[0]`, ADR
  0002), written as literal text with each variable replaced by its `default`. A variable with
  no `default` takes its first `enum` value; with neither, its `{name}` stays as written, and
  the doctor has already reported it. A server URL whose scheme is not `http` or `https`,
  compared without regard to ASCII case, is treated as relative: the sample uses `base_url`,
  and none of that URL's text follows it. (Revised for the 2026-11-28 review, F8; accepted by the security re-review of 2026-11-28.)
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
- **How a received request is compared with the expected one** (decided 2026-11-28, for
  criteria 14 and 33 alike). The harness compares what the mock recorded, whatever the mock
  answered; an expected entry may also name the status it expects, such as 400 for a row
  whose required header rule 2 of "Text outside ASCII" leaves out.
  - Method: exactly.
  - URL: the request target, path and query, byte for byte, in order, except that the two hex
    digits of a percent-escape are compared without regard to case (RFC 3986, 6.2.2.1).
    Nothing else is decoded: `%20` and `+` differ, and an encoded and an unencoded character
    differ. That rule 1 writes upper case is checked on the sample text by the emitter tests,
    not on the wire.
  - Headers: each expected header is present exactly once, its name compared without regard
    to ASCII case, its value byte for byte after removing leading and trailing spaces and
    tabs. Headers the expected entry does not list are ignored (clients add `User-Agent`,
    `Accept-Encoding`, `Host`, `Connection`, `Content-Length`), except that no header that the
    operation declares as a parameter, that a security scheme carries a credential in, or
    named `Cookie` or `Authorization` may be present unless it is expected. `Cookie` is
    compared as one header, its pairs in order.
  - `Content-Type`: the media type without regard to ASCII case; a `charset` parameter equal
    to `utf-8`, in any case, is ignored where the expected value has none; for `multipart`
    a `boundary` must be present and is used to parse the body; any other parameter must
    match.
  - Body, once de-chunked: JSON (`application/json` or a `+json` type) is compared as the
    parsed value: objects as sets of members (a duplicate key in the received body fails),
    arrays in order, numbers by value, strings by code point after JSON escapes are decoded,
    so a character written as itself and as a `\u` escape are equal. No normalization. A
    form body is compared as its `&`-separated pairs, in order, by the URL rule. Multipart
    is compared part by part, in order: name, filename and content byte for byte, and a
    part's `Content-Type` only where the expected entry gives one. Any other body: byte for
    byte.
- **It never calls a real API.** It listens on `127.0.0.1` only and makes no outbound request.
  Before running any sample the harness checks that the sample's base URL is the mock's, and
  fails otherwise, so a sample that still points at a real server is never run.

Alternative rejected: an option on `buildRequest` or the CLI that overrides the base URL for
tests. It is a second way to choose a destination, which every later reader of the proxy rules
would have to rule out, and samples built with it would no longer show the first declared
server.

## Consequences

- Guides `<Sample>` (M5) is `buildRequest` with the block's values. Captured variables are `Var`
  parts with `scope: 'captured'`, and generated values are `Var` parts with `scope: 'builtin'`. Validation of supplied values against the schema is added to
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
