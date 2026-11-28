// ADR 0001 rule 4: engine source compiles with `"lib": ["ES2023"]` and `"types": []`, so I/O does
// not type-check. This test compiles small probe files with the compiler options of
// `packages/engine/tsconfig.json` and asserts that each forbidden use is a type error. If someone
// adds `DOM` to `lib`, adds `node` to `types`, or adds a dependency whose declarations pull in Node's
// globals, a probe stops failing and this test fails.
//
// Every probe first imports the engine's own entry and the type declarations of every runtime
// dependency (ADR 0001 rule 5), so a dependency that references Node's types is caught here too.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tsconfigPath = join(packageDir, 'tsconfig.json');

const runtimeDependencies = [
  'yaml',
  'mdast-util-from-markdown',
  'micromark-extension-gfm-table',
  'micromark-extension-gfm-task-list-item',
  'micromark-extension-gfm-strikethrough',
  'micromark-extension-gfm-footnote',
  'mdast-util-gfm-table',
  'mdast-util-gfm-task-list-item',
  'mdast-util-gfm-strikethrough',
  'mdast-util-gfm-footnote',
];

const preamble = [
  "import type * as engine from './index.js';",
  ...runtimeDependencies.map((name, i) => `import type * as dep${i} from '${name}';`),
  `export type Loaded = [typeof engine${runtimeDependencies.map((_, i) => `, typeof dep${i}`).join('')}];`,
  '',
].join('\n');

function engineOptions(overrides: ts.CompilerOptions = {}): ts.CompilerOptions {
  const parsed = ts.getParsedCommandLineOfConfigFile(tsconfigPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    },
  });
  if (!parsed) throw new Error(`could not read ${tsconfigPath}`);
  expect(parsed.errors).toEqual([]);
  return {
    ...parsed.options,
    noEmit: true,
    composite: false,
    incremental: false,
    declaration: false,
    declarationMap: false,
    sourceMap: false,
    ...overrides,
  };
}

interface ProbeResult {
  probeFile: string;
  diagnostics: { file: string | undefined; line: number; message: string }[];
}

/** Type-checks one in-memory file placed in `src/`, as if it were engine source. */
function check(name: string, body: string, overrides: ts.CompilerOptions = {}): ProbeResult {
  const options = engineOptions(overrides);
  const probeFile = join(packageDir, 'src', `__no_io_probe_${name}__.ts`);
  const text = preamble + body + '\n';
  const host = ts.createCompilerHost(options, true);
  const { fileExists, readFile, getSourceFile } = host;
  host.fileExists = (f) => f === probeFile || fileExists.call(host, f);
  host.readFile = (f) => (f === probeFile ? text : readFile.call(host, f));
  host.getSourceFile = (f, languageVersion, onError, shouldCreate) =>
    f === probeFile
      ? ts.createSourceFile(f, text, languageVersion, true)
      : getSourceFile.call(host, f, languageVersion, onError, shouldCreate);

  const program = ts.createProgram({ rootNames: [probeFile], options, host });
  const preambleLines = preamble.split('\n').length - 1;
  const diagnostics = ts.getPreEmitDiagnostics(program).map((d) => ({
    file: d.file?.fileName,
    line:
      d.file && d.start !== undefined
        ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 - preambleLines
        : 0,
    message: ts.flattenDiagnosticMessageText(d.messageText, ' '),
  }));
  return { probeFile, diagnostics };
}

const forbidden: { name: string; body: string; error: RegExp }[] = [
  { name: 'fetch', body: "void fetch('https://example.com');", error: /Cannot find name 'fetch'/ },
  {
    name: 'globalThis_fetch',
    body: "void globalThis.fetch('https://example.com');",
    error: /Property 'fetch' does not exist on type 'typeof globalThis'|type 'typeof globalThis' has no index signature/,
  },
  { name: 'process', body: 'export const env = process.env;', error: /Cannot find name 'process'/ },
  {
    name: 'node_fs',
    body: "import { readFileSync } from 'node:fs';\nexport const read = readFileSync;",
    error: /Cannot find (?:module|name) 'node:fs'/,
  },
  {
    name: 'bare_fs',
    body: "import * as fs from 'fs';\nexport const read = fs.readFileSync;",
    error: /Cannot find (?:module|name) 'fs'/,
  },
  {
    name: 'dynamic_fs',
    body: "export const load = () => import('node:fs/promises');",
    error: /Cannot find (?:module|name) 'node:fs\/promises'/,
  },
  { name: 'require', body: "export const fs = require('fs');", error: /Cannot find name 'require'/ },
  { name: 'buffer', body: "export const b = Buffer.from('x');", error: /Cannot find name 'Buffer'/ },
  {
    name: 'timer',
    body: 'export const t = setTimeout(() => undefined, 1);',
    error: /Cannot find name 'setTimeout'/,
  },
  { name: 'dom', body: 'export const d = document.title;', error: /Cannot find name 'document'/ },
];

describe('engine source cannot do I/O (ADR 0001 rule 4)', () => {
  it('compiles cleanly with the runtime dependencies imported (control)', () => {
    const { diagnostics } = check('control', 'export const ok: number = 1;');
    expect(diagnostics).toEqual([]);
  });

  for (const probe of forbidden) {
    it(`rejects ${probe.name}`, () => {
      const { probeFile, diagnostics } = check(probe.name, probe.body);
      expect(diagnostics.length).toBeGreaterThan(0);
      // Every error is in the probe body, none in the preamble or in a declaration file.
      for (const d of diagnostics) {
        expect(d.file).toBe(probeFile);
        expect(d.line).toBeGreaterThan(0);
      }
      expect(diagnostics.map((d) => d.message).join('\n')).toMatch(probe.error);
    });
  }

  it('would notice a regression: the same probes compile once DOM and Node types are added', () => {
    const loosened = { lib: ['lib.es2023.d.ts', 'lib.dom.d.ts'], types: ['node'] };
    for (const name of ['fetch', 'process', 'node_fs', 'dom']) {
      const probe = forbidden.find((p) => p.name === name);
      if (!probe) throw new Error(name);
      expect(check(`${name}_loosened`, probe.body, loosened).diagnostics).toEqual([]);
    }
  });
});
