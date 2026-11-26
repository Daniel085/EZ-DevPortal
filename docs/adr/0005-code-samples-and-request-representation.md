# ADR 0005: Code samples and the request representation

Status: proposed, 2026-11-26. Milestone: M1, with M2 and M5 consumers. Revised the same day to
apply the security design review (`docs/reviews/2026-11-26-security-design-review.md`, H1, H2,
H3, M6).

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
                                                                    // enum, or [A-Za-z0-9.-]+
  security?: string[];                    // scheme ids to apply; default: first requirement
  templates?: { pointer: string; text: Text }[];   // string leaves that hold variables, by JSON
                                                   // Pointer into this object. See "Variables".
}

interface Var {
  var: string;                                      // 'base_url', 'payment_id', 'api_key'
  scope: 'builtin' | 'captured' | 'credential';     // three namespaces; a name never crosses them
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
  as contract 4.6 requires and passes the parsed `Text`. "Try it" and MCP callers pass plain
  values and can never introduce a variable. A JSON string that is exactly one variable is a
  `{ string: [Var] }` leaf, which is how the typed substitution in contract 4.6 is recognised.
- Credentials are always variables with `scope: 'credential'` (`api_key`, `access_token`), placed
  by `buildRequest` according to the security scheme and by nothing else. `templates` may not name
  a credential variable, and a captured name can never fill one, because the scopes are separate.
  The engine never sees a real credential in M1. In M2 the real value is supplied per request to
  `resolveRequest`, a pure function, and is not stored anywhere.
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
- A runtime value is a string, number or boolean of at most 2,048 characters (contract 4.6).
  Header names match the RFC 9110 `token` and header values contain no CR, LF or NUL; `buildRequest`
  reports a violation in `issues`, and `resolveRequest` checks again after substitution.
- Emitters target each language's common HTTP client, not a generated SDK. M1 languages: curl,
  JavaScript (`fetch`) and Python (`requests`). Adding one is adding one function.
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
  request, server-side, from the published model: destination only from the model's servers
  (server variables limited to their `enum`, or `[A-Za-z0-9.-]+`), subject to the URL policy in
  ADR 0003; final method and path must match an operation the tenant enabled; the controlled-header
  list applies. The client-side checks are for the reader's benefit only.
- The page file carries samples as segment lists. The renderer turns each `Var` into a placeholder
  element (ADR 0006). Markdown twins and `llms.txt` show a fixed display text for each variable
  and are never substituted.
- The MCP `describe` tool can return `RequestValues` as its input shape instead of inventing one.

## Alternative rejected

Per-language templates filled straight from the model. Each template would re-implement
serialization and escaping, and nothing would be left for "Try it" or MCP to reuse. Also rejected:
`httpsnippet` (MIT). Its input is HAR, which has no notion of a variable or placeholder, and it
brings Node-oriented dependencies (`form-data`, `event-stream`, `yargs`, `chalk`) into a package
that must stay pure and run in a browser. Three small emitters are less code than adapting it.
