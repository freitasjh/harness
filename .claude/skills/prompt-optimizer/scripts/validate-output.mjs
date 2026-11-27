import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HELP = `Uso: node scripts/validate-output.mjs <arquivo.md> [opções]

Valida a saída da skill prompt-optimizer: Rota A ou Rota B.
Score semântico permanece com o modelo; este script valida forma e gates.

Opções:
  --expect-fail       Inverte o resultado: espera que a validação falhe
  --format FORMATO    text | json (padrão: text)
  --help              Mostra esta ajuda

Exit codes:
  0 sucesso (ou falha esperada com --expect-fail)
  1 falha de validação
  2 argumento inválido
  3 arquivo inexistente
`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(HELP);
  process.exit(0);
}

const expectFail = args.includes('--expect-fail');
const formatIndex = args.indexOf('--format');
let format = 'text';
if (formatIndex >= 0) {
  format = args[formatIndex + 1];
  if (!format || format.startsWith('--')) {
    process.stderr.write('Erro: --format requer text ou json\n');
    process.exit(2);
  }
}
const files = args.filter((arg, index) => {
  if (arg.startsWith('--')) return false;
  if (formatIndex >= 0 && index === formatIndex + 1) return false;
  return true;
});

if (files.length !== 1) {
  process.stderr.write('Erro: informe exatamente um arquivo.md\n');
  process.exit(2);
}
if (!['text', 'json'].includes(format)) {
  process.stderr.write('Erro: --format deve ser text ou json\n');
  process.exit(2);
}

const file = resolve(files[0]);
if (!existsSync(file)) {
  process.stderr.write(`Erro: arquivo inexistente: ${files[0]}\n`);
  process.exit(3);
}

const content = readFileSync(file, 'utf8');
const errors = [];
const warnings = [];

const tags = ['role', 'task', 'context', 'constraints', 'acceptance', 'open_questions'];
const hasPicco = tags.some((tag) => new RegExp(`<${tag}>`, 'i').test(content));
const rotaAMarker = /##\s+Falta contexto/i.test(content);
const rotaBMarker = /6\/6/i.test(content) || /\bRota B\b/i.test(content);

if (rotaAMarker && rotaBMarker) {
  errors.push('saída mistura marcadores de Rota A e Rota B');
}

function between(open, close) {
  const start = content.indexOf(open);
  if (start < 0) return '';
  const from = start + open.length;
  const end = content.indexOf(close, from);
  return content.slice(from, end < 0 ? content.length : end);
}

function sectionBetween(startMarker, endMarker) {
  const start = content.indexOf(startMarker);
  if (start < 0) return '';
  const from = start + startMarker.length;
  const end = endMarker ? content.indexOf(endMarker, from) : content.length;
  return content.slice(from, end < 0 ? content.length : end);
}

if (rotaAMarker && !rotaBMarker) {
  if (!/##\s+Falta contexto\s+—\s+preciso de\s+\d+\s+resposta\(s\)/u.test(content)) {
    warnings.push('Rota A: heading fora do formato canônico; use assets/rota-a.md');
  }
  if (!/Bloqueio\s*\(/i.test(content)) {
    errors.push('Rota A: linha de bloqueio ausente');
  }
  if (!content.includes('### Já entendi')) {
    errors.push('Rota A: seção Já entendi ausente');
  }
  if (!content.includes('### Regra')) {
    errors.push('Rota A: seção Regra ausente');
  }
  if (hasPicco) {
    errors.push('Rota A não pode emitir bloco PICCO');
  }

  const questionArea = sectionBetween('## ', '### Já entendi');
  const questions = questionArea.split('\n').filter((line) => /^\s*\d+\.\s+/.test(line));
  if (questions.length < 1 || questions.length > 3) {
    errors.push(`Rota A: ${questions.length} pergunta(s); permitido de 1 a 3`);
  }

  const markers = questions
    .map((line) => line.match(/E([1-6])/))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  for (let index = 1; index < markers.length; index += 1) {
    if (markers[index] < markers[index - 1]) {
      errors.push('Rota A: perguntas fora da ordem E1 > E2 > E3 > E4 > E5 > E6');
      break;
    }
  }

  const understood = sectionBetween('### Já entendi', '### Regra');
  if (/\binferido\b|\bparcial\b/i.test(understood)) {
    warnings.push('Já entendi contém inferência; ela deve ir para o ledger, não para afirmação');
  }
  const rule = sectionBetween('### Regra', null);
  if (!/Não vou assumir/i.test(rule)) {
    warnings.push('Regra não diz explicitamente que lacuna não vira default do modelo');
  }
}

if (!rotaAMarker && rotaBMarker) {
  if (!/6\/6/.test(content)) errors.push('Rota B: score 6/6 não declarado');
  if (!/\bRota B\b/i.test(content)) errors.push('Rota B: rótulo Rota B ausente');

  for (const tag of tags) {
    if (!new RegExp(`<${tag}>`, 'i').test(content)) errors.push(`Rota B: tag <${tag}> ausente`);
    if (!new RegExp(`</${tag}>`, 'i').test(content)) errors.push(`Rota B: tag </${tag}> ausente`);
  }

  const role = between('<role>', '</role>');
  if (/você é|especialista|persona/i.test(role)) {
    errors.push('Rota B: role é persona; use critério de comportamento');
  }
  const task = between('<task>', '</task>');
  if (!task.trim()) errors.push('Rota B: task vazia');

  const context = between('<context>', '</context>');
  if (!/\S+:\d+|brain[^\s]*|projeto\/[^\s]+/i.test(context)) {
    warnings.push('context sem arquivo:linha ou brain path para afirmação não literal');
  }

  const constraintsBlock = between('<constraints>', '</constraints>');
  const constraintLines = constraintsBlock.split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(Sempre|Nunca):/i.test(line));
  if (constraintLines.length < 1) errors.push('Rota B: nenhuma constraint Sempre/Nunca');
  if (constraintLines.length > 10) {
    errors.push(`Rota B: ${constraintLines.length} constraints; máximo 10`);
  }
  const lastPositive = constraintLines.map((line, i) => /^Sempre:/i.test(line) ? i : -1).filter((i) => i >= 0).at(-1) ?? -1;
  const firstNegative = constraintLines.findIndex((line) => /^Nunca:/i.test(line));
  if (firstNegative >= 0 && lastPositive > firstNegative) {
    errors.push('Rota B: constraints negativas aparecem antes das positivas');
  }

  if (/pense passo a passo|think step by step/i.test(content)) {
    errors.push('Rota B: instrução de raciocínio explícita não é permitida');
  }

  const acceptance = between('<acceptance>', '</acceptance>');
  if (!acceptance.trim()) {
    errors.push('Rota B: acceptance vazia');
  } else if (!/\b(mvn|npm|node|curl|test|IT|assert|verif|status|build|lint|422|200|201)\b/i.test(acceptance)) {
    errors.push('Rota B: acceptance sem verificação observável');
  }

  const openQuestions = between('<open_questions>', '</open_questions>')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  if (openQuestions) errors.push('Rota B: open_questions deve estar vazio');
}

if (!rotaAMarker && !rotaBMarker) {
  errors.push('nenhuma rota detectada: use o formato da Rota A ou da Rota B');
}

const failed = errors.length > 0;
const expectationMet = expectFail ? failed : !failed;

if (format === 'json') {
  process.stdout.write(`${JSON.stringify({
    expect_fail: expectFail,
    ok: expectationMet,
    errors,
    warnings,
    file: files[0]
  }, null, 2)}\n`);
} else {
  process.stdout.write(`== ${files[0]} ==\n`);
  errors.forEach((error) => process.stdout.write(`ERRO ${error}\n`));
  warnings.forEach((warning) => process.stdout.write(`AVISO ${warning}\n`));
  if (!errors.length && !warnings.length) process.stdout.write('OK\n');
  process.stdout.write(expectFail
    ? (failed ? '\nEsperado: falha recebida.\n' : '\nEsperado falha, mas a validação passou.\n')
    : `\n${errors.length} erro(s), ${warnings.length} aviso(s).\n`);
}

process.exit(expectationMet ? 0 : 1);
