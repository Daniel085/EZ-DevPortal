// The engine's public interface as ADR 0003 names it, read from the engine's own entry at run
// time, so the fixture harness works before the engine exists and picks each function up as it
// lands. A case that needs a function the engine does not export yet is registered with
// `it.todo` and a label naming what is missing: Vitest counts it as "todo", never as passed.
//
// The types below are the parts of ADR 0002 to 0005 the harness reads. They are loose on purpose
// (fields the harness does not read are left out); when the engine exports its own types, this
// file should import them instead.
import { it } from 'vitest';
import * as engineModule from '../../src/index.js';
import type { Json } from './corpus.js';

export interface FindingLocation {
  uri: string;
  pointer: string;
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface FixInput {
  name: string;
  label: string;
  pointer: string;
  format?: 'host-name' | 'host-suffix';
  list?: { maxItems: number; firstPointer: string };
}

export interface PatchOp { op: string; path: string; value?: Json }

export interface Fix {
  id: string;
  title: string;
  confidence: 'safe' | 'review';
  inputs: FixInput[];
  patch: { uri: string; ops: PatchOp[] };
}

export interface Finding {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location: FindingLocation;
  related: FindingLocation[];
  fingerprint: string;
  fixes: Fix[];
}

export interface ParsedDocument { readonly uri: string; readonly findings: Finding[] }

export type Limits = Record<string, number>;

export interface SchemaNodeLike {
  kind: 'schema' | 'ref';
  schemaId?: string;
  title?: string;
  properties?: { name: string; required: boolean }[];
  oneOf?: SchemaNodeLike[];
  anyOf?: SchemaNodeLike[];
  types?: string[];
  discriminator?: { propertyName: string; mapping: { value: string; schemaId: string }[] };
}

export interface ModelLike {
  operations: { id: string; idSource: string; slug: string; method: string; path: string;
    parameters: { name: string; in: string; schema?: SchemaNodeLike }[] }[];
  tags: { id: string; slug: string; name: string }[];
  schemas: { id: string; slug: string; recursive: boolean; schema: SchemaNodeLike }[];
}

export interface BundleFile { path: string; mediaType: string; content: string }

export interface EngineApi {
  defaultLimits: Limits;
  parseDocument(input: { uri: string; text: string; bytes?: number }, limits: Limits): ParsedDocument;
  buildModel(input: { root: ParsedDocument; documents: ParsedDocument[]; fetchedHash?: string;
    publishedHash?: string }): { model: ModelLike | null; findings: Finding[] };
  diagnose(model: ModelLike, docs: ParsedDocument[],
    options: { publicSuffixes: unknown; limits: Limits }): Finding[];
  parsePublicSuffixList(text: string): unknown;
  resolveSchemaView(model: ModelLike, schema: SchemaNodeLike, limits: Limits):
    { node: SchemaNodeLike; findings: Finding[] };
  synthesizeExample(model: ModelLike, schema: SchemaNodeLike, limits: Limits): { value: Json; findings: Finding[] };
  validateValue(model: ModelLike, schema: SchemaNodeLike, value: Json, limits: Limits):
    { errors: unknown[]; unchecked: unknown[]; truncated: boolean };
  buildRequest(model: ModelLike, operationId: string, values: undefined, options: { limits: Limits }): unknown;
  renderSample(request: unknown, language: string): unknown;
  buildPortalBundle(model: ModelLike, report: { findings: Finding[]; notApplied: unknown[] },
    options: { languages: string[]; limits: Limits }): { bundle: { bundleVersion: 1; files: BundleFile[] };
      findings: Finding[] };
  parseMarkdown(text: string): unknown;
  sanitizeMarkdown(text: string): { text: string; fallback: boolean };
  escapeMarkdownText(text: string): string;
  linkDestinationAllowed(destination: string): boolean;
}

export type EngineName = keyof EngineApi;

/** What the engine exports today, typed as the interface it will have. */
export const engine = engineModule as unknown as Partial<EngineApi>;

/** The eight languages in the order of `SampleLanguage` (ADR 0005; ADR 0003, the build's step 2). */
export const languages = ['curl', 'javascript', 'python', 'go', 'java', 'csharp', 'php', 'ruby'];

export function missing(needs: readonly EngineName[]): EngineName[] {
  return needs.filter((n) => engine[n] === undefined);
}

/** Narrows `engine` once `missing` has returned nothing. */
export function api(): EngineApi {
  return engine as EngineApi;
}

const pendingPrefix = '[pending: ';

/**
 * Registers a case that runs once the engine exports every function in `needs`, and is a todo
 * until then. `extra` names any other precondition that is not met (a vendored data file, a
 * downloaded fixture); it makes the case a todo too.
 */
export function engineCase(
  name: string,
  needs: readonly EngineName[],
  body: () => void,
  options: { extra?: string | null; timeout?: number } = {},
): void {
  const absent = missing(needs);
  const reasons = [
    ...(absent.length > 0 ? [`engine lacks ${absent.join(', ')}`] : []),
    ...(options.extra ? [options.extra] : []),
  ];
  if (reasons.length > 0) it.todo(`${name} ${pendingPrefix}${reasons.join('; ')}]`);
  else it(name, body, options.timeout);
}

/** A case that is pending on something that is not an engine function. */
export function pendingCase(name: string, reason: string): void {
  it.todo(`${name} ${pendingPrefix}${reason}]`);
}
