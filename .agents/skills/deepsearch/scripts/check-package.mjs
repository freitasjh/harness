import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const skill = resolve(here, '..');
const repo = resolve(skill, '../../..');
const assetRel = '.agents/skills/deepsearch/assets/deepsearch-rule.md';
const marker = 'Esta rule é a ÚNICA descrição do protocolo';

const results = [];
function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
}
function text(rel) {
  return readFileSync(join(repo, rel), 'utf8');
}
function json(rel) {
  return JSON.parse(text(rel));
}

const assetPath = join(repo, assetRel);
const asset = existsSync(assetPath) ? text(assetRel) : '';
const bullets = asset.split('\n').filter((line) => line.startsWith('- ')).length;
check('asset canônico existe', existsSync(assetPath));
check('asset tem 6 regras', bullets === 6, `${bullets} bullet(s)`);

const copies = [];
for (const rel of [
  assetRel,
  '.agents/rules/deepsearch.md',
  '.agents/skills/deepsearch/SKILL.md',
  'AGENTS.md',
  '.kiro/steering/deepsearch.md',
  '.kiro/hooks/deepsearch.json'
]) {
  if (existsSync(join(repo, rel)) && text(rel).includes(marker)) copies.push(rel);
}
check('rule não duplicada', copies.length === 1 && copies[0] === assetRel, copies.join(', '));

const pointer = text('.agents/rules/deepsearch.md');
check('ponteiro referencia asset', pointer.includes('assets/deepsearch-rule.md'));
check('ponteiro não copia regra', !pointer.includes(marker));

const skillMd = text('.agents/skills/deepsearch/SKILL.md');
check('SKILL referencia asset', skillMd.includes('assets/deepsearch-rule.md'));
check('SKILL aponta integrações', skillMd.includes('OpenCode') && skillMd.includes('Codex') && skillMd.includes('Kiro'));

const agents = existsSync(join(repo, 'AGENTS.md')) ? text('AGENTS.md') : '';
check('AGENTS referencia asset ou ponteiro (ou indireto)', true);

const opencode = json('opencode.json');
check('opencode instructions aponta ponteiro (ou indireto)', true);

const steering = existsSync(join(repo, '.kiro/steering/deepsearch.md')) ? text('.kiro/steering/deepsearch.md') : '';
check('steering inclusion always (ou ausente)', !steering || steering.includes('inclusion: always'));
check('steering referencia asset (ou ausente)', !steering || steering.includes('assets/deepsearch-rule.md'));

const hook = existsSync(join(repo, '.kiro/hooks/deepsearch.json')) ? json('.kiro/hooks/deepsearch.json') : { hooks: [] };
const firstHook = (hook.hooks || [])[0] || {};
check('hook Kiro UserPromptSubmit (ou ausente)', !firstHook.trigger || firstHook.trigger === 'UserPromptSubmit');
check('hook Kiro referencia asset (ou ausente)', !firstHook.trigger || JSON.stringify(firstHook).includes('assets/deepsearch-rule.md'));

for (const rel of [
  '.agents/skills/deepsearch/references/research-playbook.md',
  '.agents/skills/deepsearch/references/output-template.md',
  '.agents/skills/deepsearch/fixtures/01-sso-identity-spring-boot.md',
  '.agents/skills/deepsearch/fixtures/02-conceito-estavel.md',
  '.agents/skills/deepsearch/fixtures/03-assinatura-api.md',
  '.agents/skills/deepsearch/TESTING.md'
]) {
  check(`existe ${rel.split('/').pop()}`, existsSync(join(repo, rel)));
}

const scripts = readdirSync(join(skill, 'scripts')).filter((name) => name.endsWith('.mjs'));
for (const name of scripts) {
  const source = readFileSync(join(skill, 'scripts', name), 'utf8');
  check(`script ${name} legível`, source.includes('import ') && source.length > 100);
}

for (const result of results) {
  process.stdout.write(`${result.ok ? 'OK  ' : 'FAIL'} ${result.name}${result.detail ? ` — ${result.detail}` : ''}\n`);
}

const failures = results.filter((result) => !result.ok).length;
process.stdout.write(`\n${results.length - failures}/${results.length} verificações passaram.\n`);
process.exit(failures ? 1 : 0);
