// Fronteira ADR-001/PRD-3 — inventário congelado (22 consumidores, 75 exports).
// Dados puros. Nenhuma lógica de instalação, nenhuma escrita, nenhum subprocesso.

export const CONTRACT_VERSION = 1
export const SUBCOMMAND = 'contract-v1'
export const EXIT = Object.freeze({ OK: 0, FAILURE: 1, PROTOCOL: 2 })

const INJ = ['AXIS_IDS', 'RULES_BY_AXIS', 'RULES_COMMON', 'SKILLS_BY_AXIS', 'SKILLS_COMMON', 'STACKS_FOR_EXCEPTIONS']
const DATA = ['DENYLIST', 'MANIFEST_NAME', 'MIN_NODE_VERSION', 'QUESTIONS', 'STACK_PROFILES', 'STACK_VALUES', 'VERSION', 'W2M_MARKER', 'WIZARD_MENU']
const PURE = [
  'InstallError', 'assertCreateOnly', 'assertDogfoodTarget', 'assertInside', 'axisIdsFromAxes',
  'canNoEcho', 'configReferenceTargets', 'defaultSuiteFor', 'dryRunNotice', 'formatError',
  'hasHarnessSection', 'isAbortToken', 'isScannablePath', 'normalizeSection', 'presetOfAxes',
  'presetsOfAxes', 'profileOf', 'resolveAnswerSource', 'ruleAllowedForAxes', 'sanitizeLog',
  'scanLiterals', 'serializeAnswers', 'skillAllowedForLocalAxes', 'stacksFor', 'stripAnsiControls',
  'validateAnswer', 'validateRulesByAxis', 'validateSkillsByAxis', 'writtenPathsOf',
]
const ENGINE = [
  'applyMerge', 'backup', 'buildManifest', 'collectAnswers', 'collectIncoming', 'generateConfig',
  'inventory', 'loadAnswersFile', 'main', 'mergeAgentFile', 'mergeOpencodeJson', 'parseArgs',
  'planMerge', 'preflight', 'requireVerifiedBackup', 'resolveBackupDir', 'runChecks', 'runCli',
  'runDoctor', 'runInit', 'runUpgrade', 'runWizard', 'writeManifest',
]
const TUI = ['askMenuStep', 'detect', 'printPlan', 'printUsage', 'promptAnswers', 'readSecretPrompt', 'readSecretRaw', 'sourceLineOf']

export const DESTINATIONS = Object.freeze({
  'D-INJ': Object.freeze(INJ),
  'D-DATA': Object.freeze(DATA),
  'D-PURE': Object.freeze(PURE),
  'D-ENGINE': Object.freeze(ENGINE),
  'D-TUI': Object.freeze(TUI),
})

export const INTERNAL_EXPORTS = Object.freeze([
  'CONSUMER_EXCLUDED_PREFIXES', 'DEFAULT_EVIDENCE_SCHEMA', 'INCOMING_EXCLUDE', 'INCOMING_ROOTS',
  'VENDOR_LOCK_NAME', 'WIZARD_MENU_FRONTEND', 'WIZARD_MENU_FRONTEND_DEFAULT',
  'WIZARD_MENU_FRONTEND_WIDTH', 'WIZARD_MENU_WIDTH', 'applyUpgrade', 'confirmByLayer',
  'getLastCliAnswers', 'howToFix', 'isHarnessLocalPluginEntry', 'menuChoices', 'menuItemLine',
  'planUpgrade', 'pubspecDeclaresFlutter', 'sha256', 'validateAxesCombination',
])

// Nome da `op` = nome do export que substitui. Nenhum vocabulário novo (E1).
export const OP_NAMES = Object.freeze([...ENGINE, ...TUI])

export const CONSUMER_ROUTES = Object.freeze([
  { file: 'scripts/static-checks.mjs:81', group: 'G-INJ', adapter: 'contract-registry.mjs', proof: '6 mapas byte-equal; CDL_EXPORTS/injeção intactos' },
  { file: '.opencode/plugins/__tests__/cdl.spec.mjs:52', group: 'G-INJ', adapter: 'contract-registry.mjs', proof: 'mesmos 6 nomes, nenhuma asserção reescrita' },
  { file: '.opencode/plugins/__tests__/inventory.spec.mjs:49', group: 'G-INJ', adapter: 'contract-registry.mjs', proof: 'mesmos 4 nomes do registry' },
  { file: 'installer/dogfood.mjs:21', group: 'G-DOGFOOD', adapter: 'installer-contract.mjs', proof: 'main/runChecks/scanLiterals via adapter; DENYLIST/VERSION do registry' },
  { file: 'installer/dogfood-mobile.mjs:36', group: 'G-DOGFOOD', adapter: 'installer-contract.mjs', proof: 'runCli via adapter; MANIFEST_NAME do registry' },
  { file: 'installer/__tests__/golden.spec.mjs:8', group: 'G-ORACLE-DATA', adapter: 'installer-contract.mjs', proof: 'baseline literal inalterado; generateConfig via op' },
  { file: 'installer/__tests__/eixos-stack.spec.mjs:33', group: 'G-ORACLE-DATA', adapter: 'installer-contract.mjs', proof: 'EXPECTED_STACKS literal permanece oráculo independente' },
  { file: 'installer/__tests__/generate.spec.mjs:6', group: 'G-ORACLE-DATA', adapter: 'installer-contract.mjs', proof: 'STACK_PROFILES/profileOf/defaultSuiteFor do registry' },
  { file: 'installer/__tests__/adr-005.spec.mjs:13', group: 'G-ORACLE-DATA', adapter: 'installer-contract.mjs', proof: 'presetOfAxes/presetsOfAxes/defaultSuiteFor do registry' },
  { file: 'installer/__tests__/cli.spec.mjs:24', group: 'G-CLI-TUI', adapter: 'installer-contract.mjs', proof: '15 nomes via op; segredo por stdin; stdout/stderr/exit comparados' },
  { file: 'installer/__tests__/wizard.spec.mjs:11', group: 'G-CLI-TUI', adapter: 'installer-contract.mjs', proof: '14 nomes via op; transcript W0..W7/W2m comparado' },
  { file: 'installer/__tests__/suite.spec.mjs:26', group: 'G-CLI-TUI', adapter: 'installer-contract.mjs', proof: '18 nomes via op; 0 writes no aborto re-provado por hash' },
  { file: 'installer/__tests__/checks.spec.mjs:17', group: 'G-CLI-TUI', adapter: 'installer-contract.mjs', proof: 'runChecks/requireVerifiedBackup/main via op; vereditos idênticos' },
  { file: 'installer/__tests__/merge-manifest.spec.mjs:16 + merge-v2-only.spec.mjs:33', group: 'G-CLI-TUI', adapter: 'installer-contract.mjs', proof: 'merge via op; normalizeSection/hasHarnessSection puros' },
  { file: 'installer/__tests__/installer-upgrade-regression.spec.mjs:32', group: 'G-CLI-TUI', adapter: 'installer-contract.mjs', proof: 'runUpgrade/main via op; ordem backup→apply preservada' },
  { file: 'installer/__tests__/doctor.spec.mjs:13', group: 'G-CLI-TUI', adapter: 'installer-contract.mjs', proof: 'runDoctor/runUpgrade via op; mensagem 4-linhas byte-comparável' },
  { file: 'installer/__tests__/preflight.spec.mjs:13', group: 'G-CLI-TUI', adapter: 'installer-contract.mjs', proof: 'preflight/inventory/backup via op; MIN_NODE_VERSION do registry' },
  { file: 'installer/__tests__/qa.spec.mjs:18 (+ :229, :243)', group: 'G-CLI-TUI', adapter: 'installer-contract.mjs', proof: 'promptAnswers/runWizard via op também no caminho dinâmico' },
  { file: 'installer/__tests__/mobile.spec.mjs:7', group: 'G-CLI-TUI', adapter: 'installer-contract.mjs', proof: 'collectIncoming via op; detecção pubspec.yaml sem escrita' },
  { file: 'installer/__tests__/mustfix-f1.spec.mjs:17', group: 'G-CLI-TUI', adapter: 'installer-contract.mjs', proof: 'printPlan/runWizard/runCli via op; envelope com prévia sanitizada' },
  { file: 'installer/__tests__/dogfood-write-zone.spec.mjs:25', group: 'G-CLI-TUI', adapter: 'installer-contract.mjs', proof: 'assertDogfoodTarget guarda lexical pura; fixture symlink inalterada' },
  { file: 'leitura de fonte (cli:307, generate:37, qa:110, wizard:1007, suite:65)', group: 'G-CLI-TUI', adapter: 'oráculo-materializado', proof: 'canários de synthesize/source leem c63e333, não install.mjs do HEAD' },
])

const BY_NAME = Object.freeze(Object.fromEntries(Object.entries(DESTINATIONS).flatMap(([cls, names]) => names.map((n) => [n, cls]))))

export function destinationOf(name) {
  return BY_NAME[name] ?? null
}

export function assertInventory() {
  const names = Object.values(DESTINATIONS).flat()
  if (CONSUMER_ROUTES.length !== 22) throw new Error('inventário: 22 consumidores esperados')
  if (names.length !== 75 || new Set(names).size !== 75) throw new Error('inventário: 75 exports únicos esperados')
  if (INTERNAL_EXPORTS.length !== 20) throw new Error('inventário: 20 exports internos esperados')
  if (OP_NAMES.length !== 31) throw new Error('inventário: 31 ops esperadas')
  for (const [cls, group] of [['G-INJ', 3], ['G-DOGFOOD', 2], ['G-ORACLE-DATA', 4], ['G-CLI-TUI', 13]]) {
    if (CONSUMER_ROUTES.filter((r) => r.group === cls).length !== group) throw new Error(`inventário: grupo ${cls}`)
  }
  return { consumers: CONSUMER_ROUTES.length, exports: names.length, internal: INTERNAL_EXPORTS.length, ops: OP_NAMES.length }
}
