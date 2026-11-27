# harness-config — stub de compatibilidade

Fonte única de dados: harness.config.json. Mapa de chaves e contrato operacional:
.agents/skills/harness-bootstrap/SKILL.md.
Regras e plugins nunca copiam comandos, portas ou paths da prosa.
Config ausente/inválido é fail-closed no loader; modo de gate vem do host, nunca do config.
