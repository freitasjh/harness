# Unified Design Review Prompt

Use this once a project-sized design document exists. Dispatch a fresh
general-purpose subagent with the prompt below when one is available;
otherwise perform the audit yourself. Fill in the domain, the document path,
the lenses that were loaded, and the stack observed in the project.

```
You are a senior [DOMAIN] engineer reviewing a design document before an
implementation plan is made. You cannot talk to the author.

Read [DOCUMENT_PATH].

Loaded lenses: [CORE ONLY / BACKEND / FRONTEND / BACKEND + FRONTEND].
Observed stack: [WHAT THE PROJECT ACTUALLY USES, WITH SOURCES].

Audit for gaps where a builder would have to guess and a wrong guess would
change the plan. Check the common design first:

1. Intent, goals, non-goals, and anti-goals are explicit.
2. Constraints and the observed stack are stated, and new choices are marked
   as proposals rather than settled facts.
3. Approaches, trade-offs, the choice, and the reason are recorded.
4. Anything explicitly left to the builder is really an internal detail.

If the BACKEND lens was loaded, also check:

5. Data Integrity & Concurrency: unique constraints, read-check-write races,
   transaction boundaries, and dual writes with external calls.
6. Schema & Migration: breaking DDL, missing backfill, and missing indexes
   for critical query predicates.
7. Idempotency & Recovery: duplicate deliveries, missing idempotency keys,
   unbounded retries, missing timeouts, and undefined dead-letter behavior.
8. Tenancy & Security: tenant enforcement, authorization, and PII/secrets in
   logs.
9. Scale: unbounded list queries and synchronous I/O inside transactions.

If the FRONTEND lens was loaded, also check:

10. States: loading, empty, error, offline, partial, and success are designed.
11. Interaction: keyboard and focus paths, labels, validation recovery,
    contrast, motion, and responsive behavior are specified.
12. Data: client/server ownership, caching, and invalidation are clear.
13. Performance: list bounds, request waterfalls, and layout shift are
    addressed.
14. System fit: new components or styles do not bypass existing tokens and
    components without a reason.

Report ONLY the questions you still need answered before you could plan this
well. For each, give the question, why the answer changes the plan, and a
severity. Rank by severity.

Skip anything the document explicitly leaves to the builder, anything clearly
settled by the project's existing conventions, and wording nitpicks.

If nothing important is left, respond with: "nothing important left".
```

Sort the answers into three piles as described in `SKILL.md`: already
answered, minor calls you settle and mark as your own, and genuine questions
for your human partner. Bring the last pile in one prioritized message.
