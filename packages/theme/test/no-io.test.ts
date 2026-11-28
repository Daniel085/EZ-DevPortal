// ADR 0001 rule 4 applies to `@ezdp/theme` as it does to the engine: its source compiles with
// `"lib": ["ES2023"]` and `"types": []`. Each probe is type-checked with the compiler options of
// `packages/theme/tsconfig.json` and must fail. The engine's test covers the same ground in more
// detail, including its runtime dependencies.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function diagnosticsFor(name: string, body: string): string[] {
  const parsed = ts.getParsedCommandLineOfConfigFile(join(packageDir, 'tsconfig.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    },
  });
  if (!parsed) throw new Error('could not read tsconfig.json');
  const options: ts.CompilerOptions = {
    ...parsed.options,
    noEmit: true,
    composite: false,
    incremental: false,
    declaration: false,
    declarationMap: false,
    sourceMap: false,
  };
  const probeFile = join(packageDir, 'src', `__no_io_probe_${name}__.ts`);
  const text = "import type * as theme from './index.js';\nexport type T = typeof theme;\n" + body + '\n';
  const host = ts.createCompilerHost(options, true);
  const { fileExists, readFile, getSourceFile } = host;
  host.fileExists = (f) => f === probeFile || fileExists.call(host, f);
  host.readFile = (f) => (f === probeFile ? text : readFile.call(host, f));
  host.getSourceFile = (f, v, onError, create) =>
    f === probeFile ? ts.createSourceFile(f, text, v, true) : getSourceFile.call(host, f, v, onError, create);
  const program = ts.createProgram({ rootNames: [probeFile], options, host });
  return ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '));
}

describe('theme source cannot do I/O (ADR 0001 rule 4)', () => {
  it('compiles cleanly (control)', () => {
    expect(diagnosticsFor('control', 'export const ok = 1;')).toEqual([]);
  });

  const cases: [string, string, RegExp][] = [
    ['fetch', "void fetch('https://example.com');", /Cannot find name 'fetch'/],
    ['process', 'export const env = process.env;', /Cannot find name 'process'/],
    ['node_fs', "import * as fs from 'node:fs';\nexport const f = fs;", /Cannot find (?:module|name) 'node:fs'/],
    ['dom', 'export const d = document.title;', /Cannot find name 'document'/],
  ];
  for (const [name, body, error] of cases) {
    it(`rejects ${name}`, () => {
      expect(diagnosticsFor(name, body).join('\n')).toMatch(error);
    });
  }
});
