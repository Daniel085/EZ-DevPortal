// ESLint flat config for the workspace (ADR 0001).
//
// Rule 3: imports cross a package boundary only through the package's `exports` entry.
// Rule 1: dependency direction is one way.
// Rule 4: `engine` and `theme` source may not use `Date`, `Math.random`, `console` or `node:*`.
// ADR 0003, "Schema validation": the engine never builds a RegExp from a non-literal.
//
// `no-restricted-imports` is replaced, not merged, by a later block that matches the same file, so
// every block below states the full list for the files it covers.
import { builtinModules } from 'node:module';
import tseslint from 'typescript-eslint';

const deepImports = [
  {
    regex: '^@ezdp/[^/]+/',
    message: 'Import a workspace package through its exports entry only (ADR 0001 rule 3).',
  },
  {
    regex: '^(\\.\\./)+(packages|apps)/',
    message: 'Do not reach into another package by relative path (ADR 0001 rule 3).',
  },
  {
    regex: '^(\\.\\./){2,}(engine|theme|publisher|portal)(/|$)',
    message: 'Do not reach into another package by relative path (ADR 0001 rule 3).',
  },
];

const workspace = (names, why) =>
  names.map((name) => ({ name: `@ezdp/${name}`, message: why }));

const nodeBuiltins = [
  { regex: '^node:', message: 'No Node built-ins in engine or theme source (ADR 0001 rule 4).' },
  {
    regex: `^(${builtinModules.filter((m) => !m.startsWith('_')).map((m) => m.replace(/[/]/g, '\\/')).join('|')})(/|$)`,
    message: 'No Node built-ins in engine or theme source (ADR 0001 rule 4).',
  },
];

const restrictImports = ({ paths = [], patterns = [] } = {}) => [
  'error',
  { paths, patterns: [...deepImports, ...patterns] },
];

const pureRule = 'Engine and theme are pure: no I/O, clock, randomness or logging (ADR 0001 rule 4).';
const pureLibraryRules = {
  'no-restricted-globals': [
    'error',
    ...['Date', 'console', 'process', 'fetch', 'require', 'Buffer', 'setTimeout', 'setInterval',
      'setImmediate', 'queueMicrotask', 'performance', 'crypto', 'XMLHttpRequest', 'WebSocket',
      'window', 'document', 'navigator', 'globalThis'].map((name) => ({ name, message: pureRule })),
  ],
  'no-restricted-properties': [
    'error',
    { object: 'Math', property: 'random', message: pureRule },
  ],
};

const pureEverywhere = 'Nothing depends on portal or publisher (ADR 0001 rules 1 and 2).';
const pureLibrary = 'Engine and theme depend on no workspace package (ADR 0001 rule 1).';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.venv/**',
      '**/dist/**',
      'apps/portal/.next/**',
      'apps/portal/out/**',
      'docs/**',
      'fixtures/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-restricted-imports': restrictImports({
        paths: workspace(['portal', 'publisher'], pureEverywhere),
      }),
    },
  },
  {
    files: ['packages/engine/**', 'packages/theme/**'],
    rules: {
      'no-restricted-imports': restrictImports({
        paths: workspace(['engine', 'theme', 'publisher', 'portal'], pureLibrary),
      }),
    },
  },
  {
    files: ['packages/engine/src/**', 'packages/theme/src/**'],
    rules: {
      ...pureLibraryRules,
      'no-restricted-imports': restrictImports({
        paths: workspace(['engine', 'theme', 'publisher', 'portal'], pureLibrary),
        patterns: nodeBuiltins,
      }),
    },
  },
  {
    files: ['packages/engine/src/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='RegExp']",
          message: 'The engine never constructs a RegExp; use a literal (ADR 0003, "Schema validation").',
        },
        {
          selector: "CallExpression[callee.name='RegExp']",
          message: 'The engine never constructs a RegExp; use a literal (ADR 0003, "Schema validation").',
        },
      ],
    },
  },
  {
    files: ['packages/publisher/**'],
    rules: {
      'no-restricted-imports': restrictImports({
        paths: [
          ...workspace(['portal', 'publisher'], pureEverywhere),
          ...workspace(['theme'], 'The publisher depends on the engine only (ADR 0001 rule 1).'),
        ],
      }),
    },
  },
  {
    files: ['apps/portal/**'],
    rules: {
      'no-restricted-imports': restrictImports({
        paths: workspace(['portal', 'publisher'], pureEverywhere),
      }),
    },
  },
);
