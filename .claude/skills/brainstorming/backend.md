# Backend Lens

Loaded by `SKILL.md` when the work touches domain rules, persistence,
migrations, API or event contracts, jobs, integrations, backend security, or
scale. It adds territory to the common conversation; it does not replace the
common flow, the review, or the approval gate.

## What To Inspect First

Read the project before asking. Look for:

- bounded contexts, domain entities/aggregates, and service boundaries
- migrations, schemas, constraints, indexes, and data ownership
- API definitions, controllers/resolvers, payload validation, error contracts
- message brokers, queues, scheduled jobs, webhooks, and external clients
- auth setup, tenant boundaries, configuration, and deployment topology
- the actual stack: runtime, framework, data layer, broker, observability,
  test strategy, and how each is configured

Only ask about what is missing and would change the design. Never reopen a
decision the project already made.

## Territory To Cover

Never read this as a questionnaire. Use it to judge whether the design is
ready. Ask open questions in domain terms first; offer technical options only
once the behavior is clear.

- **Domain invariants and state lifecycle.** Which rules must never be
  broken? What are the valid states, transitions, terminal states, and
  reversal or compensation paths?
- **Consistency and concurrency.** Where is a single ACID transaction
  required, and where is eventual consistency acceptable? What happens when
  two requests mutate the same aggregate at once?
- **Integrations and idempotency.** For external APIs, webhooks, files, or
  queues, what happens on duplicates, timeouts, out-of-order delivery,
  retries, and permanent failure? Where does the dead-letter path go?
- **Data volume and lifecycle.** Expected throughput and row growth,
  retention/archiving, soft vs hard delete, audit trail, and tenant
  isolation rules.
- **Security and observability.** Who may perform each operation, how tenant
  context is enforced, what must never reach logs, and which signals will
  show that the system is unhealthy.
- **Anti-goals.** What would make this fail in production even if all unit
  tests pass: table locks during deploy, N+1 queries, cascading timeouts,
  dual writes, or leaked PII.

## How To Make The How Calls

- Build on the stack and conventions already in the project.
- When the human partner describes an outcome, choose the how yourself:
  transaction boundary, mapping rules, indexing, retry policy, error
  semantics. State each as your proposal with a one-line reason.
- When they raise storage, concurrency, infrastructure, or integration
  trade-offs, give 2–3 concrete options. For each, state operational
  complexity, consistency/latency, failure behavior, and fit with the
  observed stack. Recommend one.
- Examples in this lens (outbox, row locks, queues) are illustrations, not
  defaults. Mark any newly introduced mechanism as your proposal.

## Required Design Sections

When this lens is loaded, the written design adds:

1. **Domain model, invariants, and state transitions** — aggregates, rules
   that must never break, valid transitions, and concurrency control.
2. **Persistence and migration strategy** — tables/collections, constraints,
   indexes, isolation, and a safe migration/backfill plan for existing data.
3. **API and event contracts** — endpoints/messages, payloads, error codes,
   idempotency keys, retry and dead-letter semantics.
4. **Security, data lifecycle, and observability** — auth and tenant
   enforcement, retention, audit trail, PII redaction, metrics, and logs.

## Stack Profile To Fill

Fill this from the repository. Ask only about blanks that change the design.

- Runtime and framework, including versions that constrain choices
- Data layer: database, ORM/query layer, migration tool
- Async layer: broker, queue, scheduler, or none
- Auth and tenant model
- Deployment and configuration model
- Observability and test tooling

## Review Risks

The unified `review-prompt.md` asks these for backend work:

- missing unique constraints, read-check-write races, unclear transaction
  boundaries, and dual writes with external calls
- breaking DDL, missing backfill, and missing indexes for critical queries
- duplicate deliveries, unbounded retries, missing timeouts, and undefined
  dead-letter behavior
- cross-tenant lookups, missing authorization checks, and secrets/PII in logs
- unbounded list queries and synchronous I/O inside transactions

## Visual And Spike Cues

Use a sequence diagram, state machine, or ERD when a flow or relationship is
easier to inspect than to read; keep business rules themselves in text. Offer
a throwaway spike when external behavior or query performance is uncertain
(a real webhook payload, a parser, `EXPLAIN ANALYZE`). Label it throwaway and
bring the findings back before any implementation is approved.
