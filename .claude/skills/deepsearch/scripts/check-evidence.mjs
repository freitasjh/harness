import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const expectFail = args.includes('--expect-fail');

if (!file) {
  process.stderr.write('Uso: node check-evidence.mjs <arquivo.md> [--expect-fail]\n');
  process.exit(1);
}

const content = readFileSync(file, 'utf8');
const blocks = content.split(/\n\s*\n/).filter((block) => block.trim());
const errors = [];
let sourced = 0;
let inferred = 0;

blocks.forEach((block, index) => {
  const hasUrl = /https?:\/\//i.test(block);
  const hasDate = /\b20\d{2}-\d{2}-\d{2}\b/.test(block);
  const hasClaim = /Afirmação:/i.test(block);
  const hasInference = /inferência/i.test(block);

  if (hasUrl) {
    sourced += 1;
    if (!hasDate) errors.push(`bloco ${index + 1}: URL sem data da consulta (YYYY-MM-DD)`);
  }

  if (hasClaim && !hasUrl && !hasInference) {
    errors.push(`bloco ${index + 1}: afirmação sem URL e sem rótulo de inferência`);
  }

  if (hasInference) inferred += 1;
});

if (errors.length) {
  process.stdout.write(`FALHOU: ${errors.join(' | ')}\n`);
  process.exit(expectFail ? 0 : 1);
}

process.stdout.write(`OK: ${sourced} bloco(s) com fonte, ${inferred} bloco(s) com inferência rotulada.\n`);
process.exit(expectFail ? 1 : 0);
