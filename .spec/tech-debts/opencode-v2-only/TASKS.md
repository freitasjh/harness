# Tech Debts — `opencode-v2-only`

> Origem: code review do Batch 1 (2026-10-19, `ses_eac1f5816ffe…`) + RT-02.
> Itens NÃO bloqueiam o `Completed` do ciclo; ficam rastreados.

| ID | Prio | Item | Evidência / por que | Dono |
|---|---|---|---|---|
| TD-01 | **P1** | **`atlas-ecm` e `taskflow` reproduzem a RECEITA EXATA do fatal**: `opencode.json` com shape v1/dual completo (`plugin` com caminhos locais + `plugins[]` + `agents` + `permissions`) **e** `.opencode/plugins/gate.js` com `setup()` retornando **objeto** (`alreadyRegistered`/`registered: []`). Varredura 2026-10-19. | Se o runtime carregar a lista de plugins desses projetos, o load morre com `TypeError: t is not a function` ⇒ `failed to reload plugins` ⇒ **registry global de agentes cai** (mesma classe do RT-02). | installer (Batch 2) + owner |
| TD-01b | **P1** | Demais projetos com `plugin` local (sem o `gate.js` fatal): `agentes`, `atlas-admin`, `atlasos`, `hive`, `medflow`; e `brain` (com `agents`+`plugins[]`+`permissions`). `harness` e `pagamento` já estão v2-only. | Mesma origem: o merge do instalador propagava o shape v1/dual — é o que o RF-04 (Batch 2) corrige para instalações novas; os projetos **existentes** precisam de migração. | installer (Batch 2) + owner |
| TD-07 | **P1** | `estudo/opencode.json` é **JSON INVÁLIDO** (`JSONDecodeError`) — o runtime não consegue ler a config desse projeto. | Varredura 2026-10-19. Config ilegível ⇒ fail-closed do loader / comportamento indefinido naquele workspace. | owner |
| TD-02 | P2 | `harness.config.json riskPaths` = `**/*Permission*` **não casa** `opencode.json` ⇒ mudança no modelo de permissão dos agentes **não** escala `e2eGreenfield` para `enforce`. | 🟢-13 do review; o Batch 1 mudou exatamente essa superfície sem escalar E2E. | config/rules |
| TD-03 | P3 | `opencode.json:5` mantém `"plugins": []` (chave da era dual) enquanto os testes só assertam `plugin.length === 0`. | 🟢-12; inofensivo — declarar ou remover. | owner |
| TD-04 | P3 | `HarnessValidator`/`HitlGuardrail` (`harness-validator.js:19`, `hitl-guardrail.js:19`) exportados mas não chamados por ninguém. | 🟢-14; mesma classe do `HarnessGate` (removido neste ciclo). | dev |
| TD-05 | P3 | `isOrchAllowlisted` (`gate.js:391-398`) não normaliza caminho **absoluto** ⇒ deny falso-positivo (`F-01`). | Pré-existente (não deste diff); passa a importar se a opção **A** for escolhida para o `permission.edit`. | dev |
| TD-06 | P3 | Restam **comentários** citando `HarnessGate` (documentam a remoção) — nenhuma referência de código. | Flag do dev no fecho do loop. | dev |
