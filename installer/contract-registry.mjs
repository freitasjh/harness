// gerado/congelado do oráculo c63e333 (worktree detach) — NÃO editar à mão.
// Fronteira ADR-001/PRD-3. Dados puros: nenhuma lógica de instalação.
// Os 6 mapas abaixo são byte-idênticos a install.mjs@c63e333 (JSON.stringify + sha256).

export const REGISTRY_MAP_DIGESTS = Object.freeze({
  "AXIS_IDS": "02215342cba5c3541ffce75fdb27d122168135c1ef3273d776eb5e51345c31b2",
  "SKILLS_BY_AXIS": "793e3eca8f6391b1f58291e07a2e1a643b277c66654c5c37fe9ea4923e24b931",
  "SKILLS_COMMON": "6b9d86f7a54318cd094966c96f5e41c3279d1ebc113d9f8213cd29f4a1b39491",
  "RULES_BY_AXIS": "8f823529157dfd54de3eab926d36d4636ec41f1b48a15e66ea9f745dcaf72e3b",
  "RULES_COMMON": "66e4a89fe5849a502144d5eff183e3e9f2ed50fec41cb7223a2caf54594e305d",
  "STACKS_FOR_EXCEPTIONS": "10d9874f4e916b70980319b45efae3e3d3266533fb2ffb1017c395f70c769c08"
})
export const REGISTRY_ALL_DIGEST = "e13f11d51c840588654f10765241c445b88e3adb090285296dead1c6006afb00"

export const AXIS_IDS = Object.freeze({
  "backend": [
    "java",
    "node",
    "rust",
    "nestjs",
    "dart",
    "flutter",
    "other",
    "none"
  ],
  "frontend": [
    "vue",
    "react",
    "dart",
    "flutter",
    "other",
    "none"
  ]
})

export const SKILLS_BY_AXIS = Object.freeze({
  "frontend=react": [
    "frontend-vue-specialist"
  ],
  "frontend=vue": [
    "frontend-react-specialist"
  ]
})

export const SKILLS_COMMON = Object.freeze([
  "context-compressor",
  "dev-planner",
  "feature-status-dashboard",
  "frontend-design",
  "frontend-react-specialist",
  "harness-installer",
  "harness-report",
  "java-architecture-specialist",
  "jira-microtask-breaker",
  "nestjs-architecture-specialist",
  "node-architecture-specialist",
  "prompt-optimizer",
  "sdd-architecture-board",
  "sdd-compiler",
  "sdd-feedback",
  "rust-architecture-specialist",
  "security-review",
  "template-best-practices",
  "template-deepsearch",
  "template-structure",
  "ui-ux-pro-max"
])

export const RULES_BY_AXIS = Object.freeze({
  "frontend=react": [
    "frontend-coding-standards.md"
  ],
  "frontend=vue": [
    "frontend-react-coding-standards.md"
  ]
})

export const RULES_COMMON = Object.freeze([
  "brain-context.md",
  "gate-contract.md",
  "harness-config.md",
  "prd-adr-pipeline.md",
  "sdd-workflow-standard.md",
  "workflow-rules.md"
])

export const STACKS_FOR_EXCEPTIONS = Object.freeze({
  "flutter+flutter": [
    "flutter",
    "dart"
  ]
})

export const DENYLIST = Object.freeze([
  "taskflow",
  "vuetify",
  "primevue",
  "lombok",
  "mapstruct",
  "restassured"
])

export const MANIFEST_NAME = Object.freeze(".harness-install.json")

export const MIN_NODE_VERSION = Object.freeze([
  20,
  0,
  0
])

export const QUESTIONS = Object.freeze([
  {
    "key": "project",
    "prompt": "Nome do projeto?",
    "kind": "name"
  },
  {
    "key": "stack",
    "prompt": "Stack do destino? (node/java+vue/java+react/outra/node-esm/flutter/dart/rust/nestjs/node+react/nestjs+react/rust+react)",
    "kind": "stack"
  },
  {
    "key": "backend",
    "prompt": "Backend? (java/node/rust/nestjs/dart/flutter/other/none)",
    "kind": "backend",
    "optional": true
  },
  {
    "key": "frontend",
    "prompt": "Frontend? (vue/react/dart/flutter/other/none)",
    "kind": "frontend",
    "optional": true
  },
  {
    "key": "suiteCommand",
    "prompt": "Comando da suite de testes?",
    "kind": "command"
  },
  {
    "key": "pluginsDir",
    "prompt": "Diretorio de plugins no destino?",
    "kind": "path"
  },
  {
    "key": "deployToken",
    "prompt": "Token de deploy (sensivel, opcional)?",
    "kind": "string",
    "secret": true
  }
])

export const STACK_PROFILES = Object.freeze({
  "node-esm": {
    "axes": {
      "backend": "node",
      "frontend": "none"
    },
    "backend": "N/A — no Java/Maven backend declared by destination Q&A; Node-only stack",
    "frontend": "N/A — no Vue/Vite frontend declared by destination Q&A; Node-only stack",
    "commands": {
      "suiteFull": "node --test",
      "unit": "node --test"
    },
    "mcp": [
      "chrome-devtools"
    ],
    "moduleMap": {},
    "stacks": []
  },
  "node": {
    "axes": {
      "backend": "node",
      "frontend": "none"
    },
    "backend": "N/A — no Java/Maven backend declared by destination Q&A; Node-only stack",
    "frontend": "N/A — no Vue/Vite frontend declared by destination Q&A; Node-only stack",
    "commands": {
      "suiteFull": "node --test",
      "unit": "node --test"
    },
    "mcp": [
      "chrome-devtools"
    ],
    "moduleMap": {},
    "stacks": []
  },
  "java+vue": {
    "axes": {
      "backend": "java",
      "frontend": "vue"
    },
    "backend": "java+vue backend (declared via Q&A)",
    "frontend": "java+vue frontend (declared via Q&A)",
    "commands": {},
    "mcp": [
      "chrome-devtools"
    ],
    "moduleMap": {},
    "stacks": []
  },
  "java+react": {
    "axes": {
      "backend": "java",
      "frontend": "react"
    },
    "backend": "java+react backend (declared via Q&A)",
    "frontend": "java+react frontend (declared via Q&A)",
    "commands": {},
    "mcp": [
      "chrome-devtools"
    ],
    "moduleMap": {},
    "stacks": [
      "react"
    ]
  },
  "rust": {
    "axes": {
      "backend": "rust",
      "frontend": "none"
    },
    "backend": "rust backend (declared via Q&A)",
    "frontend": "rust frontend (declared via Q&A)",
    "commands": {},
    "mcp": [
      "chrome-devtools"
    ],
    "moduleMap": {},
    "stacks": [
      "rust"
    ]
  },
  "nestjs": {
    "axes": {
      "backend": "nestjs",
      "frontend": "none"
    },
    "backend": "nestjs backend (declared via Q&A)",
    "frontend": "nestjs frontend (declared via Q&A)",
    "commands": {},
    "mcp": [
      "chrome-devtools"
    ],
    "moduleMap": {},
    "stacks": [
      "nestjs"
    ]
  },
  "node+react": {
    "axes": {
      "backend": "node",
      "frontend": "react"
    },
    "backend": "node+react backend (declared via Q&A)",
    "frontend": "node+react frontend (declared via Q&A)",
    "commands": {},
    "mcp": [
      "chrome-devtools"
    ],
    "moduleMap": {},
    "stacks": [
      "react"
    ]
  },
  "nestjs+react": {
    "axes": {
      "backend": "nestjs",
      "frontend": "react"
    },
    "backend": "nestjs+react backend (declared via Q&A)",
    "frontend": "nestjs+react frontend (declared via Q&A)",
    "commands": {},
    "mcp": [
      "chrome-devtools"
    ],
    "moduleMap": {},
    "stacks": [
      "nestjs",
      "react"
    ]
  },
  "rust+react": {
    "axes": {
      "backend": "rust",
      "frontend": "react"
    },
    "backend": "rust+react backend (declared via Q&A)",
    "frontend": "rust+react frontend (declared via Q&A)",
    "commands": {},
    "mcp": [
      "chrome-devtools"
    ],
    "moduleMap": {},
    "stacks": [
      "rust",
      "react"
    ]
  },
  "outra": {
    "axes": {
      "backend": "other",
      "frontend": "other"
    },
    "backend": "outra backend (declared via Q&A)",
    "frontend": "outra frontend (declared via Q&A)",
    "commands": {},
    "mcp": [
      "chrome-devtools"
    ],
    "moduleMap": {},
    "stacks": []
  },
  "flutter": {
    "axes": {
      "backend": "flutter",
      "frontend": "flutter"
    },
    "backend": "flutter/dart mobile (Q&A)",
    "frontend": "flutter/dart mobile (Q&A)",
    "commands": {
      "suiteFull": "flutter test",
      "unit": "flutter test",
      "analyze": "dart analyze"
    },
    "mcp": [
      "marionette_mcp",
      "dart"
    ],
    "moduleMap": {
      "lib": "lib",
      "test": "test"
    },
    "stacks": [
      "flutter",
      "dart"
    ]
  },
  "dart": {
    "axes": {
      "backend": "dart",
      "frontend": "none"
    },
    "backend": "dart package (Q&A)",
    "frontend": "dart package (Q&A)",
    "commands": {
      "suiteFull": "dart test",
      "unit": "dart test",
      "analyze": "dart analyze"
    },
    "mcp": [
      "dart"
    ],
    "moduleMap": {
      "lib": "lib",
      "test": "test"
    },
    "stacks": [
      "dart"
    ]
  }
})

export const STACK_VALUES = Object.freeze([
  "node",
  "java+vue",
  "java+react",
  "outra",
  "node-esm",
  "flutter",
  "dart",
  "rust",
  "nestjs",
  "node+react",
  "nestjs+react",
  "rust+react"
])

export const VERSION = Object.freeze("1.0.0")

export const W2M_MARKER = Object.freeze("W2m menu manual em 2 passos (ADR-004/D-A)")

export const WIZARD_MENU = Object.freeze([
  {
    "key": "1",
    "label": "App Flutter",
    "stack": "flutter"
  },
  {
    "key": "2",
    "label": "Pacote Dart",
    "stack": "dart"
  },
  {
    "key": "3",
    "label": "Projeto Node.js",
    "stack": "node",
    "note": "ESM incluso"
  },
  {
    "key": "4",
    "label": "Aplicação web (backend + frontend)",
    "stack": "java+vue",
    "next": "frontend"
  },
  {
    "key": "5",
    "label": "Outro projeto",
    "stack": "outra"
  }
])

export const REGISTRY_MAPS = Object.freeze({
  AXIS_IDS,
  SKILLS_BY_AXIS,
  SKILLS_COMMON,
  RULES_BY_AXIS,
  RULES_COMMON,
  STACKS_FOR_EXCEPTIONS,
})

export const REGISTRY_DATA = Object.freeze({
  DENYLIST,
  MANIFEST_NAME,
  MIN_NODE_VERSION,
  QUESTIONS,
  STACK_PROFILES,
  STACK_VALUES,
  VERSION,
  W2M_MARKER,
  WIZARD_MENU,
})
