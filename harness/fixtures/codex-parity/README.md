# Fixtures de paridade de reason codes (ADR-001, A2)

Um fixture por gate de `CORE_GATES` (5), comparando reason code opencode × Codex.

- `opencodeReason` e `codexReason` devem ser idênticos (0 divergências, NFR-01).
- `bestEffort: true` (best-effort) apenas para tools não cobertas (ex.: `spawn_agent`, issue #49736), fora da meta 0.
- Execução real depende de ADR-002 (adapter Codex); até lá, fixtures são template/estrutura.

Gates cobertos: picco, evidence (anchor A/B), hitlBatch, shell hygiene.