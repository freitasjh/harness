import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const skill = resolve(here, '..');
const results = [];

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
}
function text(relative) {
  return readFileSync(join(skill, relative), 'utf8');
}

const required = [
  'SKILL.md',
  'assets/context-card.md',
  'assets/rota-a.md',
  'assets/picco.md',
  'references/clarifying-questions.md',
  'references/picco-template.md',
  'scripts/validate-output.mjs',
  'scripts/check-package.mjs',
  'TESTING.md',
  'fixtures/output-rota-a-valid.md',
  'fixtures/output-rota-a-invalid.md',
  'fixtures/output-rota-b-valid.md',
  'fixtures/output-rota-b-invalid.md'
];

for (const relative of required) {
  check(`existe ${relative}`, existsSync(join(skill, relative)));
}

const skillMd = existsSync(join(skill, 'SKILL.md')) ? text('SKILL.md') : '';
const frontmatter = skillMd.match(/^---\n([\s\S]*?)\n---/);
check('SKILL tem frontmatter', Boolean(frontmatter));
check('name correto', Boolean(frontmatter && /name:\s*prompt-optimizer/.test(frontmatter[1])));
check('description presente', Boolean(frontmatter && /description:\s*\S/.test(frontmatter[1])));

for (const reference of [
  'assets/context-card.md',
  'assets/rota-a.md',
  'assets/picco.md',
  'scripts/validate-output.mjs',
  'scripts/check-package.mjs',
  'TESTING.md'
]) {
  check(`SKILL referencia ${reference}`, skillMd.includes(reference));
}

if (existsSync(join(skill, 'references/clarifying-questions.md'))) {
  check('referência aponta para Rota A', text('references/clarifying-questions.md').includes('assets/rota-a.md'));
}
if (existsSync(join(skill, 'references/picco-template.md'))) {
  check('referência aponta para PICCO', text('references/picco-template.md').includes('assets/picco.md'));
}

const rotaA = existsSync(join(skill, 'assets/rota-a.md')) ? text('assets/rota-a.md') : '';
const picco = existsSync(join(skill, 'assets/picco.md')) ? text('assets/picco.md') : '';
check('template Rota A é canônico', (rotaA.match(/##\s+Falta contexto/g) || []).length === 1);
check('template PICCO é canônico', (picco.match(/<role>\[critério/g) || []).length === 1);

for (const relative of ['references/clarifying-questions.md', 'references/picco-template.md', 'SKILL.md']) {
  if (!existsSync(join(skill, relative))) continue;
  const source = text(relative);
  check(`${relative} não duplica template Rota A`, !source.includes('Bloqueio (o que não vou assumir): [elemento ausente'));
  check(`${relative} não duplica template PICCO`, !source.includes('<open_questions>\n  <!-- Rota A: elementos ausentes'));
}

const scripts = readdirSync(join(skill, 'scripts')).filter((name) => name.endsWith('.mjs'));
for (const name of scripts) {
  const source = text(`scripts/${name}`);
  check(`script ${name} documenta --help`, source.includes('--help'));
  if (name === 'check-package.mjs') continue;
  check(`script ${name} é não interativo`, !source.includes('readline') && !source.includes('prompt('));
}

check('pacote não depende de caminho absoluto', !/(\/home\/|\/tmp\/)/.test(skillMd));
check('Rota A continua proibindo artefato', /nada é criado|nenhum artefato/i.test(skillMd));

const fixtures = readdirSync(join(skill, 'fixtures')).filter((name) => name.endsWith('.md'));
check('fixtures de prompt preservadas', fixtures.length >= 10, `${fixtures.length} fixtures`);

for (const result of results) {
  process.stdout.write(`${result.ok ? 'OK  ' : 'FAIL'} ${result.name}${result.detail ? ` — ${result.detail}` : ''}\n`);
}
const failures = results.filter((result) => !result.ok).length;
process.stdout.write(`\n${results.length - failures}/${results.length} verificações passaram.\n`);
process.exit(failures ? 1 : 0);
