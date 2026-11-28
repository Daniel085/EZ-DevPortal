// ADR 0001 rules 1, 3 and 4, and ADR 0003 "Schema validation", as ESLint enforces them on engine
// source. Each snippet is linted as if it were a file in `packages/engine/src/`, with the
// workspace's real `eslint.config.js`.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const eslint = new ESLint({ cwd: repoRoot });

async function ruleIds(code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, {
    filePath: join(repoRoot, 'packages', 'engine', 'src', '__lint_probe__.ts'),
  });
  if (!result) throw new Error('no lint result');
  return result.messages.map((m) => m.ruleId ?? `fatal: ${m.message}`);
}

const banned: [string, string, string][] = [
  ['Date construction', 'export const d = new Date();', 'no-restricted-globals'],
  ['Date.now', 'export const n = Date.now();', 'no-restricted-globals'],
  ['Math.random', 'export const r = Math.random();', 'no-restricted-properties'],
  ['console', "console.log('x');", 'no-restricted-globals'],
  ['globalThis', 'export const g = globalThis;', 'no-restricted-globals'],
  ['node:fs', "import 'node:fs';", 'no-restricted-imports'],
  ['bare fs', "import 'fs';", 'no-restricted-imports'],
  ['bare fs/promises', "import 'fs/promises';", 'no-restricted-imports'],
  ['a workspace package', "import '@ezdp/theme';", 'no-restricted-imports'],
  ['a deep import', "import '@ezdp/engine/src/index.js';", 'no-restricted-imports'],
  ['a relative path into another package', "import '../../theme/src/index.js';", 'no-restricted-imports'],
  ['new RegExp', "export const make = (s: string) => new RegExp(s);", 'no-restricted-syntax'],
  ['RegExp call', "export const make = (s: string) => RegExp(s);", 'no-restricted-syntax'],
  ['toLowerCase', "export const f = (s: string) => s.toLowerCase();", 'no-restricted-syntax'],
  ['toUpperCase', "export const f = (s: string) => s.toUpperCase();", 'no-restricted-syntax'],
  ['toLocaleLowerCase', "export const f = (s: string) => s.toLocaleLowerCase();", 'no-restricted-syntax'],
  ['toLocaleUpperCase', "export const f = (s: string) => s['toLocaleUpperCase']();", 'no-restricted-syntax'],
];

describe('engine source lint bans', () => {
  it('accepts plain code (control)', async () => {
    expect(await ruleIds('export const literal = /^[a-z]+$/u;\n')).toEqual([]);
  });

  for (const [what, code, rule] of banned) {
    it(`bans ${what}`, async () => {
      expect(await ruleIds(code + '\n')).toContain(rule);
    });
  }
});
