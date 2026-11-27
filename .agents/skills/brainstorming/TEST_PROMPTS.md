# Unified Brainstorming — Test Prompts

Use a fresh conversation for each test so the flow starts clean. Invoke the
project-owned `project-brainstorming` skill (or the `brainstorming` /
`backend-brainstorming` aliases in test 9), then paste the prompt exactly.
Check the expected signal; the failure signal means the unified flow is not
being followed.

## 1. Trivial request — no brainstorm needed

**Prompt:** "Muda o texto do botão de 'Salvar' para 'Salvar alterações' e me diz onde ficou."

**Expected:** no questions, no design doc; makes the one-line change and
reports the file and line. If there is no app in the workspace, says so
plainly instead of inventing one.

**Fails if:** it starts a multi-question discovery or writes a spec for a
copy change.

## 2. Open idea — one question, no menu

**Prompt:** "Quero um site para minha padaria."

**Expected:** one open question in plain terms about what someone should do
when they land there, plus why that answer changes what gets built. Ends the
turn after the question.

**Fails if:** it offers A/B/C options before hearing the reason, or starts
listing tech stack.

## 3. Backend domain rule — backend lens loads

**Prompt:** "Preciso permitir cancelamento de pedidos já pagos, com estorno, sem deixar o pedido em estado inválido. Queremos discutir isso antes de programar."

**Expected:** reads `backend.md`; echoes the request and asks one open
question about the rule that must never break, valid transitions, or how a
late settlement should behave. No framework is assumed. No code is written.

**Fails if:** it jumps to JPA/Flyway/RabbitMQ examples as if they were the
project's stack, or asks five domain questions at once.

## 4. Frontend choice — visual offer comes at the right time

**Prompt:** "Quero uma tela de checkout. Acho que pode ser um passo só ou um wizard; quero ver como fica."

**Expected:** reads `frontend.md`, keeps the "one step vs wizard" decision in
text until the look itself is being decided, then offers the browser tab in
its own message. Does not push a mockup before the offer is accepted.

**Fails if:** it opens the visual companion immediately, or skips loading
states and keyboard paths in the later design.

## 5. Full-stack feature — one flow, both lenses

**Prompt:** "Vamos fazer login por magic link: preciso da API, do e-mail e da tela onde a pessoa cola o código."

**Expected:** reads both lenses and runs one conversation. The design covers
backend contracts/idempotency and frontend states/accessibility, then asks
for one approval. No second gate for the backend part.

**Fails if:** it produces two separate design docs or two approval steps.

## 6. Open stack decision — options grounded in the repo

**Prompt:** "Ainda não escolhemos a stack. O que você recomenda?"

**Expected:** inspects manifests, lockfiles, configs, and existing modules
first; reports what is observed; then gives 2–3 concrete options with
trade-offs and a recommendation. Every new choice is marked as a proposal.

**Fails if:** it names a stack before recon, or treats an example from a lens
as the project's stack.

## 7. Incomplete spec — confirm before building

**Prompt:** "Segue o spec: endpoint POST /charges retorna 202. O provedor manda webhook. Implementa aí."

**Expected:** around 200 words echoing the request, the observed codebase,
and the risk it spotted; invites corrections; asks one open question about
the biggest gap (for example retries/duplicate deliveries). Does not
implement.

**Fails if:** it fills the gap silently and starts writing code.

## 8. Human delegates the how — concrete calls, recorded as proposals

**Prompt:** "Não entendo dessas decisões técnicas. Decide por mim e me mostra o que ficou decidido."

**Expected:** makes clean calls, states each in one plain line with a short
reason, and records them in the design as its own proposals. Still asks a
question only if the answer would change what gets built.

**Fails if:** it hides the decisions or claims the human approved them.

## 9. Legacy alias — redirects to the unified skill

**Prompt:** "Invoca o backend-brainstorming e discute esse fluxo de cobrança."

**Expected:** follows the alias to `project-brainstorming/SKILL.md`, loads
`backend.md`, and uses the single gate. The old staff-review/visual files are
not used as a competing process.

**Fails if:** it runs the old 129-line flow or asks for a second approval.

## 10. Hard gate — no implementation before approval

**Prompt:** "Já falei o que quero. Pode começar a programar agora."

**Expected:** if the request is non-trivial, lays out approaches, writes the
design, and asks for approval before any code. If the human explicitly opts
out of the questions, states the major calls and proceeds — but only after
that opt-out is explicit.

**Fails if:** "já falei o que quero" is treated as opting out of the gate.

## 11. Review step — one round of questions

**Prompt:** (after a design exists) "O documento está em docs/superpowers/specs/2026-11-24-cobranca-design.md. Pode fechar e me entregar?"

**Expected:** reads `review-prompt.md`, passes the loaded lenses and observed
stack, sorts findings into already answered / minor calls / genuinely theirs,
asks at most one prioritized round, and lists the calls it made.

**Fails if:** it delivers the document without review or produces several
rounds of questions.

## 12. Spike cue — throwaway stays throwaway

**Prompt:** "Não sei se o provedor reenvia o mesmo webhook. Será que a gente testa isso?"

**Expected:** offers a small throwaway spike to observe the real payload or
behavior, labels it clearly, and says production code still needs the design
approval. Brings the finding back into the conversation.

**Fails if:** spike code is written into the product or promoted without
going through the gate again.
