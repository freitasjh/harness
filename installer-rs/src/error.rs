// Vocabulário de códigos do envelope — transcrito de installer/install.mjs:1529-1535 @ c63e333.
// MEDIÇÃO (architect S3, SPEC RF-07): 22 códigos no Set + UNKNOWN. O número 23 do ADR é
// herança registrada; a autoridade é o Set do oráculo. Nenhum código novo é inventado aqui.
pub const ERROR_CODES: [&str; 22] = [
    "BAD_ANSWER", "CORRUPT", "NO_STDIN", "USER_ABORT", "BACKUP_FAIL",
    "BACKUP_UNVERIFIED", "BAD_TARGET", "NODE_MIN", "UID_ROOT", "REINSTALL",
    "FOREIGN_MANIFEST", "OUTSIDE_TARGET", "DOGFOOD_GUARD", "MISSING_INCOMING",
    "SECRET_TTY", "manifest-missing", "config-missing", "json-invalid",
    "flagged-open", "literal-denied", "config-ref-missing", "plugin-parse",
];

pub const UNKNOWN: &str = "UNKNOWN";

/// `install.mjs:2943/2946` medem NOT_INSTALLED/MANIFEST_INVALID como `InstallError.code`,
/// mas `formatError:1538` os converte em UNKNOWN — nunca promover a código de envelope novo.
pub fn render_error_code(code: &str) -> String {
    if ERROR_CODES.contains(&code) {
        code.to_string()
    } else {
        UNKNOWN.to_string()
    }
}

#[derive(Debug, thiserror::Error)]
#[error("{what}")]
pub struct EngineError {
    pub code: String,
    pub what: String,
    pub why: String,
    pub fix: String,
    pub where_: String,
}

impl EngineError {
    pub fn new(code: &str, what: impl Into<String>, why: impl Into<String>, fix: impl Into<String>) -> Self {
        Self {
            code: render_error_code(code),
            what: what.into(),
            why: why.into(),
            fix: fix.into(),
            where_: "installer/install.mjs".into(),
        }
    }
}
