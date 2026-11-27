import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HELP = `Uso: node scripts/validate-evidence.mjs <arquivo.md> [opções]

Valida rascunho de relatório ou cartões de evidência desta skill.

Opções:
  --expect-fail       Inverte o resultado: espera que a validação falhe
  --format FORMATO    text | json (padrão: text)
  --help              Mostra esta ajuda

Exit codes:
  0 sucesso (ou falha esperada com --expect-fail)
  1 falha de validação
  2 argumento inválido
  3 arquivo inexistente

Exemplo:
  node scripts/validate-evidence.mjs fixtures/report-valid.md --format json
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

if (files.length === 0) {
  process.stderr.write('Erro: informe ao menos um arquivo.md\n');
  process.exit(2);
}
if (!['text', 'json'].includes(format)) {
  process.stderr.write('Erro: --format deve ser text ou json\n');
  process.exit(2);
}

const requiredHeadings = [
  '## 1. Resumo executivo',
  '## 2. Escopo e ponto de partida',
  '## 3. Método e cobertura',
  '## 4. Mapa de contexto',
  '## 5. Achados de segurança',
  '## 6. Achados de arquitetura e regras',
  '## 7. Priorização',
  '## 8. Lacunas e handoffs',
  '## 9. Fontes e versões'
];

const requiredColumns = [
  'ID', 'Título', 'Classe', 'CWE', 'ASVS', 'Top 10',
  'Evidência', 'Impacto', 'Remediação', 'Verificação'
];

const classes = new Set(['suspeito', 'fraca confirmada em código', 'requer runtime']);
const secretPatterns = [
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/
];

function section(content, heading, nextHeading) {
  const start = content.indexOf(heading);
  if (start < 0) return '';
  const end = nextHeading ? content.indexOf(nextHeading, start + heading.length) : content.length;
  return content.slice(start, end < 0 ? content.length : end);
}

function cells(row) {
  return row.split('|').slice(1, -1).map((cell) => cell.trim());
}

function uniqueMatches(text, pattern) {
  return new Set(text.match(pattern) || []).size;
}

function mermaidBlocks(text) {
  return [...text.matchAll(/```mermaid\s*\n([\s\S]*?)```/g)].map((match) => match[1]);
}

function validMermaidBlock(block) {
  const lines = block.split('\n').map((line) => line.trim());
  if (lines.some((line) => /^(flowchart|graph)\b/.test(line))) {
    const subgraphs = lines.filter((line) => /^subgraph\b/.test(line)).length;
    const ends = lines.filter((line) => line === 'end').length;
    return subgraphs === ends;
  }
  if (lines.some((line) => line === 'sequenceDiagram')) {
    const opens = lines.filter((line) => /^(alt|opt|loop|par)\b/.test(line)).length;
    const ends = lines.filter((line) => line === 'end').length;
    return opens === ends;
  }
  return lines.some((line) => /^(stateDiagram-v2|erDiagram)\b/.test(line));
}

const codeRefPattern = /\S+\.(?:java|kt|kts|ts|tsx|js|jsx|mjs|cjs|vue|sql|properties|yml|yaml|xml|json|toml):\d+/;

function validateFile(file) {
  const errors = [];
  const warnings = [];
  const absolute = resolve(file);
  if (!existsSync(absolute)) return { file, errors: [`arquivo inexistente: ${file}`], warnings };

  const content = readFileSync(absolute, 'utf8');
  const lines = content.split('\n');

  for (const heading of requiredHeadings) {
    if (!content.includes(heading)) errors.push(`seção obrigatória ausente: ${heading}`);
  }

  const scope = section(content, '## 2. Escopo e ponto de partida', '## 3.');
  if (scope && !/- Alvo:\s*\S/.test(scope)) errors.push('escopo sem alvo declarado');
  const modeMatch = scope.match(/- Modo:\s*(full|feature|diff|security)/);
  if (scope && !modeMatch) {
    errors.push('escopo sem modo válido (full|feature|diff|security)');
  }
  const isFull = Boolean(modeMatch && modeMatch[1] === 'full');
  const includedLine = (scope.match(/- Incluído:\s*(.*)/) || [])[1] || '';
  const excludedLine = (scope.match(/- Excluído:\s*(.*)/) || [])[1] || '';
  const frontendOutOfScope = /frontend|\bspa\b|\bvue\b/i.test(excludedLine);
  const deepBackend = isFull && /backend/i.test(includedLine);

  const method = section(content, '## 3. Método e cobertura', '## 4.');
  if (method && !method.includes('Validação executada')) {
    errors.push('método não registra a validação executada');
  }

  if (isFull) {
    const blocks = mermaidBlocks(content);
    if (!blocks.some((block) => /^\s*(flowchart|graph)\b/m.test(block))) {
      errors.push('modo full sem diagrama flowchart/graph Mermaid');
    }
    if (!blocks.some((block) => /^\s*sequenceDiagram\b/m.test(block))) {
      errors.push('modo full sem diagrama sequenceDiagram Mermaid');
    }
    if (blocks.some((block) => !validMermaidBlock(block))) {
      errors.push('diagrama Mermaid com blocos alt/opt/loop/par/subgraph não fechados');
    }
    if (blocks.length && !/Legenda/i.test(content)) {
      errors.push('diagrama Mermaid sem legenda com arquivo:linha');
    }

    for (const heading of [
      '### 4.1 Regras e precedência',
      '### 4.2 Backend',
      '### 4.3 Frontend',
      '### 4.4 SQL e dados',
      '### 4.5 Contratos e operação'
    ]) {
      if (!content.includes(heading)) errors.push(`modo full sem seção obrigatória: ${heading}`);
    }

    if (!content.includes('| Camada | Arquivos encontrados | Arquivos lidos | Evidência representativa |')) {
      errors.push('modo full sem matriz de cobertura');
    }
    for (const layer of ['Regras', 'Backend', 'Frontend', 'SQL e dados', 'Testes']) {
      if (!new RegExp(`^\\|\\s*${layer}\\s*\\|`, 'm').test(content)) {
        errors.push(`matriz de cobertura sem a camada: ${layer}`);
      }
    }

    const backendSection = section(content, '### 4.2 Backend', '### 4.3 Frontend');
    const frontendSection = section(content, '### 4.3 Frontend', '### 4.4 SQL e dados');
    const sqlSection = section(content, '### 4.4 SQL e dados', '### 4.5 Contratos e operação');

    if (uniqueMatches(backendSection, /\S+\.(?:java|mjs|js|ts|tsx|json|yml|yaml):\d+/g) < 2) {
      errors.push('modo full: runtime/backend com menos de 2 referências de código/config distintas');
    }
    if (frontendOutOfScope) {
      if (!/Fora do escopo/i.test(frontendSection)) {
        errors.push('frontend excluído no Gate 0 mas a seção não diz Fora do escopo — motivo');
      }
    } else if (uniqueMatches(frontendSection, /\S+\.(?:vue|ts|tsx|js|jsx|mjs|json|toml):\d+/g) < 2) {
      errors.push('modo full: frontend/superfície de agente com menos de 2 referências distintas');
    }
    if (uniqueMatches(sqlSection, /\S+\.(?:sql|json|mjs):\d+/g) < 1) {
      errors.push('modo full: camada de dados sem referência a schema/estado');
    }
    if (uniqueMatches(sqlSection, /\S+\.(?:java|mjs|js|ts|json):\d+/g) < 1) {
      errors.push('modo full: camada de dados sem referência a leitura/escrita');
    }

    if (deepBackend) {
      for (const heading of [
        '#### 4.2.1 Matriz de endpoints',
        '#### 4.2.2 Grafo de módulos',
        '#### 4.2.3 Fluxos críticos',
        '#### 4.2.4 Modelo de dados e consistência',
        '#### 4.2.5 Testes e controles',
        '#### 4.2.6 Ameaças e riscos',
        '## 10. Plano de evolução'
      ]) {
        if (!content.includes(heading)) errors.push(`backend full sem seção obrigatória: ${heading}`);
      }

      if (uniqueMatches(backendSection, /\S+\.java:\d+/g) < 10) {
        errors.push('backend full: menos de 10 referências Java distintas');
      }

      const endpointSection = section(content, '#### 4.2.1 Matriz de endpoints', '#### 4.2.2 Grafo de módulos');
      if (!endpointSection.includes('| Controller | Rota | Verbo | Autorização | Tenant | Teste |')) {
        errors.push('backend full: matriz de endpoints sem colunas obrigatórias');
      }
      const endpointRows = endpointSection.split('\n')
        .filter((line) => line.startsWith('|'))
        .slice(1)
        .filter((line) => !/^\|[\s|:-]+\|$/.test(line));
      if (endpointRows.length < 5) errors.push('backend full: matriz de endpoints com menos de 5 linhas');

      const moduleSection = section(content, '#### 4.2.2 Grafo de módulos', '#### 4.2.3 Fluxos críticos');
      if (uniqueMatches(moduleSection, /\S+\.xml:\d+/g) < 4) {
        errors.push('backend full: grafo de módulos com menos de 4 referências a pom.xml');
      }
      if (!mermaidBlocks(moduleSection).some((block) => /^\s*(flowchart|graph)\b/m.test(block))) {
        errors.push('backend full: grafo de módulos sem flowchart Mermaid');
      }

      const flowSection = section(content, '#### 4.2.3 Fluxos críticos', '#### 4.2.4 Modelo de dados e consistência');
      if (uniqueMatches(flowSection, /\S+\.java:\d+/g) < 6) {
        errors.push('backend full: fluxos críticos com menos de 6 referências Java');
      }
      if (!mermaidBlocks(flowSection).some((block) => /^\s*sequenceDiagram\b/m.test(block))) {
        errors.push('backend full: fluxos críticos sem sequenceDiagram Mermaid');
      }
      if (!/Legenda/i.test(flowSection)) {
        errors.push('backend full: fluxos críticos sem legenda do diagrama');
      }

      const dataModelSection = section(content, '#### 4.2.4 Modelo de dados e consistência', '#### 4.2.5 Testes e controles');
      if (uniqueMatches(dataModelSection, /\S+\.sql:\d+/g) < 3) {
        errors.push('backend full: modelo de dados com menos de 3 referências a migration');
      }
      if (uniqueMatches(dataModelSection, /\S+\.java:\d+/g) < 2) {
        errors.push('backend full: modelo de dados com menos de 2 referências a entidade/repositório');
      }

      const testSection = section(content, '#### 4.2.5 Testes e controles', '#### 4.2.6 Ameaças e riscos');
      if (uniqueMatches(testSection, /\S+\.java:\d+/g) < 5) {
        errors.push('backend full: matriz controle/teste com menos de 5 referências Java');
      }

      const threatSection = section(content, '#### 4.2.6 Ameaças e riscos', '## 5. Achados de segurança');
      const severities = (threatSection.match(/(crítico|alto|médio|baixo|🔴|🟠|🟡|🟢)/gi) || []).length;
      if (severities < 3) errors.push('backend full: ameaças sem pelo menos 3 severidades nomeadas');

      const evolutionSection = section(content, '## 10. Plano de evolução', '## Regras de preenchimento');
      if (!evolutionSection.includes('| Ordem | Ação | Arquivo alvo | Aceite | Risco |')) {
        errors.push('backend full: plano de evolução sem colunas obrigatórias');
      }
      const evolutionRows = evolutionSection.split('\n')
        .filter((line) => line.startsWith('|'))
        .slice(1)
        .filter((line) => !/^\|[\s|:-]+\|$/.test(line));
      if (evolutionRows.length < 3) errors.push('backend full: plano de evolução com menos de 3 itens');
    }
  }

  const security = section(content, '## 5. Achados de segurança', '## 6.');
  if (security) {
    const header = security.split('\n').find((line) => line.startsWith('|'));
    if (!header) {
      errors.push('tabela de achados de segurança ausente');
    } else {
      const headerCells = cells(header);
      for (const column of requiredColumns) {
        if (!headerCells.some((cell) => cell.replace(/\\/g, '') === column)) {
          errors.push(`coluna obrigatória ausente na tabela: ${column}`);
        }
      }
    }

    const rows = security.split('\n').filter((line) => line.startsWith('|'))
      .slice(1)
      .filter((line) => !/^\|[\s|:-]+\|$/.test(line));

    rows.forEach((row, index) => {
      const values = cells(row);
      if (values.length < requiredColumns.length) {
        errors.push(`achado ${index + 1}: tabela com menos de ${requiredColumns.length} colunas`);
        return;
      }
      const [id, title, classification, cwe, asvs, top10, evidence, impact, remediation, verification] = values;
      if (!id || !title) errors.push(`achado ${index + 1}: ID e título obrigatórios`);
      if (!classes.has(classification)) {
        errors.push(`achado ${index + 1}: classe inválida (${classification || 'vazia'})`);
      }
      const evidenceRefs = evidence.match(/\S+:\d+/g) || [];
      if (!evidenceRefs.length) errors.push(`achado ${index + 1}: evidência sem arquivo:linha`);
      if (isFull && !codeRefPattern.test(evidence)) {
        errors.push(`achado ${index + 1}: evidência só em documentação; modo full exige código/config`);
      }
      if (classification === 'fraca confirmada em código' && evidenceRefs.length < 2) {
        errors.push(`achado ${index + 1}: fraca confirmada em código exige origem e efeito com arquivo:linha`);
      }
      if (cwe && cwe !== '—' && !/CWE-\d+/.test(cwe)) {
        errors.push(`achado ${index + 1}: CWE inválido`);
      }
      if (asvs && asvs !== '—' && !/v5\.0\.0-\d+\.\d+\.\d+/.test(asvs)) {
        errors.push(`achado ${index + 1}: ASVS deve estar versionado (v5.0.0-n.n.n)`);
      }
      if (top10 && top10 !== '—' && !/A\d{2}:2025/.test(top10)) {
        errors.push(`achado ${index + 1}: Top 10 deve ser A0n:2025`);
      }
      if (!impact || impact === '—') errors.push(`achado ${index + 1}: impacto ausente`);
      if (!remediation || remediation === '—') errors.push(`achado ${index + 1}: remediação ausente`);
      if (!verification || verification === '—') errors.push(`achado ${index + 1}: verificação ausente`);
    });

    if (rows.some((row) => row.includes('requer runtime'))) {
      if (!/pentest/i.test(content) || !/Gate 0/i.test(content)) {
        errors.push('achado requer runtime mas o handoff não cita pentest e Gate 0');
      }
    }
  }

  if (/vulnerabilidade confirmada/i.test(content)) {
    errors.push('texto proibido: "vulnerabilidade confirmada" não é usado nesta skill');
  }

  const blocks = content.split(/\n\s*\n/).filter((block) => block.trim());
  blocks.forEach((block, index) => {
    if (/https?:\/\//i.test(block) && !/\b20\d{2}-\d{2}-\d{2}\b/.test(block)) {
      errors.push(`bloco ${index + 1}: URL sem data da consulta (YYYY-MM-DD)`);
    }
  });

  if (content.includes('ASVS') && !content.includes('5.0.0')) {
    errors.push('ASVS citado sem fixar a versão 5.0.0');
  }
  if (/Top 10/i.test(content) && !content.includes('2025')) {
    errors.push('Top 10 citado sem fixar a versão 2025');
  }

  if (!/\S+:\d+/.test(content)) errors.push('relatório sem nenhuma referência arquivo:linha');

  for (const pattern of secretPatterns) {
    if (pattern.test(content)) {
      errors.push('possível segredo detectado no relatório (valor omitido)');
      break;
    }
  }

  if (!/https?:\/\/\S+/.test(content)) {
    warnings.push('nenhuma fonte externa citada; verifique se a análise é apenas local');
  }

  if (lines.length < 20) warnings.push('relatório muito curto para uma análise profunda');

  return { file, errors, warnings };
}

const results = files.map(validateFile);
const errorCount = results.reduce((total, result) => total + result.errors.length, 0);
const warningCount = results.reduce((total, result) => total + result.warnings.length, 0);
const failed = errorCount > 0;
const expectationMet = expectFail ? failed : !failed;

if (format === 'json') {
  process.stdout.write(`${JSON.stringify({
    expect_fail: expectFail,
    ok: expectationMet,
    errors: errorCount,
    warnings: warningCount,
    results
  }, null, 2)}\n`);
} else {
  for (const result of results) {
    process.stdout.write(`== ${result.file} ==\n`);
    result.errors.forEach((error) => process.stdout.write(`ERRO ${error}\n`));
    result.warnings.forEach((warning) => process.stdout.write(`AVISO ${warning}\n`));
    if (!result.errors.length && !result.warnings.length) process.stdout.write('OK\n');
  }
  if (expectFail) {
    process.stdout.write(failed
      ? `\nEsperado: falha recebida (${errorCount} erro(s)).\n`
      : '\nEsperado falha, mas a validação passou.\n');
  } else {
    process.stdout.write(`\n${errorCount} erro(s), ${warningCount} aviso(s).\n`);
  }
}

process.exit(expectationMet ? 0 : 1);
