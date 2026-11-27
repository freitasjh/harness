import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const HELP = `Uso: node scripts/plan.mjs [ponto-de-partida] [opções]

Fixa o escopo de uma análise de codebase antes da leitura profunda.

Argumentos:
  ponto-de-partida        Texto livre: repositório, funcionalidade, arquivo ou commit.

Opções:
  --root DIR              Raiz do repositório (padrão: .)
  --mode MODO             full | feature | diff | security (padrão: full)
  --starting-point TEXTO  Alternativa ao argumento posicional
  --ref REF               Commit, branch ou revisão para reprodução
  --include LISTA         Inclusões separadas por vírgula
  --exclude LISTA         Exclusões separadas por vírgula
  --format FORMATO        md | json (padrão: md)
  --out ARQUIVO           Escreve em ARQUIVO em vez de stdout
  --help                  Mostra esta ajuda

Exit codes:
  0 sucesso · 2 argumento inválido · 3 raiz inexistente · 4 falha ao escrever

Exemplo:
  node scripts/plan.mjs "avaliar autenticação" --mode security --root . \\
    --include src/auth --exclude node_modules --out /tmp/plano.md
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

const valueOptions = new Set([
  'root', 'mode', 'starting-point', 'ref', 'include', 'exclude', 'format', 'out'
]);
const parsed = {};
const positional = [];

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (!arg.startsWith('--')) {
    positional.push(arg);
    continue;
  }
  const name = arg.slice(2);
  if (!valueOptions.has(name)) fail(`opção desconhecida: ${arg}`);
  const next = args[index + 1];
  if (!next || next.startsWith('--')) fail(`--${name} requer um valor`);
  parsed[name] = next;
  index += 1;
}

const modes = new Set(['full', 'feature', 'diff', 'security']);
const mode = parsed.mode || 'full';
if (!modes.has(mode)) fail(`--mode deve ser um de: ${[...modes].join(', ')}`);

const format = parsed.format || 'md';
if (!['md', 'json'].includes(format)) fail('--format deve ser md ou json');

const root = parsed.root || '.';
const rootPath = resolve(root);
if (!existsSync(rootPath) || !statSync(rootPath).isDirectory()) {
  fail(`raiz não é um diretório existente: ${root}`, 3);
}

const startingPoint = parsed['starting-point'] || positional.join(' ').trim();
if (!startingPoint) fail('informe o ponto de partida como argumento ou com --starting-point');

const list = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const axes = [
  ['Definição e fronteiras', 'O que é o alvo e o que fica de fora?'],
  ['Regras e precedência', 'Quais regras locais se aplicam e há conflito?'],
  ['Mapa do repositório', 'Quais manifests, linguagens e diretórios existem?'],
  ['Arquitetura', 'Quais containers e componentes participam?'],
  ['Contratos e dados', 'Quais entradas, saídas e dados sensíveis cruzam fronteira?'],
  ['Segurança estática', 'Quais controles e fraquezas são observáveis no código?'],
  ['Testes e operação', 'O que cobre teste, CI, deploy e observabilidade?'],
  ['Evidência e lacunas', 'O que fecha com arquivo:linha, fonte ou inferência rotulada?']
];

const phases = [
  ['G0', 'Travar', 'plano com alvo, modo, inclusões e exclusões'],
  ['G1', 'Inventariar', 'inventário somente leitura ou limitação declarada'],
  ['G2', 'Mapear', 'regras citadas e contexto mínimo descrito'],
  ['G3', 'Classificar', 'achados com classe, padrão e evidência'],
  ['G4', 'Validar', 'relatório aprovado por validate-evidence.mjs']
];

const plan = {
  skill: 'codebase-analysis',
  root: rootPath,
  starting_point: startingPoint,
  mode,
  ref: parsed.ref || '',
  includes: list(parsed.include),
  excludes: list(parsed.exclude),
  axes: axes.map(([title, question]) => ({
    title,
    question,
    status: 'pendente'
  })),
  phases: phases.map(([gate, name, output]) => ({ gate, name, output })),
  saturation_rule: 'Feche com arquivo:linha, fonte oficial com URL e data, ou inferência rotulada com alvo de verificação.'
};

function markdown() {
  const lines = [
    `# Plano de análise: ${plan.starting_point}`,
    '',
    `- Skill: ${plan.skill}`,
    `- Raiz: ${plan.root}`,
    `- Modo: ${plan.mode}`,
    `- Ref: ${plan.ref || 'não informada'}`,
    `- Inclusões: ${plan.includes.length ? plan.includes.join(', ') : 'nenhuma declarada'}`,
    `- Exclusões: ${plan.excludes.length ? plan.excludes.join(', ') : 'nenhuma declarada'}`,
    '',
    '## Eixos',
    ''
  ];
  plan.axes.forEach((axis, index) => {
    lines.push(`### ${index + 1}. ${axis.title}`);
    lines.push(`- Pergunta: ${axis.question}`);
    lines.push(`- Estado: ${axis.status}`);
    lines.push('');
  });
  lines.push('## Gates', '');
  plan.phases.forEach((phase) => {
    lines.push(`- ${phase.gate} ${phase.name} → ${phase.output}`);
  });
  lines.push('', '## Saturação', '', plan.saturation_rule);
  return `${lines.join('\n')}\n`;
}

const content = format === 'json' ? `${JSON.stringify(plan, null, 2)}\n` : markdown();

if (parsed.out) {
  try {
    mkdirSync(dirname(resolve(parsed.out)), { recursive: true });
    writeFileSync(resolve(parsed.out), content, 'utf8');
    process.stdout.write(`Plano escrito em ${resolve(parsed.out)}\n`);
  } catch (error) {
    fail(`falha ao escrever ${parsed.out}: ${error.message}`, 4);
  }
} else {
  process.stdout.write(content);
}
