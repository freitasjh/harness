# Handoff schema

Todo agente retorna JSON com: status, artifacts, evidence, decisions, open_questions, next_gate, brainStore.

code-reviewer adiciona approval_status, critical_issues, attention_issues, must_fix_before_done, evidence.
security-engineer adiciona security_status, findings, baseline, handoff.
qa-engineer grava somente harness/<demand>.json conforme harness-report e retorna o caminho.

Status permitidos: success, partial, failure. next_gate deve ser um rotulo P0..P6 ou Completed.
