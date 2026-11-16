use crate::contract::{parse_request, Request};
use serde_json::{json, Value};

pub fn req(op: &str, args: Value, answers: &Value, target: &str) -> Request {
    let text = format!(
        "{{\"v\":1,\"op\":\"{}\",\"args\":{},\"answers\":{},\"target\":{}}}",
        op, args, answers, json!(target)
    );
    parse_request(&text).expect("request interno de entrypoint")
}

pub fn answers_of(req: &Request) -> Value {
    req.answers.clone()
}

pub fn str_arg<'a>(req: &'a Request, key: &str) -> Option<&'a str> {
    req.args.get(key).and_then(|v| v.as_str())
}

pub fn bool_arg(req: &Request, key: &str) -> bool {
    req.args.get(key).and_then(|v| v.as_bool()).unwrap_or(false)
}

pub fn profile_stack(answers: &Value, req: &Request) -> String {
    answers.get("stack").and_then(|v| v.as_str()).map(str::to_string)
        .or_else(|| str_arg(req, "stack").map(str::to_string))
        .unwrap_or_else(|| "node".into())
}

pub fn collect_incoming(r: &Request, source_dir: Option<&str>, stack: &str) -> Result<Value, crate::error::EngineError> {
    let prof = crate::ops::registry::profile_of(stack);
    let stacks: Vec<String> = prof.map(|p| p.stacks.iter().map(|s| s.to_string()).collect()).unwrap_or_else(|| vec![stack.into()]);
    let args = json!({
        "sourceDir": source_dir.unwrap_or(""),
        "stacks": stacks,
        "stack": stack,
    });
    let target = str_arg(r, "target").or(r.target.as_deref()).unwrap_or("");
    crate::ops::incoming::collect(&req("collectIncoming", args, &json!({}), target))
}

pub fn generate_config(answers: &Value, incoming: &Value) -> Result<String, crate::error::EngineError> {
    let written: Vec<String> = incoming.as_object().map(|m| m.keys().cloned().collect()).unwrap_or_default();
    let args = json!({"answers": answers, "writtenPaths": written});
    let r = crate::ops::config::generate(&req("generateConfig", args, answers, ""));
    Ok(serde_json::to_string_pretty(&r?).unwrap_or_default())
}

pub fn dry_result(target: &str, answers: &Value, plan: &[Value]) -> Value {
    json!({
        "target": crate::ops::pathutil::resolve_path(target),
        "answers": crate::ops::manifest::serialize_answers(answers),
        "plan": plan,
        "applied": false,
        "dryRun": true,
        "checks": crate::ops::checks::dry_run_checks(),
        "backupDir": Value::Null,
        "exitCode": 0,
    })
}
