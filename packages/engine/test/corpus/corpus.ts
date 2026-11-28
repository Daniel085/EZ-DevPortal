// The fixture corpus as tests see it: the manifest (fixtures/specs/corpus.json), discovery of the
// spec files on disk, the hand-written expected files, JSON Pointer lookup, and the tables in
// ADR 0004 that expected values are checked against. Tests may do I/O (ADR 0001, Fixtures); this
// module is test code and never reaches `dist/`.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument as parseYaml } from 'yaml';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
export const specsDir = join(repoRoot, 'fixtures', 'specs');
export const largeDir = join(specsDir, 'large');
export const pslFile = join(repoRoot, 'data', 'public-suffix-list', 'public_suffix_list.dat');
export const mockServerUrl = 'http://127.0.0.1:14010';

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export interface ManifestEntry {
  file: string;
  set: 'all' | 'broken' | 'qa';
  origin: 'third-party' | 'in-house';
  license: string;
  licenseFile: string | null;
  fetchOnly: boolean;
  format: 'yaml' | 'json';
  parses: boolean;
  firstServerIsMock: boolean;
  criteria: number[];
  expected: string | null;
}

export interface Manifest {
  allFixturesCriteria: number[];
  generated: { name: string; criteria: number[]; helper: string }[];
  fixtures: ManifestEntry[];
}

/** One expected finding. `pointer: null` means the pointer is not asserted. */
export interface ExpectedFinding {
  code: string;
  severity: 'error' | 'warning' | 'info';
  pointer: string | null;
  pointerAlternatives?: string[];
  rule: string;
}

/** An entry of `exactCodes`: a pointer, or an object when alternatives or no pointer apply. */
export type ExactEntry = string | { pointer: string | null; alternatives?: string[]; subject?: string };

export interface ExpectedFindings {
  includes: ExpectedFinding[];
  exactCodes: Record<string, ExactEntry[]>;
}

export interface MalformedExpectation {
  stage: 'parse' | 'structure' | 'resolve' | 'semantic';
  fault: string;
  pointer: string | null;
  code: string;
  severity: 'error' | 'warning';
  fatal: boolean;
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function loadManifest(): Manifest {
  return readJson<Manifest>(join(specsDir, 'corpus.json'));
}

export function specPath(file: string): string {
  return join(specsDir, ...file.split('/'));
}

export function readSpecText(file: string): string {
  return readFileSync(specPath(file), 'utf8');
}

export function readSpecBytes(file: string): Buffer {
  return readFileSync(specPath(file));
}

/** The root document's `uri`: the file's base name, as the CLI gives it (ADR 0003, step 1). */
export function uriOf(file: string): string {
  return file.split('/').at(-1) ?? file;
}

export function loadMalformedExpected(): Record<string, MalformedExpectation> {
  const all = readJson<Record<string, MalformedExpectation | string>>(
    join(specsDir, 'malformed', 'expected.json'),
  );
  const out: Record<string, MalformedExpectation> = {};
  for (const [k, v] of Object.entries(all)) if (typeof v !== 'string') out[k] = v;
  return out;
}

/** The expected file of a fixture outside `broken` (whose expectations are malformed/expected.json). */
export function loadExpected<T>(entry: ManifestEntry): T | null {
  if (!entry.expected || entry.set === 'broken') return null;
  return readJson<T>(join(specsDir, ...entry.expected.split('/')));
}

/** Files that are not spec documents, relative to fixtures/specs. */
function isSpecFile(rel: string): boolean {
  if (!/\.(ya?ml|json)$/.test(rel)) return false;
  if (rel === 'corpus.json' || rel === 'malformed/expected.json') return false;
  if (rel.startsWith('expected/') || rel.startsWith('licenses/')) return false;
  return true;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function relToSpecs(full: string): string {
  return relative(specsDir, full).split(sep).join('/');
}

/** Every file under fixtures/specs, committed or downloaded, relative and with `/`. */
export function allFiles(): string[] {
  return walk(specsDir).map(relToSpecs).sort();
}

/** Spec files found on disk. `large/` is included when it has been downloaded. */
export function discoverSpecFiles(): string[] {
  return allFiles().filter(isSpecFile);
}

export function largePresent(file: string): boolean {
  return existsSync(specPath(file));
}

export function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** RFC 6901 lookup by own properties. Returns `{ found: false }` when any segment is missing. */
export function resolvePointer(doc: unknown, pointer: string): { found: boolean; value?: unknown } {
  if (pointer === '') return { found: true, value: doc };
  if (!pointer.startsWith('/')) return { found: false };
  let cur: unknown = doc;
  for (const raw of pointer.slice(1).split('/')) {
    const seg = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (Array.isArray(cur)) {
      if (!/^(0|[1-9][0-9]*)$/.test(seg) || Number(seg) >= cur.length) return { found: false };
      cur = cur[Number(seg)];
    } else if (cur !== null && typeof cur === 'object' && Object.hasOwn(cur, seg)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return { found: false };
    }
  }
  return { found: true, value: cur };
}

export function pointerOf(...segments: (string | number)[]): string {
  return segments.map((s) => '/' + String(s).replace(/~/g, '~0').replace(/\//g, '~1')).join('');
}

/** Parses a fixture as data with the `yaml` package (YAML 1.2, which reads JSON too). */
export function parseAsData(text: string): { ok: boolean; value: unknown; errors: string[] } {
  const doc = parseYaml(text, { uniqueKeys: true, prettyErrors: false });
  const errors = doc.errors.map((e) => e.message);
  return {
    ok: errors.length === 0,
    value: errors.length === 0 ? doc.toJS({ maxAliasCount: -1 }) : undefined,
    errors,
  };
}

/** Lines of SHA256SUMS as [hash, path]. */
export function readSha256Sums(): [string, string][] {
  return readFileSync(join(specsDir, 'SHA256SUMS'), 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => {
      const m = l.match(/^([0-9a-f]{64}) {2}(.+)$/);
      if (!m || !m[1] || !m[2]) throw new Error(`SHA256SUMS: malformed line: ${l}`);
      return [m[1], m[2]];
    });
}

/** The pinned hashes of the fetch-only specs, read from fetch.sh (`name|sha256|url`). */
export function readFetchPins(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(join(specsDir, 'fetch.sh'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Za-z0-9._-]+)\|([0-9a-f]{64})\|(https:\/\/|\$raw\/)/);
    if (m && m[1] && m[2]) out[m[1]] = m[2];
  }
  return out;
}

// ---- ADR 0004 tables -------------------------------------------------------------------------
// Expected values are checked against the ADR's own text, so a change to the ADR that the
// fixtures do not follow fails a test instead of drifting.

const adr0004 = (): string =>
  readFileSync(join(repoRoot, 'docs', 'adr', '0004-spec-doctor-findings-and-fixes.md'), 'utf8');

function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function codesIn(cell: string): string[] {
  return [...cell.matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1] ?? '');
}

export interface RuleRow { code: string; severity: 'error' | 'warning' | 'info'; by: string }

/** "The M1 rule table": every code M1 can emit, its severity and which function reports it. */
export function adrRuleTable(): Map<string, RuleRow> {
  const lines = adr0004().split('\n');
  const start = lines.findIndex((l) => l.startsWith('| Code | Severity | Trigger | Fix | By |'));
  if (start < 0) throw new Error('ADR 0004: rule table not found');
  const out = new Map<string, RuleRow>();
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break;
    const cells = tableCells(line);
    const severity = cells[1];
    const by = cells.at(-1) ?? '';
    if (severity !== 'error' && severity !== 'warning' && severity !== 'info') {
      throw new Error(`ADR 0004 rule table: unreadable row: ${line}`);
    }
    for (const code of codesIn(cells[0] ?? '')) out.set(code, { code, severity, by });
  }
  return out;
}

/** "Fatal and degrading faults": the code each of the 16 malformed fixtures must produce. */
export function adrMalformedCodes(): Map<string, string> {
  const lines = adr0004().split('\n');
  const start = lines.findIndex((l) => /^\s*\| Code \| Fixtures \|$/.test(l));
  if (start < 0) throw new Error('ADR 0004: malformed code table not found');
  const out = new Map<string, string>();
  for (const line of lines.slice(start + 2)) {
    if (!line.trim().startsWith('|')) break;
    const cells = tableCells(line);
    const code = codesIn(cells[0] ?? '')[0];
    if (!code) throw new Error(`ADR 0004 code table: unreadable row: ${line}`);
    for (const m of (cells[1] ?? '').matchAll(/`([^`]+)`/g)) out.set(m[1] ?? '', code);
  }
  return out;
}

/** The fatal codes: the closed list of four in "Fatal and degrading faults". */
export function adrFatalCodes(): string[] {
  const lines = adr0004().split('\n');
  const start = lines.findIndex((l) => /^\s*\| Code \| Fault \| Stage in `expected.json` \|$/.test(l));
  if (start < 0) throw new Error('ADR 0004: fatal code table not found');
  const out: string[] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.trim().startsWith('|')) break;
    const code = codesIn(tableCells(line)[0] ?? '')[0];
    if (code) out.push(code);
  }
  return out;
}

export interface WorkedExample { url: string; callable: boolean; fix: 'none' | 'offered'; text: string }

/** The worked-examples table of "The fix for an open host variable", in order. */
export function adrWorkedExamples(): WorkedExample[] {
  const lines = adr0004().split('\n');
  const start = lines.findIndex((l) => l.startsWith('| Server URL | Result | Why | Fix |'));
  if (start < 0) throw new Error('ADR 0004: worked-examples table not found');
  const out: WorkedExample[] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break;
    const cells = tableCells(line);
    const url = (cells[0] ?? '').match(/`([^`]+)`/)?.[1];
    const result = cells[1];
    if (!url || (result !== 'Callable' && result !== 'Not callable')) {
      throw new Error(`ADR 0004 worked examples: unreadable row: ${line}`);
    }
    const fixCell = cells[3] ?? '';
    out.push({
      url,
      callable: result === 'Callable',
      fix: fixCell.startsWith('Offered') ? 'offered' : 'none',
      text: line,
    });
  }
  return out;
}
