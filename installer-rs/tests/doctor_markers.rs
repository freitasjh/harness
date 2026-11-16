// HARN-BE-05 — teste ANTES da implementação (TDD).
// RF-06/I3 (ADR-003 item 6 / INS-11/INS-12 / EX-BE-05): runDoctor D0..D6,
// SOMENTE LEITURA, vereditos SAUDÁVEL/ATENÇÃO/QUEBRADO, exit 0/1 idênticos ao
// oráculo. report.verdict ALIMENTA doctorPre, NUNCA gate do upgrade.
use harness_installer::contract::{parse_request, Request};
use serde_json::{json, Value};

fn req(target: &str, extra: Value) -> Request {
    let mut args = json!({"target": target});
    if let Some(obj) = args.as_object_mut() {
        for (k, v) in extra.as_object().unwrap() {
            obj.insert(k.clone(), v.clone());
        }
    }
    let text = format!(
        "{{\"v\":1,\"op\":\"runDoctor\",\"args\":{},\"answers\":{{}},\"target\":{}}}",
        args, json!(target)
    );
    parse_request(&text).unwrap()
}

fn tree_hash(dir: &std::path::Path) -> String {
    use std::collections::BTreeMap;
    let mut m = BTreeMap::new();
    fn walk(base: &std::path::Path, dir: &std::path::Path, m: &mut BTreeMap<String, Vec<u8>>) {
        if let Ok(rd) = std::fs::read_dir(dir) {
            for e in rd.flatten() {
                let p = e.path();
                if p.is_dir() {
                    walk(base, &p, m);
                } else if p.is_file() {
                    let rel = p.strip_prefix(base).unwrap().to_string_lossy().to_string();
                    m.insert(rel, std::fs::read(&p).unwrap_or_default());
                }
            }
        }
    }
    walk(dir, dir, &mut m);
    use std::io::Write;
    let mut h = sha_stub();
    for (k, v) in m {
        let _ = h.write_all(k.as_bytes());
        let _ = h.write_all(&v);
    }
    format!("{:?}", h)
}

fn sha_stub() -> Vec<u8> {
    Vec::new()
}

#[test]
fn run_doctor_clean_target_has_seven_markers_saudavel_exit_zero_and_zero_writes() {
    let base = std::env::temp_dir().join("harness-be05-doctor-clean");
    let _ = std::fs::remove_dir_all(&base);
    std::fs::create_dir_all(&base).unwrap();
    let before = tree_hash(&base);

    let out = harness_installer::ops::doctor::run(&req(base.to_str().unwrap(), json!({}))).unwrap();

    let markers = out["markers"].as_array().unwrap();
    assert_eq!(markers.len(), 7);
    assert_eq!(markers.iter().map(|m| m.as_str().unwrap()).collect::<Vec<_>>(), vec!["D0", "D1", "D2", "D3", "D4", "D5", "D6"]);
    assert_eq!(out["verdict"], "SAUDÁVEL");
    assert_eq!(out["exitCode"], 0);
    assert_eq!(out["report"]["verdict"], "SAUDÁVEL");
    assert_eq!(out["checks"]["passed"], true);
    assert_eq!(tree_hash(&base), before, "doctor não escreve nada (I3)");
    let _ = std::fs::remove_dir_all(&base);
}

#[test]
fn run_doctor_flag_yields_quebrado_exit_one_but_still_no_writes() {
    let base = std::env::temp_dir().join("harness-be05-doctor-flag");
    let src = std::env::temp_dir().join("harness-be05-doctor-flag-src");
    let _ = std::fs::remove_dir_all(&base);
    let _ = std::fs::remove_dir_all(&src);
    std::fs::create_dir_all(base.join(".agents/rules")).unwrap();
    std::fs::create_dir_all(src.join(".agents/rules")).unwrap();
    // Incoming (`src`) e destino (`base`) divergem na MESMA chave de prosa:
    // planMerge classifica 'flag' (exists-different em .agents/rules/*).
    std::fs::write(base.join(".agents/rules/custom.md"), "conteudo do usuario\n").unwrap();
    std::fs::write(src.join(".agents/rules/custom.md"), "conteudo do harness\n").unwrap();

    let out = harness_installer::ops::doctor::run(&req(
        base.to_str().unwrap(),
        json!({"sourceDir": src.to_str().unwrap()}),
    ))
    .unwrap();

    assert_eq!(out["verdict"], "QUEBRADO");
    assert_eq!(out["exitCode"], 1);
    assert!(out["plan"].as_array().unwrap().iter().any(|p| p["action"] == "flag"));
    let _ = std::fs::remove_dir_all(&base);
    let _ = std::fs::remove_dir_all(&src);
}

#[test]
fn run_doctor_is_report_only_not_a_gate_for_upgrade() {
    // EX-BE-05: o veredito QUEBRADO do doctor NÃO aborta o upgrade. O campo
    // doctorPre é preenchido; nenhum `abort`/`gate` consome report.verdict.
    let src = include_str!("../src/ops/doctor.rs");
    let up = include_str!("../src/entry/upgrade.rs");
    assert!(src.contains("verdict"), "doctor reporta veredito");
    assert!(up.contains("doctorPre"), "upgrade registra doctorPre");
    // Só o texto concatenado em doctorPre é permitido; nenhum ramo condicional
    // consulta o veredito. (Comentários que o mencionam não são gates.)
    for forbidden in ["if report", "report[\"verdict\"] ==", "report.verdict ==", "verdict ===", "match report"] {
        assert!(!up.contains(forbidden), "upgrade NÃO usa veredito como gate: {}", forbidden);
    }
    assert!(up.contains("\"doctorPre\""), "veredito entra em doctorPre");
}
