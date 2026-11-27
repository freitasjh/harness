# Claude — harness v2

Este projeto usa o harness multiplataforma. As instruções canônicas estão em @AGENTS.md.

Use as skills publicadas em `.claude/skills/` e os papéis em `.claude/agents/`.
Regras executáveis vivem em `gate.js`/hooks; prosa descreve, gate nega.

Nunca edite paths protegidos (`harness.config.json`, `.opencode/**`, `.codex/**`, `.agents/**`, `.claude/**`) sem delegação explícita e trailer `Harness-Gate-Change`.
