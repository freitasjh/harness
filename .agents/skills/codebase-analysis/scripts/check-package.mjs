import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const skill = resolve(here, '..');
const repo = resolve(skill, '../../..');

const results = [];
function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
}
function text(relative) {
  return readFileSync(join(skill, relative), 'utf8');
}
function repoText(relative) {
  return readFileSync(resolve(repo, relative), 'utf8');
}

const required = [
  'SKILL.md',
  'assets/codebase-analysis-contract.md',
  'assets/report-template.md',
  'assets/evidence-card.md',
  'references/analysis-playbook.md',
  'references/architecture-lens.md',
  'references/full-depth-contract.md',
  'references/backend-lens.md',
  'references/backend-depth-contract.md',
  'references/diagram-lens.md',
  'references/frontend-lens.md',
  'references/sql-lens.md',
  'references/security-review-lens.md',
  'references/standards-and-versions.md',
  'references/handoff-to-pentest.md',
  'scripts/plan.mjs',
  'scripts/collect.mjs',
  'scripts/validate-evidence.mjs',
  'scripts/check-package.mjs',
  'fixtures/01-full-repo.md',
  'fixtures/02-feature-only.md',
  'fixtures/03-security-candidate.md',
  'fixtures/04-starting-point-missing.md',
  'fixtures/report-valid.md',
  'fixtures/report-backend-full.md',
  'fixtures/report-shallow.md',
  'fixtures/report-invalid.md',
  'evals/evals.json',
  'TESTING.md'
];

for (const relative of required) {
  check(`existe ${relative}`, existsSync(join(skill, relative)));
}

const skillMd = existsSync(join(skill, 'SKILL.md')) ? text('SKILL.md') : '';
const frontmatter = skillMd.match(/^---\n([\s\S]*?)\n---/);
check('SKILL tem frontmatter', Boolean(frontmatter));
check('name bate com diretório', Boolean(frontmatter && /name:\s*codebase-analysis/.test(frontmatter[1])));
check('description presente', Boolean(frontmatter && /description:\s*\S/.test(frontmatter[1])));
check('SKILL abaixo de 500 linhas', skillMd.split('\n').length < 500, `${skillMd.split('\n').length} linhas`);
check('SKILL abaixo de 5000 tokens estimados', skillMd.length / 4 < 5000, `${Math.round(skillMd.length / 4)} tokens estimados`);

const contract = existsSync(join(skill, 'assets/codebase-analysis-contract.md'))
  ? text('assets/codebase-analysis-contract.md') : '';
const bullets = contract.split('\n').filter((line) => line.startsWith('- ')).length;
check('contrato tem pelo menos 8 regras', bullets >= 8, `${bullets} bullet(s)`);
check('contrato é o único do pacote', (contract.match(/única descrição destas regras/g) || []).length === 1);

for (const [name, marker] of [
  ['deepsearch', 'Esta rule é a ÚNICA descrição do protocolo'],
  ['pentest', 'Esta rule é a ÚNICA descrição do protocolo. Agentes referenciam este arquivo; não o copiam.']
]) {
  let duplicated = false;
  for (const relative of required) {
    if (relative.startsWith('scripts/') || relative === 'SKILL.md') continue;
    const path = join(skill, relative);
    if (!existsSync(path)) continue;
    if (readFileSync(path, 'utf8').includes(marker)) duplicated = true;
  }
  check(`rule ${name} não duplicada`, !duplicated);
}

for (const reference of [
  'assets/codebase-analysis-contract.md',
  'references/analysis-playbook.md',
  'references/full-depth-contract.md',
  'references/backend-lens.md',
  'references/backend-depth-contract.md',
  'references/diagram-lens.md',
  'references/frontend-lens.md',
  'references/sql-lens.md',
  'references/security-review-lens.md',
  'references/standards-and-versions.md',
  'references/handoff-to-pentest.md',
  'scripts/plan.mjs',
  'scripts/collect.mjs',
  'scripts/validate-evidence.mjs'
]) {
  check(`SKILL referencia ${reference}`, skillMd.includes(reference));
}

const scripts = readdirSync(join(skill, 'scripts')).filter((name) => name.endsWith('.mjs'));
for (const name of scripts) {
  const source = text(`scripts/${name}`);
  check(`script ${name} documenta --help`, source.includes('--help'));
  if (name === 'check-package.mjs') continue;
  check(`script ${name} é não interativo`, !source.includes('readline') && !source.includes('prompt('));
}

check('skill não é regra always-on', !existsSync(resolve(repo, '.agents/rules/' + 'codebase-analysis.md')));
check('sem steering Kiro próprio', !existsSync(resolve(repo, '.kiro/steering/codebase-analysis.md')));
check('sem hook Kiro próprio', !existsSync(resolve(repo, '.kiro/hooks/codebase-analysis.json')));
check('sem agente Codex próprio', !existsSync(resolve(repo, '.codex/agents/codebase-analysis.toml')));

if (existsSync(resolve(repo, 'opencode.json'))) {
  const opencode = repoText('opencode.json');
  check('opencode não carrega regra da skill', !opencode.includes('codebase-analysis'));
}

try {
  const evals = JSON.parse(text('evals/evals.json'));
  check('evals tem casos', Array.isArray(evals.evals) && evals.evals.length >= 3);
  check('evals tem asserções', evals.evals.every((item) => Array.isArray(item.assertions) && item.assertions.length > 0));
} catch {
  check('evals é JSON válido', false);
}

for (const result of results) {
  process.stdout.write(`${result.ok ? 'OK  ' : 'FAIL'} ${result.name}${result.detail ? ` — ${result.detail}` : ''}\n`);
}

const failures = results.filter((result) => !result.ok).length;
process.stdout.write(`\n${results.length - failures}/${results.length} verificações passaram.\n`);
process.exit(failures ? 1 : 0);
