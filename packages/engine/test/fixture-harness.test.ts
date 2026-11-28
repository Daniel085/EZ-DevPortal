// Runs every fixture through the engine's entry points as they exist (ADR 0003). The engine is
// built in the order of ADR 0003, "Build order in M1"; until a function lands, each case that
// needs it is a Vitest todo labelled "[pending: engine lacks ...]", so the output counts what is
// still to run and nothing is reported as passing that did not run. When the function lands the
// case runs with no change here.
//
// Discovery: every spec in fixtures/specs/corpus.json (committed corpus, malformed, QA's
// fixtures and large/ when downloaded) plus the generated oversize documents. The integrity test
// already fails if a spec on disk is missing from the manifest.
//
// Cases that need something other than an engine function (the local mock, the eight sample
// toolchains, the renderer, the vendored Public Suffix List) say what they wait for.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import {
  type ExactEntry,
  type ExpectedFindings,
  type ManifestEntry,
  adrRuleTable,
  largePresent,
  loadMalformedExpected,
  loadManifest,
  pslFile,
  readJson,
  readSpecBytes,
  readSpecText,
  sha256,
  specsDir,
  uriOf,
} from './corpus/corpus.js';
import {
  type EngineName,
  type Finding,
  type ModelLike,
  type ParsedDocument,
  type SchemaNodeLike,
  api,
  engineCase,
  languages,
  pendingCase,
} from './corpus/engine-api.js';
import { oversizeDocuments } from './corpus/oversize.js';

const manifest = loadManifest();
const malformed = loadMalformedExpected();
const rules = adrRuleTable();
const largeTimeout = 300_000;
const pslMissing = existsSync(pslFile)
  ? null
  : 'data/public-suffix-list/ not vendored yet (kickoff step 3.3)';

// ---- the engine pass -------------------------------------------------------------------------

interface Pass {
  root: ParsedDocument;
  model: ModelLike | null;
  modelFindings: Finding[];
  doctor: Finding[];
  bundleFindings: Finding[];
  bundle: { path: string; content: string }[];
}

const P_M: readonly EngineName[] = ['defaultLimits', 'parseDocument', 'buildModel'];
const P_M_D: readonly EngineName[] = [...P_M, 'diagnose'];
const P_M_D_B: readonly EngineName[] = [...P_M_D, 'buildPortalBundle'];

function parse(file: string): ParsedDocument {
  const e = api();
  const bytes = readSpecBytes(file);
  return e.parseDocument({ uri: uriOf(file), text: bytes.toString('utf8'), bytes: bytes.length }, e.defaultLimits);
}

/**
 * parseDocument, buildModel, then diagnose and buildPortalBundle when asked for, as `ezdp
 * build` runs them (ADR 0003, "The M1 command line", step 2) with no overlay, so both hashes
 * are the file's. `documents` holds no other document: M1 reads one file.
 */
function pass(file: string, upTo: 'model' | 'doctor' | 'bundle', publicSuffixes: unknown = null): Pass {
  const e = api();
  const root = parse(file);
  const hash = sha256(readSpecBytes(file));
  const { model, findings } = e.buildModel({ root, documents: [], fetchedHash: hash, publishedHash: hash });
  const out: Pass = { root, model, modelFindings: findings, doctor: [], bundleFindings: [], bundle: [] };
  if (upTo === 'model' || model === null) return out;
  out.doctor = e.diagnose(model, [root], { publicSuffixes, limits: e.defaultLimits });
  if (upTo === 'doctor') return out;
  const built = e.buildPortalBundle(model, { findings: [...findings, ...out.doctor], notApplied: [] },
    { languages, limits: e.defaultLimits });
  out.bundleFindings = built.findings;
  out.bundle = built.bundle.files;
  return out;
}

function allFindings(p: Pass): Finding[] {
  return [...p.modelFindings, ...p.doctor, ...p.bundleFindings];
}

let psl: unknown;
function publicSuffixes(): unknown {
  psl ??= api().parsePublicSuffixList(readFileSync(pslFile, 'utf8'));
  return psl;
}

// ---- expected findings -----------------------------------------------------------------------

/** Which pass a code needs, from the "By" column of ADR 0004's rule table. */
function needsFor(code: string): readonly EngineName[] {
  const by = rules.get(code)?.by ?? 'B';
  if (by === 'P' || by === 'M') return P_M;
  if (by === 'D') return P_M_D;
  return P_M_D_B;
}

function matches(f: Finding, pointer: string | null, alternatives: string[] = []): boolean {
  return pointer === null || f.location.pointer === pointer || alternatives.includes(f.location.pointer);
}

function where(pointer: string | null): string {
  return pointer === null ? '(pointer not asserted)' : pointer === '' ? 'the root' : pointer;
}

function describeFinding(f: Finding): string {
  return `${f.severity} ${f.code} ${f.location.pointer}`;
}

/** Registers the `includes` and `exactCodes` cases of one expected file. */
function expectedFindingCases(file: string, exp: ExpectedFindings, timeout?: number): void {
  for (const x of exp.includes) {
    const needs = needsFor(x.code);
    engineCase(`reports ${x.severity} ${x.code} at ${where(x.pointer)}`, needs, () => {
      const p = pass(file, needs.includes('buildPortalBundle') ? 'bundle' : 'doctor');
      const hit = allFindings(p).filter((f) => f.code === x.code && matches(f, x.pointer, x.pointerAlternatives));
      expect(hit.map(describeFinding), allFindings(p).map(describeFinding).join('\n')).not.toEqual([]);
      for (const f of hit) expect(f.severity).toBe(x.severity);
    }, timeout === undefined ? {} : { timeout });
  }
  for (const [code, entries] of Object.entries(exp.exactCodes)) {
    const needs = needsFor(code);
    engineCase(`reports ${code} exactly ${entries.length} time(s), at the listed places`, needs, () => {
      const p = pass(file, needs.includes('buildPortalBundle') ? 'bundle' : 'doctor');
      const got = allFindings(p).filter((f) => f.code === code);
      expect(got.map(describeFinding)).toHaveLength(entries.length);
      const left = [...got];
      const norm = entries.map((e: ExactEntry) => (typeof e === 'string' ? { pointer: e, alternatives: [] } : e));
      // Entries with a pointer first, so a null entry cannot take a finding another entry needs.
      for (const e of [...norm].sort((a, b) => Number(a.pointer === null) - Number(b.pointer === null))) {
        const i = left.findIndex((f) => matches(f, e.pointer, e.alternatives ?? []));
        expect(i, `no ${code} at ${e.pointer}; got ${got.map(describeFinding).join(', ')}`).toBeGreaterThanOrEqual(0);
        left.splice(i, 1);
      }
    }, timeout === undefined ? {} : { timeout });
  }
}

// ---- cases every fixture gets ----------------------------------------------------------------

function commonCases(entry: ManifestEntry): void {
  const file = entry.file;
  const isLarge = entry.fetchOnly;
  const t = isLarge ? largeTimeout : undefined;
  const opts = t === undefined ? {} : { timeout: t };
  const m = entry.set === 'broken' ? malformed[file.slice('malformed/'.length)] : undefined;

  engineCase('parseDocument returns findings and does not throw', ['defaultLimits', 'parseDocument'], () => {
    const doc = parse(file);
    expect(doc.uri).toBe(uriOf(file));
    expect(Array.isArray(doc.findings)).toBe(true);
    for (const f of doc.findings) expect(['error', 'warning', 'info']).toContain(f.severity);
  }, opts);

  engineCase('buildModel: the model is null exactly when a finding has severity error (ADR 0004)', P_M, () => {
    const p = pass(file, 'model');
    const errors = p.modelFindings.filter((f) => f.severity === 'error');
    expect(p.model === null).toBe(errors.length > 0);
    if (p.model === null) expect(errors.every((f) => ['parse-error', 'limit-exceeded', 'not-openapi', 'unsupported-version'].includes(f.code))).toBe(true);
  }, opts);

  if (m) {
    engineCase(`${m.fatal ? 'is fatal with' : 'builds, with'} ${m.code} at ${where(m.pointer)} (criterion ${m.fatal ? 5 : 6})`, P_M, () => {
      const p = pass(file, 'model');
      expect(p.model === null).toBe(m.fatal);
      const hit = p.modelFindings.filter((f) => f.code === m.code && matches(f, m.pointer));
      expect(hit.map(describeFinding), p.modelFindings.map(describeFinding).join('\n')).not.toEqual([]);
      for (const f of hit) expect(f.severity).toBe(m.severity);
      if (m.fatal) for (const f of hit) expect(f.location.start.line).toBeGreaterThanOrEqual(1);
    });
  } else {
    engineCase('builds a model, with no limit-exceeded (ADR 0003, Budgets)', P_M, () => {
      const p = pass(file, 'model');
      expect(p.modelFindings.filter((f) => f.severity === 'error').map(describeFinding)).toEqual([]);
      expect(p.model).not.toBeNull();
    }, opts);
  }

  if (m?.fatal) return;

  engineCase('diagnose: every finding is a warning or info with a pointer, a message and a fingerprint (criterion 10)', P_M_D, () => {
    const p = pass(file, 'doctor');
    for (const f of [...p.modelFindings, ...p.doctor]) {
      expect(['warning', 'info'], describeFinding(f)).toContain(f.severity);
      expect(typeof f.location.pointer).toBe('string');
      expect(f.message.trim().length, describeFinding(f)).toBeGreaterThan(0);
      expect(f.fingerprint.startsWith(f.code), describeFinding(f)).toBe(true);
    }
    for (const f of p.doctor.filter((x) => x.code === 'example-missing')) expect(f.fixes).toEqual([]);
  }, opts);

  engineCase('buildPortalBundle: no budget-exceeded, no page truncated (ADR 0003, Budgets; criterion 3)', P_M_D_B, () => {
    const p = pass(file, 'bundle');
    expect(allFindings(p).filter((f) => f.code === 'budget-exceeded' || f.code === 'limit-exceeded').map(describeFinding)).toEqual([]);
    for (const b of p.bundle.filter((x) => x.path.startsWith('pages/'))) {
      expect((JSON.parse(b.content) as { truncated?: boolean }).truncated, b.path).toBe(false);
    }
  }, opts);

  if (!isLarge) {
    engineCase('the engine pass is deterministic: the same input gives the same output (criterion 20)', P_M_D_B, () => {
      const a = pass(file, 'bundle');
      const b = pass(file, 'bundle');
      expect(JSON.stringify(b.model)).toBe(JSON.stringify(a.model));
      expect(JSON.stringify(allFindings(b))).toBe(JSON.stringify(allFindings(a)));
      expect(JSON.stringify(b.bundle)).toBe(JSON.stringify(a.bundle));
    });
  }
}

// ---- criterion 7 across the committed fixtures -----------------------------------------------

const synthesisFailed = readJson<{ fixtures: Record<string, { pointer: string; reason: string }[]> }>(
  join(specsDir, 'expected', 'synthesis-failed.json'),
).fixtures;

function synthesisCases(file: string): void {
  const listed = synthesisFailed[file];
  if (listed === undefined) return;
  engineCase(`synthesis-failed is exactly the ${listed.length} listed case(s), each with a written reason (criterion 7)`, P_M_D_B, () => {
    const got = pass(file, 'bundle').bundleFindings.filter((f) => f.code === 'synthesis-failed');
    expect(got.map((f) => f.location.pointer).sort()).toEqual(listed.map((c) => c.pointer).sort());
  });
}

// ---- fixture-specific cases ------------------------------------------------------------------

function pageFile(p: Pass, path: string): Record<string, unknown> {
  const f = p.bundle.find((b) => b.path === `pages/${path}.json`);
  if (!f) throw new Error(`no page file pages/${path}.json; have ${p.bundle.map((b) => b.path).join(', ')}`);
  return JSON.parse(f.content) as Record<string, unknown>;
}

function hardSchemasCases(file: string): void {
  interface Exp { schemas: Record<string, {
    recursive?: boolean;
    variants?: { keyword: 'oneOf' | 'anyOf'; names: string[] } | null;
    discriminator?: { propertyName: string; values: Record<string, string> };
    merged?: { properties: string[]; required: string[] };
  }> }
  const exp = readJson<Exp>(join(specsDir, 'expected', 'hard-schemas.json'));
  for (const [id, s] of Object.entries(exp.schemas)) {
    if (s.recursive !== undefined) {
      engineCase(`${id}: NamedSchema.recursive is ${s.recursive} (criterion 2)`, P_M, () => {
        const model = pass(file, 'model').model;
        expect(model?.schemas.find((x) => x.id === id)?.recursive).toBe(s.recursive);
      });
    }
    if (s.discriminator) {
      const d = s.discriminator;
      engineCase(`${id}: the discriminator ${d.propertyName} selects ${Object.keys(d.values).join(', ')} (criterion 1)`, P_M, () => {
        const node = pass(file, 'model').model?.schemas.find((x) => x.id === id)?.schema;
        expect(node?.discriminator?.propertyName).toBe(d.propertyName);
        const got = Object.fromEntries((node?.discriminator?.mapping ?? []).map((x) => [x.value, x.schemaId]));
        expect(got).toEqual(d.values);
      });
    }
    if (s.merged) {
      const merged = s.merged;
      engineCase(`${id}: allOf shown as one merged property list (criterion 2)`, [...P_M, 'resolveSchemaView'], () => {
        const e = api();
        const model = pass(file, 'model').model;
        const named = model?.schemas.find((x) => x.id === id);
        if (!model || !named) throw new Error(`no schema ${id}`);
        const view = e.resolveSchemaView(model, named.schema, e.defaultLimits).node;
        expect(view.properties?.map((p) => p.name)).toEqual(merged.properties);
        expect(view.properties?.filter((p) => p.required).map((p) => p.name).sort()).toEqual([...merged.required].sort());
      });
    }
    if (s.variants !== undefined) {
      const v = s.variants;
      engineCase(`${id}: ${v === null ? 'shows no variants (nullable)' : `variants named ${v.names.join(', ')}`} (criterion 1)`, P_M_D_B, () => {
        const p = pass(file, 'bundle');
        const named = p.model?.schemas.find((x) => x.id === id);
        if (!p.model || !named) throw new Error(`no schema ${id}`);
        const page = pageFile(p, `schemas/${named.slug}`) as { schema: { node: SchemaNodeLike } };
        const node = page.schema.node;
        if (v === null) {
          expect(node.oneOf ?? node.anyOf).toBeUndefined();
          return;
        }
        const members = node[v.keyword] ?? [];
        // ADR 0003 "Variant names", applied to what the page file holds.
        const names = members.map((mem, i) => mem.kind === 'ref'
          ? (p.model?.schemas.find((x) => x.id === mem.schemaId)?.schema.title ?? mem.schemaId)
          : (mem.title ?? `Option ${i + 1}`));
        expect(names).toEqual(v.names);
      });
    }
  }
  pendingCase('getPet page: variant switchers, schema expanders and copy buttons operable by keyboard; zero WCAG 2.2 AA violations (criterion 22)', 'the renderer (kickoff step 6)');
}

function hostileCases(file: string): void {
  interface Str { pointer: string; kind: string; authored: unknown; safeForm?: string | null; escaped?: string;
    visibleIncludes?: string[]; visibleExcludes?: string[] }
  const exp = readJson<{ strings: Str[]; slugs: Record<'tags' | 'operations' | 'schemas', Record<string, string>> }>(
    join(specsDir, 'expected', 'hostile-content.json'));
  for (const s of exp.strings) {
    if (s.kind === 'markdown' && typeof s.authored === 'string') {
      const authored = s.authored;
      engineCase(`sanitizeMarkdown ${s.pointer}: ${s.safeForm === null ? 'the refused link leaves its text alone' : 'gives the hand-written safe form'} (criterion 19)`, ['sanitizeMarkdown'], () => {
        const e = api();
        const out = e.sanitizeMarkdown(authored);
        expect(out.fallback).toBe(false);
        if (typeof s.safeForm === 'string') expect(out.text).toBe(s.safeForm);
        for (const t of s.visibleIncludes ?? []) expect(out.text).toContain(t);
        for (const t of s.visibleExcludes ?? []) expect(out.text).not.toContain(t);
        expect(e.sanitizeMarkdown(out.text).text, 'the safe form is a fixed point').toBe(out.text);
      });
    }
    if (s.kind === 'text' && typeof s.authored === 'string' && s.escaped !== undefined) {
      const authored = s.authored;
      const escaped = s.escaped;
      engineCase(`escapeMarkdownText ${s.pointer} (criterion 19)`, ['escapeMarkdownText'], () => {
        expect(api().escapeMarkdownText(authored)).toBe(escaped);
      });
    }
  }
  engineCase('slugs of hostile names keep ASCII a-z0-9 runs only (ADR 0002)', P_M, () => {
    const model = pass(file, 'model').model;
    expect(Object.fromEntries(model?.tags.map((t) => [t.name, t.slug]) ?? [])).toEqual(exp.slugs.tags);
    expect(Object.fromEntries(model?.operations.map((o) => [o.id, o.slug]) ?? [])).toEqual(exp.slugs.operations);
    expect(Object.fromEntries(model?.schemas.map((x) => [x.id, x.slug]) ?? [])).toEqual(exp.slugs.schemas);
  });
  engineCase('every twin parses with no html, image, imageReference or definition node, and every link is allowed (criterion 19)', [...P_M_D_B, 'parseMarkdown', 'linkDestinationAllowed'], () => {
    const e = api();
    const twins = pass(file, 'bundle').bundle.filter((b) => b.path.startsWith('static/') && b.path.endsWith('.md'));
    expect(twins.length).toBeGreaterThan(0);
    const bad: string[] = [];
    const visit = (node: unknown, path: string): void => {
      const n = node as { type?: string; url?: string; children?: unknown[] };
      if (n.type === 'html' || n.type === 'image' || n.type === 'imageReference' || n.type === 'definition') bad.push(`${path}: ${n.type}`);
      if (n.type === 'link' && n.url !== undefined && !n.url.endsWith('.md') && !e.linkDestinationAllowed(n.url)) bad.push(`${path}: link ${n.url}`);
      for (const c of n.children ?? []) visit(c, path);
    };
    for (const t of twins) visit(e.parseMarkdown(t.content), t.path);
    expect(bad).toEqual([]);
  });
  pendingCase('built pages and twins: no script, no on* attribute, no javascript:/data: URL, no remote image or request (criterion 19)', 'the renderer (kickoff step 6); security reviewer sign-off');
}

function hostVariableCases(file: string): void {
  interface Row { index: number; url: string; withList: Mode; strict: Mode }
  interface Mode { callable: boolean; fix: { format: string; variable: string } | null }
  const exp = readJson<{ servers: Row[]; fixTemplate: { title: string; input: { name: string; label: string; list: { maxItems: number } } } }>(
    join(specsDir, 'expected', 'host-variables.json'));
  const atServer = (f: Finding, i: number): boolean =>
    f.location.pointer === `/servers/${i}` || f.location.pointer.startsWith(`/servers/${i}/`);
  for (const mode of ['withList', 'strict'] as const) {
    for (const row of exp.servers) {
      const want = row[mode];
      const label = `${mode === 'withList' ? 'with the Public Suffix List' : 'publicSuffixes: null'}: ${row.url} is ${want.callable ? 'callable' : 'not callable'}${want.fix ? `, fix offered (${want.fix.format})` : ''} (criterion 29)`;
      engineCase(label, mode === 'withList' ? [...P_M_D, 'parsePublicSuffixList'] : P_M_D, () => {
        const p = pass(file, 'doctor', mode === 'withList' ? publicSuffixes() : null);
        const got = p.doctor.filter((f) => f.code === 'server-not-callable' && atServer(f, row.index));
        expect(got.map(describeFinding)).toHaveLength(want.callable ? 0 : 1);
        const f = got[0];
        if (!f) return;
        if (want.fix === null) {
          expect(f.fixes).toEqual([]);
          return;
        }
        expect(f.fixes).toHaveLength(1);
        const fix = f.fixes[0];
        const v = `/servers/${row.index}/variables/${want.fix.variable}`;
        expect(fix?.title).toBe(exp.fixTemplate.title);
        expect(fix?.confidence).toBe('review');
        expect(fix?.inputs.map((i) => ({ name: i.name, label: i.label, format: i.format, maxItems: i.list?.maxItems })))
          .toEqual([{ name: exp.fixTemplate.input.name, label: exp.fixTemplate.input.label, format: want.fix.format, maxItems: exp.fixTemplate.input.list.maxItems }]);
        expect(fix?.patch.ops.map((o) => `${o.op} ${o.path}`)).toEqual([
          `test /servers/${row.index}/url`, `test ${v}`, `add ${v}/enum`, `add ${v}/default`]);
      }, { extra: mode === 'withList' ? pslMissing : null });
    }
  }
}

function unsatisfiableCases(file: string): void {
  const exp = readJson<{ sampleValues: { operationId: string; in: string; name: string; origin: string;
    uncheckedIncludes: string[]; looksLike?: string }[] }>(join(specsDir, 'expected', 'unsatisfiable-schemas.json'));
  for (const sv of exp.sampleValues) {
    engineCase(`${sv.operationId}: the ${sv.in} value ${sv.name} is ${sv.origin}${sv.uncheckedIncludes.length ? `, ${sv.uncheckedIncludes.join(', ')} not checked` : ''} (criterion 7)`, P_M_D_B, () => {
      const p = pass(file, 'bundle');
      const op = p.model?.operations.find((o) => o.id === sv.operationId);
      if (!op) throw new Error(`no operation ${sv.operationId}`);
      const page = pageFile(p, `operations/${op.slug}`) as { sampleValues: { in: string; name: string; origin: string; unchecked: string[] }[] };
      const v = page.sampleValues.find((x) => x.in === sv.in && x.name === sv.name);
      expect(v?.origin).toBe(sv.origin);
      for (const k of sv.uncheckedIncludes) expect(v?.unchecked).toContain(k);
    });
    if (sv.looksLike === 'email') {
      engineCase(`${sv.operationId}: the synthesized email looks like an email and validates (criterion 7)`, [...P_M, 'synthesizeExample', 'validateValue'], () => {
        const e = api();
        const model = pass(file, 'model').model;
        const schema = model?.operations.find((o) => o.id === sv.operationId)?.parameters.find((x) => x.name === sv.name)?.schema;
        if (!model || !schema) throw new Error('no schema');
        const { value } = e.synthesizeExample(model, schema, e.defaultLimits);
        expect(value).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
        expect(e.validateValue(model, schema, value, e.defaultLimits).errors).toEqual([]);
      });
    }
  }
}

function unicodeCases(file: string): void {
  const exp = readJson<{
    operations: { method: string; path: string; id: string; idSource: string; slug: string }[];
    tags: { name: string; slug: string }[];
    schemas: { id: string; slug: string }[];
  }>(join(specsDir, 'expected', 'unicode-text.json'));
  engineCase('operation ids and slugs follow ADR 0002 and contract 1.1 (criterion 33(d))', P_M, () => {
    const model = pass(file, 'model').model;
    const got = model?.operations.map((o) => ({ method: o.method, path: o.path, id: o.id, idSource: o.idSource, slug: o.slug }));
    expect(got).toEqual(exp.operations.map((o) => ({ method: o.method, path: o.path, id: o.id, idSource: o.idSource, slug: o.slug })));
  });
  engineCase('tag and schema slugs: x, then x-2 in code point order (criterion 33(d))', P_M, () => {
    const model = pass(file, 'model').model;
    expect(model?.tags.map((t) => ({ name: t.name, slug: t.slug }))).toEqual(exp.tags.map((t) => ({ name: t.name, slug: t.slug })));
    expect(model?.schemas.map((s) => ({ id: s.id, slug: s.slug }))).toEqual(exp.schemas.map((s) => ({ id: s.id, slug: s.slug })));
  });
  engineCase('every description is unchanged by sanitizeMarkdown and every name and summary by escapeMarkdownText (criterion 33)', ['sanitizeMarkdown', 'escapeMarkdownText'], () => {
    const e = api();
    const doc = JSON.parse(readSpecText(file)) as unknown;
    const changed: string[] = [];
    const walk = (v: unknown, key: string): void => {
      if (typeof v === 'string') {
        if (key === 'description') {
          const r = e.sanitizeMarkdown(v);
          if (r.text !== v || r.fallback) changed.push(`description: ${v}`);
        } else if (key === 'summary' || key === 'name' || key === 'operationId' || key === 'title') {
          if (e.escapeMarkdownText(v) !== v) changed.push(`${key}: ${v}`);
        }
      } else if (Array.isArray(v)) v.forEach((x) => walk(x, key === 'enum' || key === 'tags' ? 'name' : ''));
      else if (v !== null && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          if (key === 'properties' || key === 'schemas') walk(k, 'name');
          walk(x, k);
        }
      }
    };
    walk(doc, '');
    expect(changed).toEqual([]);
  });
  pendingCase('every string appears with the same code points in page files, twins, llms.txt and the DOM; UTF-8 without BOM; meta charset; no U+FFFD (criterion 33(a), (b))', 'buildPortalBundle and the renderer (kickoff steps 3.5 and 6)');
  pendingCase('bidi isolation of tenant text; data-ez-bidi on each control; none in <title>, <meta> or attributes (criterion 33(c), (h))', 'the renderer (kickoff step 6)');
  pendingCase('no sample in any language and no twin Example request holds a rule 3(b) code point; percent-escapes upper case (criterion 33(f), (h))', 'buildRequest and renderSample (kickoff step 3.4)');
  pendingCase('copy button copies the same code points as shown (criterion 33(g))', 'the renderer (kickoff step 6)');
}

/** Criteria 13, 14 and 33(f), (i): samples run against the local mock. Not engine work. */
function mockCases(entry: ManifestEntry): void {
  const name = entry.expected ?? '';
  const exp = readJson<{ requests: { operationId: string; shape?: string; status: number }[] }>(join(specsDir, name));
  for (const r of exp.requests) {
    pendingCase(`${r.operationId}${r.shape ? ` (${r.shape})` : ''}: each of the 8 samples passes its syntax check and, run against the mock, sends the expected request; status ${r.status} (criteria 13, 14${entry.file === 'unicode-text.json' ? ', 33' : ''})`,
      'buildRequest and renderSample (kickoff step 3.4), the local mock (kickoff step 4) and the 8 toolchains; this case moves to the publisher tests with the mock');
  }
}

// ---- registration ----------------------------------------------------------------------------

describe('fixture harness', () => {
  for (const entry of manifest.fixtures) {
    describe(entry.file, () => {
      if (entry.fetchOnly && !largePresent(entry.file)) {
        pendingCase('engine pass on this fetch-only fixture', `${entry.file} not downloaded; run fixtures/specs/fetch.sh`);
        return;
      }
      commonCases(entry);
      synthesisCases(entry.file);
      const exp = entry.set === 'broken' ? null : readJsonIf<{ findings?: ExpectedFindings }>(entry.expected);
      if (exp?.findings) expectedFindingCases(entry.file, exp.findings);
      if (entry.file === 'hard-schemas.yaml') hardSchemasCases(entry.file);
      if (entry.file === 'qa/hostile-content.yaml') hostileCases(entry.file);
      if (entry.file === 'qa/host-variables.yaml') hostVariableCases(entry.file);
      if (entry.file === 'qa/unsatisfiable-schemas.yaml') unsatisfiableCases(entry.file);
      if (entry.file === 'unicode-text.json') unicodeCases(entry.file);
      if (entry.firstServerIsMock) mockCases(entry);
    });
  }

  describe('generated documents over a parsing limit (criterion 5)', () => {
    for (const d of oversizeDocuments()) {
      engineCase(`${d.name}: limit-exceeded, fatal, nothing parsed past the limit`, P_M, () => {
        const e = api();
        const root = e.parseDocument({ uri: d.uri, text: d.text(), ...(d.bytes === undefined ? {} : { bytes: d.bytes }) }, e.defaultLimits);
        const { model, findings } = e.buildModel({ root, documents: [] });
        expect(model).toBeNull();
        const hit = findings.filter((f) => f.code === 'limit-exceeded');
        expect(hit.map(describeFinding)).toHaveLength(1);
        expect(hit[0]?.severity).toBe('error');
      }, { timeout: 60_000 });
    }
  });
});

function readJsonIf<T>(rel: string | null): T | null {
  return rel === null ? null : readJson<T>(join(specsDir, ...rel.split('/')));
}
