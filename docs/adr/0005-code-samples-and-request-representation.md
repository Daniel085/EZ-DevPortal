# ADR 0005: Code samples and the request representation

Status: proposed, 2026-11-26. Milestone: M1, with M2 and M5 consumers.

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
  contentType?: string; server?: { index: number; variables?: Record<string, string> };
  security?: string[];                    // scheme ids to apply; default: first requirement
}

type Text = (string | { var: string })[];           // literal parts and named variables

interface HttpRequest {
  operationId: string; method: string;
  baseUrl: Text;                                    // [{ var: 'base_url' }] unless a server is chosen
  path: Text;                                       // serialized and percent-encoded
  query: { name: string; value: Text }[];
  headers: { name: string; value: Text }[];         // includes auth and Content-Type
  body?: | { kind: 'json'; value: Json }            // strings inside may hold '{{var}}'
         | { kind: 'form'; fields: { name: string; value: Text }[] }
         | { kind: 'multipart'; parts: { name: string; value: Text; filename?: string; contentType?: string }[] }
         | { kind: 'text'; text: Text; contentType: string }
         | { kind: 'binary'; filename: string };
}

interface Sample { language: SampleLanguage; label: string; code: string; highlight: string }
```

Rules:

- `buildRequest` fills anything the caller did not supply, in this order: named example, schema
  `examples`, `default`, first `enum` value, then `synthesizeExample` (deterministic, recursion cut
  on the second visit to a schema). Only required parameters are filled when nothing is supplied.
- Credentials are always variables (`{{api_key}}`, `{{access_token}}`), placed according to the
  security scheme. The engine never sees a real credential in M1. In M2 the real value is supplied
  per request to `resolveRequest`, a pure function, and is not stored anywhere.
- Variables are first-class (`{ var }`), so each language decides how to show one (an environment
  variable in curl, a named constant in Python) and "Try it" can substitute real values.
- One emitter per language: a function `(request: HttpRequest) => string` written by hand, with
  its own string and shell escaping. Every value is escaped for the target language; a spec value
  must not be able to break out of a quoted string in copied code. Each emitter is tested on the
  fixture corpus with hostile values.
- Emitters target each language's common HTTP client, not a generated SDK. M1 languages: curl,
  JavaScript (`fetch`) and Python (`requests`). Adding one is adding one function.
- Samples are generated at publish time for every language and stored in the page file
  (ADR 0003). Switching language in the browser needs no server and no engine code.
- Syntax highlighting is not the engine's job. It returns code and a language id (ADR 0006).

## Consequences

- Guides `<Sample>` (M5) is `buildRequest` with the block's values. Captured variables are ordinary
  `{ var }` parts. Validation of supplied values against the schema is added to `issues` then.
- "Try it" and MCP send exactly the request the sample shows, because both come from one
  `HttpRequest`. A serialization bug is fixed once.
- The MCP `describe` tool can return `RequestValues` as its input shape instead of inventing one.

## Alternative rejected

Per-language templates filled straight from the model. Each template would re-implement
serialization and escaping, and nothing would be left for "Try it" or MCP to reuse. Also rejected:
`httpsnippet` (MIT). Its input is HAR, which has no notion of a variable or placeholder, and it
brings Node-oriented dependencies (`form-data`, `event-stream`, `yargs`, `chalk`) into a package
that must stay pure and run in a browser. Three small emitters are less code than adapting it.
