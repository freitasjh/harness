import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const HELP = `Uso: node scripts/collect.mjs [opções]

Coleta um inventário somente leitura do repositório. Nunca imprime conteúdo
de arquivos suspeitos nem valores de segredos.

Opções:
  --root DIR              Raiz do repositório (padrão: .)
  --max-files N           Limite de arquivos varridos (padrão: 400)
  --format FORMATO        json | md (padrão: json)
  --out ARQUIVO           Escreve em ARQUIVO em vez de stdout
  --help                  Mostra esta ajuda

Exit codes:
  0 sucesso · 2 argumento inválido · 3 raiz inexistente · 4 falha ao escrever

Exemplo:
  node scripts/collect.mjs --root . --max-files 500 --out /tmp/inventario.json
`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(HELP);
  process.exit(0);
}

function fail(message, code = 2) {
  process.stderr.write(`Erro: ${message}\nUse --help para ver as opções.\n`);
  process.exit(code);
}

const parsed = {};
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (!arg.startsWith('--')) fail(`argumento inesperado: ${arg}`);
  const name = arg.slice(2);
  if (!['root', 'max-files', 'format', 'out'].includes(name)) fail(`opção desconhecida: ${arg}`);
  const next = args[index + 1];
  if (!next || next.startsWith('--')) fail(`--${name} requer um valor`);
  parsed[name] = next;
  index += 1;
}

const rootPath = resolve(parsed.root || '.');
if (!existsSync(rootPath) || !statSync(rootPath).isDirectory()) {
  fail(`raiz não é um diretório existente: ${rootPath}`, 3);
}

const maxFiles = Number(parsed['max-files'] || 400);
if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 10000) {
  fail('--max-files deve ser inteiro entre 1 e 10000');
}

const format = parsed.format || 'json';
if (!['json', 'md'].includes(format)) fail('--format deve ser json ou md');

const skipDirs = new Set([
  '.git', 'node_modules', 'vendor', 'dist', 'build', 'coverage',
  '.venv', 'venv', 'target', 'out', '.idea', '.vscode'
]);

const categories = {
  rules: [/(^|\/)AGENTS\.md$/, /(^|\/)CLAUDE\.md$/, /(^|\/)\.cursorrules$/,
    /(^|\/)\.agents\/rules\//, /(^|\/)\.kiro\/steering\//, /(^|\/)\.windsurf\/rules\//,
    /(^|\/)\.github\/copilot-instructions\.md$/],
  manifests: [/(^|\/)package\.json$/, /(^|\/)pyproject\.toml$/, /(^|\/)requirements[^\/]*\.txt$/,
    /(^|\/)pom\.xml$/, /(^|\/)build\.gradle(\.kts)?$/, /(^|\/)go\.mod$/, /(^|\/)Cargo\.toml$/,
    /(^|\/)composer\.json$/, /(^|\/)Gemfile$/, /\.csproj$/, /(^|\/)Dockerfile/,
    /(^|\/)docker-compose/, /\.tf$/],
  tests: [/vitest\.config\./, /jest\.config\./, /(^|\/)pytest\.ini$/, /(^|\/)tox\.ini$/,
    /(^|\/)tests?\//, /(^|\/)specs?\//],
  ci: [/(^|\/)\.github\/workflows\//, /(^|\/)\.gitlab-ci\.yml$/, /(^|\/)Jenkinsfile$/,
    /(^|\/)azure-pipelines\.yml$/],
  entry_points: [/(^|\/)index\.[cm]?[jt]sx?$/, /(^|\/)main\.[a-z]+$/, /(^|\/)app\.[a-z]+$/,
    /(^|\/)cmd\//, /(^|\/)routes?\//, /(^|\/)controllers?\//, /(^|\/)handlers?\//],
  sensitive: [/auth|login|session|token|secret|password|credential|crypto|permission|role|iam|security/i,
    /(^|\/)\.env/],
  controllers: [/(^|\/)[^/]*Controller(V\d+)?\.java$/],
  services_impl: [/(^|\/)[^/]*ServiceImpl\.java$/],
  entities: [/(^|\/)[^/]*Entity\.java$/],
  repositories: [/(^|\/)[^/]*Repository\.java$/],
  dtos: [/(^|\/)[^/]*DTO\.java$/],
  migrations: [/(^|\/)db\/migration\/.*V\d+.*\.sql$/],
  frontend_components: [/^frontend\/src\/.*\.vue$/],
  frontend_views: [/^frontend\/src\/.*(views|pages)\/.*\.vue$/],
  frontend_stores: [/^frontend\/src\/.*(store|stores)\/.*\.ts$/],
  frontend_api: [/^frontend\/src\/.*(api|service|client)/i],
  unit_tests: [/(^|\/)src\/test\/.*Test\.java$/],
  integration_tests: [/(^|\/)src\/test\/.*IT\.java$/],
  frontend_tests: [/^frontend\/src\/.*\.(spec|test)\.ts$/]
};

const files = [];
let directories = 0;
let truncated = false;

function walk(dir) {
  if (truncated) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (truncated) return;
    const absolute = resolve(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      directories += 1;
      walk(absolute);
      continue;
    }
    if (!entry.isFile()) continue;
    if (files.length >= maxFiles) {
      truncated = true;
      return;
    }
    const rel = relative(rootPath, absolute).split('\\').join('/');
    const stat = statSync(absolute);
    let lines = null;
    if (stat.size <= 1_000_000) {
      try {
        const text = readFileSync(absolute, 'utf8');
        if (!text.includes('\0')) lines = text.split('\n').length;
      } catch {
        lines = null;
      }
    }
    const item = { path: rel, bytes: stat.size, lines };
    item.categories = Object.entries(categories)
      .filter(([, patterns]) => patterns.some((pattern) => pattern.test(rel)))
      .map(([name]) => name);
    files.push(item);
  }
}

walk(rootPath);
files.sort((a, b) => a.path.localeCompare(b.path));

const byCategory = {};
for (const name of Object.keys(categories)) {
  byCategory[name] = files.filter((file) => file.categories.includes(name)).map((file) => file.path);
}

const layers = {};
for (const name of [
  'controllers', 'services_impl', 'entities', 'repositories', 'migrations',
  'frontend_components', 'frontend_views', 'frontend_stores', 'frontend_api',
  'unit_tests', 'integration_tests', 'frontend_tests'
]) {
  layers[name] = byCategory[name].length;
}

const extensions = {};
for (const file of files) {
  const dot = file.path.lastIndexOf('.');
  const ext = dot > 0 ? file.path.slice(dot).toLowerCase() : '(sem extensão)';
  extensions[ext] = (extensions[ext] || 0) + 1;
}

const inventory = {
  skill: 'codebase-analysis',
  root: rootPath,
  summary: {
    files: files.length,
    directories,
    truncated,
    max_files: maxFiles
  },
  extensions,
  layers,
  by_category: byCategory,
  files,
  note: 'Somente caminhos, tamanhos e contagem de linhas. Nenhum conteúdo de arquivo foi copiado.'
};

function markdown() {
  const lines = [
    `# Inventário: ${rootPath}`,
    '',
    `- Arquivos: ${files.length}`,
    `- Diretórios: ${directories}`,
    `- Truncado: ${truncated ? 'sim' : 'não'} (limite ${maxFiles})`,
    '',
    '## Categorias',
    ''
  ];
  for (const [name, paths] of Object.entries(byCategory)) {
    lines.push(`### ${name} (${paths.length})`);
    if (paths.length) paths.slice(0, 40).forEach((path) => lines.push(`- ${path}`));
    else lines.push('- nenhum');
    lines.push('');
  }
  lines.push('## Extensões', '');
  Object.entries(extensions)
    .sort((a, b) => b[1] - a[1])
    .forEach(([ext, count]) => lines.push(`- ${ext}: ${count}`));
  lines.push('', '## Camadas de código', '');
  Object.entries(layers)
    .forEach(([name, count]) => lines.push(`- ${name}: ${count}`));
  lines.push('', inventory.note);
  return `${lines.join('\n')}\n`;
}

const content = format === 'json' ? `${JSON.stringify(inventory, null, 2)}\n` : markdown();

if (parsed.out) {
  try {
    mkdirSync(dirname(resolve(parsed.out)), { recursive: true });
    writeFileSync(resolve(parsed.out), content, 'utf8');
    process.stdout.write(`Inventário escrito em ${resolve(parsed.out)}\n`);
  } catch (error) {
    fail(`falha ao escrever ${parsed.out}: ${error.message}`, 4);
  }
} else {
  process.stdout.write(content);
}
