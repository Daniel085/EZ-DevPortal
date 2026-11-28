// The fixture corpus is what every M1 criterion is checked on, so it is checked first: the
// manifest matches the disk, hashes still match, licences are present, every document parses
// (or fails to) as recorded, every hand-written expected value points at something that exists
// in its fixture and agrees with the ADR it cites, and unicode-text holds exactly what
// criterion 33 lists. None of this needs the engine.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type ExactEntry,
  type ExpectedFindings,
  adrFatalCodes,
  adrMalformedCodes,
  adrRuleTable,
  adrWorkedExamples,
  allFiles,
  discoverSpecFiles,
  largePresent,
  loadMalformedExpected,
  loadManifest,
  mockServerUrl,
  parseAsData,
  readFetchPins,
  readJson,
  readSha256Sums,
  readSpecBytes,
  readSpecText,
  resolvePointer,
  sha256,
  specsDir,
} from './corpus/corpus.js';
import { pendingCase } from './corpus/engine-api.js';
import { adrParsingLimits, oversizeDocuments } from './corpus/oversize.js';

const manifest = loadManifest();
const byFile = new Map(manifest.fixtures.map((f) => [f.file, f]));
const committed = manifest.fixtures.filter((f) => !f.fetchOnly);
const parsed = new Map<string, unknown>();
function data(file: string): unknown {
  if (!parsed.has(file)) {
    const r = parseAsData(readSpecText(file));
    if (!r.ok) throw new Error(`${file} does not parse: ${r.errors.join('; ')}`);
    parsed.set(file, r.value);
  }
  return parsed.get(file);
}

interface WithFindings { fixture: string; findings: ExpectedFindings }

function exactPointers(entries: ExactEntry[]): string[] {
  return entries.flatMap((e) =>
    typeof e === 'string' ? [e] : [...(e.pointer === null ? [] : [e.pointer]), ...(e.alternatives ?? [])],
  );
}

describe('corpus manifest matches the disk', () => {
  it('lists every spec file under fixtures/specs, and nothing that is not there', () => {
    const onDisk = discoverSpecFiles().filter((f) => !f.startsWith('large/'));
    const listed = committed.map((f) => f.file).sort();
    expect(onDisk).toEqual(listed);
  });

  it('every file in large/ is a listed fetch-only fixture', () => {
    const large = discoverSpecFiles().filter((f) => f.startsWith('large/'));
    for (const f of large) expect(byFile.get(f)?.fetchOnly, f).toBe(true);
    expect(manifest.fixtures.filter((f) => f.fetchOnly).every((f) => f.file.startsWith('large/'))).toBe(true);
  });

  it("'all fixtures' is m1.md's: 12 committed specs, four fetch-only, hard-schemas and unicode-text", () => {
    const all = manifest.fixtures.filter((f) => f.set === 'all');
    expect(all.filter((f) => f.fetchOnly)).toHaveLength(4);
    expect(all.filter((f) => !f.fetchOnly).map((f) => f.file)).toHaveLength(14);
    expect(all.map((f) => f.file)).toEqual(expect.arrayContaining(['hard-schemas.yaml', 'unicode-text.json']));
    expect(manifest.fixtures.filter((f) => f.set === 'broken')).toHaveLength(16);
  });

  it('README.md names every fixture', () => {
    const readme = readFileSync(join(specsDir, 'README.md'), 'utf8');
    for (const f of manifest.fixtures) expect(readme.includes(`\`${f.file}\``), f.file).toBe(true);
  });
});

describe('hashes', () => {
  const sums = readSha256Sums();

  it('SHA256SUMS still matches every file it lists', () => {
    const bad = sums.filter(([hash, file]) => sha256(readSpecBytes(file)) !== hash).map(([, f]) => f);
    expect(bad).toEqual([]);
  });

  it('SHA256SUMS lists every committed file except README.md and fetch.sh', () => {
    const listed = new Set(sums.map(([, f]) => f));
    const committedFiles = allFiles().filter(
      (f) => !f.startsWith('large/') && f !== 'README.md' && f !== 'fetch.sh' && f !== 'SHA256SUMS',
    );
    expect(committedFiles.filter((f) => !listed.has(f))).toEqual([]);
    expect([...listed].filter((f) => !existsSync(join(specsDir, f)))).toEqual([]);
  });

  const pins = readFetchPins();
  for (const f of manifest.fixtures.filter((x) => x.fetchOnly)) {
    const name = f.file.slice('large/'.length);
    if (!largePresent(f.file)) {
      pendingCase(`${f.file} matches its pin in fetch.sh`, `${f.file} not downloaded; run fixtures/specs/fetch.sh`);
      continue;
    }
    it(`${f.file} matches its pin in fetch.sh`, () => {
      expect(pins[name]).toMatch(/^[0-9a-f]{64}$/);
      expect(sha256(readSpecBytes(f.file))).toBe(pins[name]);
    });
  }
});

describe('licences', () => {
  for (const f of committed.filter((x) => x.origin === 'third-party')) {
    it(`${f.file}: a licence text is committed beside it (${f.license})`, () => {
      expect(f.licenseFile).not.toBeNull();
      expect(existsSync(join(specsDir, f.licenseFile ?? ''))).toBe(true);
      expect(f.licenseFile ?? '').toContain(f.license.split(' ')[0] ?? '?');
    });
  }
  it('every licence file is used by a fixture', () => {
    const used = new Set(committed.map((f) => f.licenseFile));
    const files = allFiles().filter((f) => f.startsWith('licenses/'));
    expect(files.filter((f) => !used.has(f))).toEqual([]);
  });
});

describe('every fixture parses as YAML or JSON where it should', () => {
  const present = manifest.fixtures.filter((f) => !f.fetchOnly || largePresent(f.file));
  for (const f of present) {
    it(`${f.file} ${f.parses ? 'parses' : 'is not a YAML or JSON document'}`, () => {
      const text = readSpecText(f.file);
      const r = parseAsData(text);
      if (f.parses) {
        expect(r.errors).toEqual([]);
        if (f.format === 'json') expect(() => JSON.parse(text) as unknown).not.toThrow();
      } else {
        // An empty document is valid YAML (null), which ADR 0004 still calls parse-error.
        expect(r.errors.length > 0 || text.trim() === '').toBe(true);
      }
    }, 60_000);
  }
  for (const f of manifest.fixtures.filter((x) => x.fetchOnly && !largePresent(x.file))) {
    pendingCase(`${f.file} parses`, `${f.file} not downloaded; run fixtures/specs/fetch.sh`);
  }
});

describe('expected files', () => {
  const rules = adrRuleTable();

  it('every fixture QA wrote has an expected file, and every expected file is used', () => {
    for (const f of manifest.fixtures.filter((x) => x.set === 'qa' || x.set === 'broken')) {
      expect(f.expected, f.file).not.toBeNull();
    }
    for (const f of ['hard-schemas.yaml', 'unicode-text.json']) expect(byFile.get(f)?.expected).not.toBeNull();
    const used = new Set(manifest.fixtures.map((f) => f.expected));
    used.add('expected/synthesis-failed.json');
    const files = allFiles().filter((f) => f.startsWith('expected/'));
    expect(files.filter((f) => !used.has(f))).toEqual([]);
    for (const f of used) if (f) expect(existsSync(join(specsDir, f)), f).toBe(true);
  });

  it('no expected file holds a timestamp', () => {
    for (const f of allFiles().filter((x) => x.startsWith('expected/') || x === 'malformed/expected.json')) {
      expect(readSpecText(f), f).not.toMatch(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    }
  });

  for (const f of manifest.fixtures.filter((x) => x.expected && x.set !== 'broken')) {
    describe(f.file, () => {
      const exp = readJson<WithFindings>(join(specsDir, f.expected ?? ''));

      it('names this fixture', () => {
        expect(exp.fixture).toBe(f.file);
      });

      it('every finding code is in the ADR 0004 rule table, with its severity', () => {
        for (const x of exp.findings.includes) {
          expect(rules.has(x.code), x.code).toBe(true);
          expect(x.severity, x.code).toBe(rules.get(x.code)?.severity);
        }
        for (const code of Object.keys(exp.findings.exactCodes)) expect(rules.has(code), code).toBe(true);
      });

      it('every asserted pointer exists in the fixture', () => {
        const doc = data(f.file);
        const pointers = [
          ...exp.findings.includes.flatMap((x) => [...(x.pointer === null ? [] : [x.pointer]), ...(x.pointerAlternatives ?? [])]),
          ...Object.values(exp.findings.exactCodes).flatMap(exactPointers),
        ];
        expect(pointers.filter((p) => !resolvePointer(doc, p).found)).toEqual([]);
      });
    });
  }
});

describe('malformed/expected.json', () => {
  const expected = loadMalformedExpected();
  const fromAdr = adrMalformedCodes();
  const fatal = adrFatalCodes();

  it('gives each of the 16 fixtures the code ADR 0004 assigns it', () => {
    expect(Object.keys(expected).sort()).toEqual([...fromAdr.keys()].sort());
    for (const [file, e] of Object.entries(expected)) expect(e.code, file).toBe(fromAdr.get(file));
  });

  it('the fatal codes are the closed list of four, and five fixtures are fatal', () => {
    expect(fatal.sort()).toEqual(['limit-exceeded', 'not-openapi', 'parse-error', 'unsupported-version']);
    const fatalFiles = Object.entries(expected).filter(([, e]) => e.fatal).map(([f]) => f).sort();
    expect(fatalFiles).toEqual(['empty.yaml', 'invalid-json.json', 'invalid-yaml.yaml', 'missing-openapi.yaml', 'unsupported-swagger-2.0.yaml']);
    for (const e of Object.values(expected)) {
      expect(e.fatal).toBe(fatal.includes(e.code));
      expect(e.severity).toBe(e.fatal ? 'error' : 'warning');
      expect(adrRuleTable().get(e.code)?.severity).toBe(e.severity);
    }
  });

  it('every non-null pointer exists in its fixture (the node, or its parent for a missing key)', () => {
    for (const [file, e] of Object.entries(expected)) {
      if (e.pointer === null || e.pointer === '' || e.stage === 'parse') continue;
      expect(resolvePointer(data(`malformed/${file}`), e.pointer).found, file).toBe(true);
    }
  });
});

describe('synthesis-failed.json (criterion 7)', () => {
  const sf = readJson<{ fixtures: Record<string, { pointer: string; operationId: string; reason: string }[]> }>(
    join(specsDir, 'expected', 'synthesis-failed.json'),
  );
  const malformed = loadMalformedExpected();

  it('lists exactly the committed fixtures that build', () => {
    const building = committed
      .filter((f) => f.set !== 'broken' || !malformed[f.file.slice('malformed/'.length)]?.fatal)
      .map((f) => f.file)
      .sort();
    expect(Object.keys(sf.fixtures).sort()).toEqual(building);
  });

  it('every listed case is a schema in its fixture, with a written reason', () => {
    for (const [file, cases] of Object.entries(sf.fixtures)) {
      for (const c of cases) {
        const r = resolvePointer(data(file), c.pointer);
        expect(r.found, c.pointer).toBe(true);
        expect(typeof r.value === 'object' && r.value !== null, c.pointer).toBe(true);
        expect(c.reason.length, c.pointer).toBeGreaterThan(20);
        const op = resolvePointer(data(file), c.pointer.split('/').slice(0, 4).join('/'));
        expect((op.value as { operationId?: string }).operationId, c.pointer).toBe(c.operationId);
      }
    }
  });
});

describe('hostile-content expected strings are the fixture as written', () => {
  const exp = readJson<{ strings: { pointer: string; authored: unknown }[] }>(
    join(specsDir, 'expected', 'hostile-content.json'),
  );
  it('each authored value is the value at its pointer', () => {
    const doc = data('qa/hostile-content.yaml');
    for (const s of exp.strings) {
      const r = resolvePointer(doc, s.pointer);
      expect(r.found, s.pointer).toBe(true);
      // A name's pointer addresses the item it names: compare the name with the last segment.
      const last = s.pointer.split('/').at(-1)?.replace(/~1/g, '/').replace(/~0/g, '~');
      const isName = typeof s.authored === 'string' && typeof r.value === 'object' && r.value !== null;
      expect(isName ? last : r.value, s.pointer).toEqual(s.authored);
    }
  });
});

describe('host-variables follows ADR 0004 worked examples (criterion 29)', () => {
  const exp = readJson<{ servers: { index: number; url: string; adrRow: number | null;
    withList: { callable: boolean; fix: { format: string } | null } }[] }>(join(specsDir, 'expected', 'host-variables.json'));
  const servers = (data('qa/host-variables.yaml') as { servers: { url: string; variables: Record<string, { enum?: string[]; default?: string }> }[] }).servers;

  it('one server per row of the table, in order, then the empty-enum server', () => {
    const rows = adrWorkedExamples();
    expect(rows).toHaveLength(10);
    expect(servers).toHaveLength(rows.length + 1);
    rows.forEach((row, i) => {
      expect(servers[i]?.url, row.text).toBe(row.url);
      const e = exp.servers[i];
      expect(e?.url).toBe(row.url);
      expect(e?.adrRow).toBe(i + 1);
      expect(e?.withList.callable, row.text).toBe(row.callable);
      expect(e?.withList.fix === null ? 'none' : 'offered', row.text).toBe(row.fix);
      // "No variable has an enum" (the table's own premise).
      for (const v of Object.values(servers[i]?.variables ?? {})) expect(v.enum).toBeUndefined();
    });
    const last = servers[rows.length];
    expect(Object.values(last?.variables ?? {}).map((v) => v.enum)).toEqual([[]]);
    expect(exp.servers.map((s) => s.url)).toEqual(servers.map((s) => s.url));
  });

  it('every variable has a default, so server-variable-no-default is never due', () => {
    for (const s of servers) for (const v of Object.values(s.variables)) expect(typeof v.default).toBe('string');
  });
});

interface ExpectedRequest { operationId: string; method: string; target: string; headers: { name: string; value: string }[] }

function operations(doc: unknown): { method: string; path: string; operationId?: string }[] {
  const out: { method: string; path: string; operationId?: string }[] = [];
  for (const [path, item] of Object.entries((doc as { paths: Record<string, Record<string, { operationId?: string }>> }).paths)) {
    for (const [method, op] of Object.entries(item)) {
      out.push({ method, path, ...(op.operationId === undefined ? {} : { operationId: op.operationId }) });
    }
  }
  return out;
}

describe('mock-server fixtures (criteria 14 and 33)', () => {
  for (const f of manifest.fixtures.filter((x) => x.firstServerIsMock)) {
    it(`${f.file}: the first server is the local mock`, () => {
      const servers = (data(f.file) as { servers: { url: string }[] }).servers;
      expect(servers[0]?.url).toBe(mockServerUrl);
    });
  }

  it('request-shape-matrix: one expected request per operation, by operationId', () => {
    const exp = readJson<{ requests: ExpectedRequest[] }>(join(specsDir, 'expected', 'request-shape-matrix.json'));
    const ops = operations(data('qa/request-shape-matrix.yaml'));
    expect(exp.requests.map((r) => r.operationId).sort()).toEqual(ops.map((o) => o.operationId).sort());
    for (const r of exp.requests) {
      const op = ops.find((o) => o.operationId === r.operationId);
      expect(r.method).toBe(op?.method.toUpperCase());
      expect(r.target.startsWith('/')).toBe(true);
    }
  });

  it("request-shape-matrix: the Basic row's header is the Base64 of the placeholder pair (ADR 0005)", () => {
    const exp = readJson<{ requests: ExpectedRequest[] }>(join(specsDir, 'expected', 'request-shape-matrix.json'));
    const basic = exp.requests.find((r) => r.operationId === 'basicAuth');
    expect(basic?.headers).toEqual([
      { name: 'Authorization', value: 'Basic ' + Buffer.from('YOUR_USERNAME:YOUR_PASSWORD').toString('base64') },
    ]);
  });

  it('expected targets are ASCII with upper-case percent-escapes (ADR 0005 rule 1)', () => {
    for (const name of ['request-shape-matrix.json', 'unicode-text.json']) {
      const exp = readJson<{ requests: ExpectedRequest[] }>(join(specsDir, 'expected', name));
      for (const r of exp.requests) {
        expect(r.target, r.operationId).toMatch(/^[\x21-\x7e]+$/);
        expect(r.target.match(/%[0-9a-fA-F]{2}/g)?.every((e) => e === e.toUpperCase()) ?? true).toBe(true);
      }
    }
  });
});

// ---- unicode-text (criterion 33) -------------------------------------------------------------

const bidiAndSeparators = new Set([0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
  0x2066, 0x2067, 0x2068, 0x2069, 0x2028, 0x2029]);
const hex = (cp: number): string => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');

/** Every string in a parsed document, keys included, with its pointer. Keys get the pointer of
 * the member they name. */
function strings(value: unknown, pointer = ''): { pointer: string; text: string; key: boolean }[] {
  const out: { pointer: string; text: string; key: boolean }[] = [];
  if (typeof value === 'string') out.push({ pointer, text: value, key: false });
  else if (Array.isArray(value)) value.forEach((v, i) => out.push(...strings(v, `${pointer}/${i}`)));
  else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const p = `${pointer}/${k.replace(/~/g, '~0').replace(/\//g, '~1')}`;
      out.push({ pointer: p, text: k, key: true }, ...strings(v, p));
    }
  }
  return out;
}

describe('unicode-text holds what criterion 33 lists, and nothing it forbids', () => {
  const file = 'unicode-text.json';
  const bytes = readSpecBytes(file);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const doc = JSON.parse(text) as unknown;
  const all = strings(doc);
  const exp = readJson<{
    controls: { occurrences: { pointer: string; codePoint: string }[] };
    operations: { method: string; path: string; id: string; idSource: string }[];
    tags: { name: string }[];
    schemas: { id: string }[];
    lengths: { cases: { pointer: string; value: string; codePoints: number; utf16Units: number }[] };
    requests: { operationId: string }[];
  }>(join(specsDir, 'expected', 'unicode-text.json'));

  it('is UTF-8 with no byte order mark, no U+FFFD, and no control character but LF', () => {
    expect([...bytes.subarray(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(text.includes('�')).toBe(false);
    expect([...text].filter((c) => /[\p{Cc}]/u.test(c) && c !== '\n').map((c) => hex(c.codePointAt(0) ?? 0))).toEqual([]);
  });

  it('every bidi control and separator is at a place criterion 33 lists, and every listed one is there', () => {
    const found: string[] = [];
    for (const s of all) {
      for (const c of s.text) {
        const cp = c.codePointAt(0) ?? 0;
        if (bidiAndSeparators.has(cp)) found.push(`${s.key ? 'key ' : ''}${s.pointer} ${hex(cp)}`);
      }
    }
    // The bytes too, so a parser that dropped one would not hide it.
    const inBytes = [...text].filter((c) => bidiAndSeparators.has(c.codePointAt(0) ?? 0)).length;
    expect(inBytes).toBe(found.length);
    const listed = exp.controls.occurrences.map((o) => `${o.pointer} ${o.codePoint}`);
    expect(found.sort()).toEqual(listed.sort());
  });

  it('U+2067 in the summary is not closed by U+2069', () => {
    const s = all.find((x) => x.text.includes('⁧'));
    expect(s?.pointer).toMatch(/\/summary$/);
    expect(s?.text.slice(s.text.indexOf('⁧')).includes('⁩')).toBe(false);
  });

  it('U+200F is inside a right-to-left sentence with a Latin word and a number', () => {
    const s = all.find((x) => x.text.includes('‏'));
    expect(s?.text).toMatch(/[֐-׿؀-ۿ]/u);
    expect(s?.text).toMatch(/[A-Za-z]{2,}/);
    expect(s?.text).toMatch(/[0-9]/);
    const i = s?.text.indexOf('‏') ?? -1;
    expect(i > 0 && i < (s?.text.length ?? 0) - 1).toBe(true);
  });

  it('holds every script and kind of text the criterion lists', () => {
    const joined = all.map((s) => s.text).join('\n');
    const has = (re: RegExp): boolean => re.test(joined);
    expect(has(/[؀-ۿ]/u), 'Arabic').toBe(true);
    expect(has(/[֐-׿]/u), 'Hebrew').toBe(true);
    expect(has(/\p{Script=Han}/u), 'Chinese').toBe(true);
    expect(has(/[\p{Script=Hiragana}\p{Script=Katakana}]/u), 'Japanese').toBe(true);
    expect(has(/\p{Script=Devanagari}/u), 'Devanagari').toBe(true);
    expect(has(/[\u{20000}-\u{2A6DF}]/u), 'a non-BMP character that is not an emoji').toBe(true);
    expect(has(/\p{Extended_Pictographic}(\p{Emoji_Modifier})?‍\p{Extended_Pictographic}/u), 'emoji ZWJ sequence').toBe(true);
    expect(has(/\p{Regional_Indicator}{2}/u), 'a flag').toBe(true);
    expect(has(/\p{Emoji_Modifier}/u), 'a skin-tone modifier').toBe(true);
    const nfd = all.filter((s) => s.text !== s.text.normalize('NFC') && s.text === s.text.normalize('NFD'));
    expect(nfd.length, 'a string in NFD').toBeGreaterThan(0);
  });

  it('the required header and cookie have non-ASCII examples, and the refused part names are there', () => {
    const params = all.filter((s) => /\/parameters\/\d+\/in$/.test(s.pointer));
    const required = (inn: string): { example: string }[] =>
      params
        .filter((p) => p.text === inn)
        .map((p) => resolvePointer(doc, p.pointer.replace(/\/in$/, '')).value as { required?: boolean; example: string })
        .filter((p) => p.required === true);
    for (const inn of ['header', 'cookie']) {
      const ps = required(inn);
      expect(ps.length, inn).toBe(1);
      expect(ps[0]?.example, inn).toMatch(/[^\x20-\x7e]/);
    }
    const props = all.filter((s) => s.key && /multipart~1form-data\/schema\/properties\/[^/]+$/.test(s.pointer)).map((s) => s.text);
    expect(props.some((n) => /[^\x20-\x7e]/.test(n))).toBe(true);
    expect(props.some((n) => n.includes('='))).toBe(true);
  });

  it('every name, summary and enum value is one escapeMarkdownText leaves unchanged (ADR 0003)', () => {
    // escapeMarkdownText escapes \ ` * _ [ ] < > & ~ |, and at the start # + - = and the . or )
    // after leading digits; it turns line ends and tabs into a space and trims the ends.
    const doc0 = doc as { tags: { name: string }[] };
    const names = [
      ...doc0.tags.map((t) => t.name),
      ...all.filter((s) => s.key && /\/(properties|schemas)\/[^/]+$/.test(s.pointer)).map((s) => s.text),
      ...all.filter((s) => !s.key && /\/(summary|operationId|name)$/.test(s.pointer)).map((s) => s.text),
      ...all.filter((s) => !s.key && /\/enum\/\d+$/.test(s.pointer)).map((s) => s.text),
    ];
    const changed = names.filter(
      (n) => /[\\`*_[\]<>&~|\t\r\n]/.test(n) || /^([#+=-]|\d+[.)])/.test(n) || n !== n.trim(),
    );
    expect(changed).toEqual([]);
  });

  it('every description is one sanitizeMarkdown leaves unchanged: no <, [ or code fence (ADR 0003, Speed)', () => {
    const descs = all.filter((s) => !s.key && s.pointer.endsWith('/description')).map((s) => s.text);
    expect(descs.length).toBeGreaterThan(5);
    expect(descs.filter((d) => /[<[]|```|~~~/.test(d))).toEqual([]);
  });

  it('the expected file names the fixture\'s operations, tags and schemas exactly', () => {
    const ops = operations(doc);
    expect(exp.operations.map((o) => `${o.method} ${o.path}`).sort()).toEqual(ops.map((o) => `${o.method} ${o.path}`).sort());
    for (const o of exp.operations) {
      const op = ops.find((x) => x.method === o.method && x.path === o.path);
      expect(o.idSource).toBe(op?.operationId === undefined ? 'derived' : 'declared');
      if (op?.operationId !== undefined) expect(o.id).toBe(op.operationId);
    }
    expect(exp.requests.map((r) => r.operationId).sort()).toEqual(exp.operations.map((o) => o.id).sort());
    const d = doc as { tags: { name: string }[]; components: { schemas: Record<string, unknown> } };
    expect(exp.tags.map((t) => t.name)).toEqual(d.tags.map((t) => t.name));
    expect(exp.schemas.map((s) => s.id)).toEqual(Object.keys(d.components.schemas));
  });

  it('the length cases count what they say: code points against UTF-16 code units', () => {
    for (const c of exp.lengths.cases) {
      expect(resolvePointer(doc, c.pointer).value).toBe(c.value);
      expect([...c.value].length).toBe(c.codePoints);
      expect(c.value.length).toBe(c.utf16Units);
    }
  });
});

describe('the generated oversize documents are over their limits (criterion 5)', () => {
  const docs = oversizeDocuments(adrParsingLimits);
  it('has one document per parsing limit', () => {
    expect(new Set(docs.map((d) => d.limit))).toEqual(new Set(Object.keys(adrParsingLimits)));
  });
  for (const d of docs) {
    it(`${d.name}`, () => {
      const text = d.text();
      switch (d.limit) {
        case 'inputBytes':
          expect(Math.max(text.length, d.bytes ?? 0)).toBe(adrParsingLimits.inputBytes + 1);
          break;
        case 'depth': {
          const opens = text.split('{a: ').length - 1;
          expect(opens).toBe(adrParsingLimits.depth + 1);
          break;
        }
        case 'nodes':
          expect(text.split(',').length).toBeGreaterThan(adrParsingLimits.nodes);
          break;
        case 'aliasExpansions':
          expect(text.split('*a').length - 1).toBe(adrParsingLimits.aliasExpansions + 1);
          break;
      }
      expect(d.text()).toBe(text); // deterministic
    });
  }
});

