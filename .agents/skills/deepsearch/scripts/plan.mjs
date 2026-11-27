import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);

function option(name, fallback = '') {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  return args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : fallback;
}

const skip = new Set();
for (const name of ['stack', 'version', 'env', 'out']) {
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) skip.add(index + 1);
}
const positional = args.filter((a, index) => !a.startsWith('--') && !skip.has(index));

const topic = positional.join(' ') || 'Tema não informado';
const stack = option('stack', 'não informada');
const version = option('version', 'não informada');
const environment = option('env', 'não informado');
const output = option('out', '');

const axes = [
  ['Definição e fronteiras', 'O que é, o que não é, termos do domínio'],
  ['Versão e compatibilidade', 'Versão instalada, matriz de suporte, mudanças entre versões'],
  ['Arquitetura', 'Componentes, responsabilidades, fronteiras de rede e ownership'],
  ['Contratos', 'Nomes de método, parâmetros, defaults, payloads e códigos'],
  ['Segurança', 'Autenticação, autorização, segredos, tenant e PII'],
  ['Operação', 'Config, deploy, observabilidade, escala, retries e recuperação'],
  ['Dados e migração', 'Modelo persistido, compatibilidade, rollout e rollback'],
  ['Testes', 'O que é unitário, o que exige integração, mocks perigosos'],
  ['Alternativas', 'Pelo menos uma opção descartada com motivo'],
  ['Lacunas', 'O que não dá para saber sem rodar, acessar ou experimentar']
];

const lines = [
  `# Plano de pesquisa: ${topic}`,
  '',
  `- Assunto: ${topic}`,
  `- Stack: ${stack}`,
  `- Versão: ${version}`,
  `- Ambiente: ${environment}`,
  '',
  '## Subquestões',
  ''
];

axes.forEach(([axis, hint], index) => {
  lines.push(`### ${index + 1}. ${axis}`);
  lines.push(`- Pergunta: `);
  lines.push(`- Dica: ${hint}`);
  lines.push(`- Estado: pendente — fonte oficial / changelog / inferência com alvo`);
  lines.push('');
});

lines.push('## Saturação');
lines.push('');
lines.push('Uma subquestão só fecha com fonte oficial aberta, changelog/RFC com data, ou inferência rotulada com alvo de verificação.');

const content = `${lines.join('\n')}\n`;

if (output) writeFileSync(resolve(output), content, 'utf8');
else process.stdout.write(content);
