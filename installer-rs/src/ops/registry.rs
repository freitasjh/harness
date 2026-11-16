// Dados congelados do oráculo — transcritos de installer/contract-registry.mjs:111-410 @ c63e333.
// NENHUM valor é derivado do binário sob teste. Presets/chaves/defaults NÃO são inventados.
// A ordem de STACK_VALUES é a autoridade de presetOfAxes (install.mjs:549-570).

pub const STACK_VALUES: [&str; 12] = [
    "node", "java+vue", "java+react", "outra", "node-esm", "flutter", "dart",
    "rust", "nestjs", "node+react", "nestjs+react", "rust+react",
];

pub struct Profile {
    pub name: &'static str,
    pub backend_axis: &'static str,
    pub frontend_axis: &'static str,
    pub backend: &'static str,
    pub frontend: &'static str,
    pub suite_full: Option<&'static str>,
    pub analyze: Option<&'static str>,
    pub mcp: &'static [&'static str],
    pub module_map: &'static [(&'static str, &'static str)],
    pub stacks: &'static [&'static str],
}

const NODE_BACKEND: &str = "N/A — no Java/Maven backend declared by destination Q&A; Node-only stack";
const NODE_FRONTEND: &str = "N/A — no Vue/Vite frontend declared by destination Q&A; Node-only stack";
const CHROME: &[&str] = &["chrome-devtools"];

pub static PROFILES: [Profile; 12] = [
    Profile { name: "node", backend_axis: "node", frontend_axis: "none", backend: NODE_BACKEND, frontend: NODE_FRONTEND, suite_full: Some("node --test"), analyze: None, mcp: CHROME, module_map: &[], stacks: &[] },
    Profile { name: "java+vue", backend_axis: "java", frontend_axis: "vue", backend: "java+vue backend (declared via Q&A)", frontend: "java+vue frontend (declared via Q&A)", suite_full: None, analyze: None, mcp: CHROME, module_map: &[], stacks: &[] },
    Profile { name: "java+react", backend_axis: "java", frontend_axis: "react", backend: "java+react backend (declared via Q&A)", frontend: "java+react frontend (declared via Q&A)", suite_full: None, analyze: None, mcp: CHROME, module_map: &[], stacks: &["react"] },
    Profile { name: "outra", backend_axis: "other", frontend_axis: "other", backend: "outra backend (declared via Q&A)", frontend: "outra frontend (declared via Q&A)", suite_full: None, analyze: None, mcp: CHROME, module_map: &[], stacks: &[] },
    Profile { name: "node-esm", backend_axis: "node", frontend_axis: "none", backend: NODE_BACKEND, frontend: NODE_FRONTEND, suite_full: Some("node --test"), analyze: None, mcp: CHROME, module_map: &[], stacks: &[] },
    Profile { name: "flutter", backend_axis: "flutter", frontend_axis: "flutter", backend: "flutter/dart mobile (Q&A)", frontend: "flutter/dart mobile (Q&A)", suite_full: Some("flutter test"), analyze: Some("dart analyze"), mcp: &["marionette_mcp", "dart"], module_map: &[("lib", "lib"), ("test", "test")], stacks: &["flutter", "dart"] },
    Profile { name: "dart", backend_axis: "dart", frontend_axis: "none", backend: "dart package (Q&A)", frontend: "dart package (Q&A)", suite_full: Some("dart test"), analyze: Some("dart analyze"), mcp: &["dart"], module_map: &[("lib", "lib"), ("test", "test")], stacks: &["dart"] },
    Profile { name: "rust", backend_axis: "rust", frontend_axis: "none", backend: "rust backend (declared via Q&A)", frontend: "rust frontend (declared via Q&A)", suite_full: None, analyze: None, mcp: CHROME, module_map: &[], stacks: &["rust"] },
    Profile { name: "nestjs", backend_axis: "nestjs", frontend_axis: "none", backend: "nestjs backend (declared via Q&A)", frontend: "nestjs frontend (declared via Q&A)", suite_full: None, analyze: None, mcp: CHROME, module_map: &[], stacks: &["nestjs"] },
    Profile { name: "node+react", backend_axis: "node", frontend_axis: "react", backend: "node+react backend (declared via Q&A)", frontend: "node+react frontend (declared via Q&A)", suite_full: None, analyze: None, mcp: CHROME, module_map: &[], stacks: &["react"] },
    Profile { name: "nestjs+react", backend_axis: "nestjs", frontend_axis: "react", backend: "nestjs+react backend (declared via Q&A)", frontend: "nestjs+react frontend (declared via Q&A)", suite_full: None, analyze: None, mcp: CHROME, module_map: &[], stacks: &["nestjs", "react"] },
    Profile { name: "rust+react", backend_axis: "rust", frontend_axis: "react", backend: "rust+react backend (declared via Q&A)", frontend: "rust+react frontend (declared via Q&A)", suite_full: None, analyze: None, mcp: CHROME, module_map: &[], stacks: &["rust", "react"] },
];

pub fn profile_of(stack: &str) -> Option<&'static Profile> {
    PROFILES.iter().find(|p| p.name == stack)
}

pub fn default_suite(stack: &str) -> &'static str {
    profile_of(stack).and_then(|p| p.suite_full).unwrap_or("node --test")
}

pub fn preset_of_axes(backend: &str, frontend: &str) -> Option<&'static str> {
    for name in STACK_VALUES {
        if let Some(p) = profile_of(name) {
            if p.backend_axis == backend && p.frontend_axis == frontend {
                return Some(p.name);
            }
        }
    }
    None
}

pub const AXIS_BACKEND: [&str; 8] = ["java", "node", "rust", "nestjs", "dart", "flutter", "other", "none"];
pub const AXIS_FRONTEND: [&str; 6] = ["vue", "react", "dart", "flutter", "other", "none"];

pub struct Question {
    pub key: &'static str,
    pub kind: &'static str,
    pub optional: bool,
    pub secret: bool,
}

pub static QUESTIONS: [Question; 7] = [
    Question { key: "project", kind: "name", optional: false, secret: false },
    Question { key: "stack", kind: "stack", optional: false, secret: false },
    Question { key: "backend", kind: "backend", optional: true, secret: false },
    Question { key: "frontend", kind: "frontend", optional: true, secret: false },
    Question { key: "suiteCommand", kind: "command", optional: false, secret: false },
    Question { key: "pluginsDir", kind: "path", optional: false, secret: false },
    Question { key: "deployToken", kind: "string", optional: false, secret: true },
];

pub const SKILLS_BY_AXIS: [(&str, &[&str]); 2] = [
    ("frontend=react", &["frontend-vue-specialist"]),
    ("frontend=vue", &["frontend-react-specialist"]),
];
pub const RULES_BY_AXIS: [(&str, &[&str]); 2] = [
    ("frontend=react", &["frontend-coding-standards.md"]),
    ("frontend=vue", &["frontend-react-coding-standards.md"]),
];

pub const INCOMING_ROOTS: [&str; 6] = [
    ".agents/agents", ".agents/rules", ".agents/schemas", ".agents/skills", ".opencode/plugins", "opencode.json",
];
pub const INCOMING_EXCLUDE: [&str; 2] = ["node_modules", ".git"];
pub const CONSUMER_EXCLUDED_PREFIX: &str = ".opencode/plugins/__tests__/";
pub const VENDOR_LOCK_NAME: &str = ".vendor-lock.json";
pub const MANIFEST_NAME: &str = ".harness-install.json";

pub fn axis_keys(backend: Option<&str>, frontend: Option<&str>) -> Vec<String> {
    let mut out = Vec::new();
    if let Some(b) = backend {
        if AXIS_BACKEND.contains(&b) { out.push(format!("backend={}", b)); }
    }
    if let Some(f) = frontend {
        if AXIS_FRONTEND.contains(&f) { out.push(format!("frontend={}", f)); }
    }
    out
}
