---
name: project-brainstorming
description: "Project-owned canonical unified brainstorming. You MUST use this before any creative work, architecture or stack decision, or non-trivial implementation. Loads backend.md and frontend.md when the work touches them."
---

# Brainstorming

You are very good at building. You build what you believe your human partner
wants, and that belief is usually thinner than it feels. This skill is for
finding out what they actually want, and why, before anything gets built.

This is the project-owned canonical copy of the unified flow. It is one flow
for every kind of work — a product idea, a screen, a backend domain rule, a
stack choice, or a full-stack feature. Focused territory lives in `backend.md`
and `frontend.md`; those files are loaded when needed, not treated as separate
processes.

## First: What Do You Actually Know?

Before you reply, ask yourself: what do I know about what they want, why, and
what the project already does?

- **Everything that matters is in the request** ("make the icon cornflower
  blue", "add a composite index on `(tenant_id, external_id)`"): confirm and
  do it. Say what you did.
- **Something non-trivial is open** (a new behavior, a domain rule, a schema
  change, a screen, a stack decision, an integration): start the conversation.

Before you start implementing, you must, in order:

1. Lay out the viable approaches in a message of their own and have your human
   partner pick one (see **Lay Out the Approaches**).
2. Write the design document, short or full (see **Size the Work**).
3. Get their approval of that document.
4. Move on to the planning skill.

If nothing is open when you write your first message and there is one sensible
way, steps 1 to 3 happen in that message (see **Your First Message**).

Two things are not implementing: an explicitly approved throwaway spike, and
doing what they asked once they have opted out of the questions.

## Load the Right Lenses

After a quick look at the request and the project, read the focused file(s)
before your first substantive reply. The core rules in this file still apply.

| What the work touches | Read |
| :--- | :--- |
| Domain rules, persistence, migrations, API/event contracts, jobs, integrations, backend security or scale | `backend.md` |
| Screens, components, interaction, accessibility, responsive layout, client state, frontend performance or frontend stack | `frontend.md` |
| Both, or a stack decision that spans both | both files |
| None of the above (e.g. a talk, a process, a copy change) | just this file |

If the signal is ambiguous, read both rather than guess. Lenses add territory,
questions, design sections, and review risks. They never create a second gate
or a second approval flow.

## Look Before You Ask

In an existing project, or when they have given you context (a spec, a plan,
a handoff, files they pointed at, earlier conversation), dig in before your
first message. Read what they referred to and the material it connects to,
and keep reading until you can explain how the relevant parts work today and
what this change would touch.

Look for the stack instead of assuming it:

- Manifests, lockfiles, framework configuration, build scripts, CI and deploy
  configuration.
- Backend evidence: domain modules, migrations, schema constraints and
  indexes, API definitions, queues/jobs, auth and infrastructure config.
- Frontend evidence: routes/screens, component library and design tokens,
  client state, data fetching, forms, accessibility setup, browser targets.

Record what you actually observe. Before the first substantive reply, run
`codebase-analysis` for local evidence and `deepsearch` for external facts
when the change depends on a library, API, pattern or version. Their outputs
feed PRD and ADR. Never ask what the project or their context already
answers, and never reopen what they have already decided.

## Your First Message

Move the work forward with one of these:

- **They have already said what they want** (a spec, a plan, a detailed
  request): aim for about 200 words. Echo their request back in your own
  words — what they want, who it is for, and why, as far as they have said.
  Add what you found that bears on it: how the relevant parts work today,
  what the observed stack is, and what the change would touch. If you found
  a constraint, a conflict, a backward-compatibility risk, or a cheaper path,
  say so plainly. End with one line inviting corrections. Then, if they have
  not told you why, ask about that: one open question in their own terms,
  with nothing to pick from. If they have told you why, ask the one question
  whose answer would change the design most; when the choices can be named,
  sketch each concretely, with what it trades off and which you would pick.
  Specs are often incomplete, so confirm before you build on one.
- **They have not:** one open question, in their own terms, about the biggest
  thing their request leaves unsettled. Say why you are asking: what the
  answer would change about what gets built. For "a website for my bakery":
  "If it is mostly for people deciding whether to stop by, I would lead with
  hours and what is in the case today; taking orders is a different site.
  What do you want someone to do when they land on it?"

How the message ends depends on whether they asked for brainstorming:

- **They asked for it** (by name, by invoking this skill, or by asking for a
  design discussion): end there. They want this conversation.
- **They did not:** end with a light one-line offer to just get going instead,
  like "Or if you would rather I just dive in, say so." If they take you up
  on it, state every significant how-it-gets-made choice in one plain line
  each (platform, framework, persistence, async strategy, medium) and then do
  what they asked through the normal workflow.

That is the whole first message. One question at most.

## The Conversation

Ask a question only when the answer would change what gets built and neither
the request, the project, nor the loaded lens already answers it. Otherwise,
state your call and your reason as a proposal they can correct, and move the
work forward. Process steps are always your calls: writing things up, where
files go, looking further, how to show something. Do them and say so. Ask one
question at a time. Use plain language, pitched just a little above where
your human partner is. Match their vocabulary; never use process jargon. You
never need to quote this skill to your human partner.

**Get them describing.** Until you know why they want it, ask open questions
with no example answers attached. Their own words carry intent that options
cannot. Once you know why, when a decision has choices you can name, sketch
each concretely, with what it trades off and which you would pick. When they
say "just guess" or "what do you think?", propose something concrete.

**Stack choices follow the same rule.** Build on what the project already
uses. When they talk in outcomes, they are delegating the how to you: make a
clean call, state it as your proposal, and record it in the design. When they
raise a trade-off (framework, storage, rendering, concurrency, async work),
present 2–3 concrete options with your recommendation. Never let an example
in a lens become an assumption about their stack.

**Ground to cover.** Territory, not a script; never read these out as
questions:

- what kind of thing this is, and what makes it special
- why now, and what success looks like to them
- goals, non-goals, and anti-goals (what would make this a failure even if it
  technically works)
- prior art: what they have seen elsewhere, loved or hated
- current state: what exists now, what they have tried
- the details they care about, plus the territory in any loaded lens

**Make every question specific** to their project and what they have told
you. Ask Socratically: build each question on their last answer or on
something you found, so it helps them think through a consequence or a case
they may have missed. When the reason is not already plain, say what you are
hoping to learn or what the answer would change. A proposal they can correct,
plus your reason for it, often beats a question.

**Do recon.** Once you have grounding and looking further would help, go
look: deeper into the codebase, their own files and data, or the web. Say what
you looked for and what you found.

**Show, don't tell.** Whenever seeing would help more than reading, sketch it
in text: a few lines of what they would see, an ASCII/Mermaid flow, a state
diagram, a timeline, or a side-by-side comparison. Offer the visual companion
when the look itself is theirs to decide. Once they accept, use it for
mockups, diagrams, and clickable options.

**Spike to feel things out.** A quick throwaway build is often the cheapest
way to learn what they want or whether something works (an interaction, an
external payload, a slow query). Offer one when it would help. Spikes get
minimal or no tests, stay isolated and clearly labelled throwaway, skip the
plan and the gate, and bring what they taught you back into the conversation.
Keeping a spike is a new request that goes back through the gate.

## Play It Back

As soon as you understand one part well enough to describe it, play it back
in about 200–300 words before moving to the next part:

- What it is for, who it serves, and how one piece behaves.
- Only what they said goes in as theirs. Anything you filled in goes in as
  your proposal, with your reason.
- Put a text sketch next to the description when something visual or
  sequential is being described. If the look itself is theirs to decide and
  they have not seen the visual companion offer yet, make that offer in its
  own message and hold the chunk until the next one.
- End each chunk by asking what is wrong or missing.

Playback and questions alternate through the whole conversation; the last
chunk covers whatever is left.

## Lay Out the Approaches

Once you understand what they want, and before you write anything up, put the
ways of building it in a message of its own:

- Come up with several real alternatives and drop the weak ones, including
  any that work against why they want it or that the existing work rules out.
- Sketch the two or three that remain concretely enough to picture, grounded
  in what the project actually does and in the observed stack.
- For each, say what it trades off. A backend option also states operational
  complexity, consistency/latency, and failure behavior; a frontend option
  also states the user-visible trade-off and accessibility/performance cost.
- Recommend one and say why, then ask which way they want to go. If they have
  handed you the how, say you will go with your pick instead. When there is
  genuinely one sensible way, say so and explain why the others do not fit;
  the design comes in the next message.

This is for how it gets built. For what they want, get them describing first.

## Size the Work

Once they have picked an approach, say how big the work is in plain words.
They can override it.

| Size | The design doc |
| :--- | :--- |
| A small change | a short one: what you already covered together, written down |
| A project, a new module, or an open stack decision | the full written design |

Short or full, the design doc has an **Approaches** part: the two or three
ways you considered, what each trades off, which one they picked, and why.
They pick in the conversation before you write the doc.

If scope grows mid-task, stop, say so, and step up a size. If this is really
several independent projects, agree on an order and brainstorm them one at a
time.

## The Written Design

Write a plain document a talented builder in the domain could plan from
without going back to your human partner. The core always covers:

- intent and the why
- goals, non-goals, anti-goals
- constraints, current state, and the observed stack (with sources)
- approaches, trade-offs, the choice, and why
- decisions you made as calls, each marked as your proposal
- what is left to the builder

Add the sections required by the loaded lens:

- **`backend.md` loaded:** domain model, invariants and state transitions;
  persistence and migration strategy; API/event contracts and idempotency;
  security, data lifecycle and observability.
- **`frontend.md` loaded:** user flows and screens with text sketches;
  component/design-system decisions; interaction, accessibility and
  responsive behavior; client data boundaries, states and performance.

For a small change, the short design covers the relevant points in a line or
two each and goes straight to your human partner without the review step.

**Where it goes:** in a software repo,
`docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`. Otherwise, pick a
sensible place and say where. Your human partner's preferences override both.

## Review Before Approval

For a project-sized design, say you are writing it up and that a reviewer will
read it first; you may come back once with a few questions. Read
`review-prompt.md` in this directory (use a fresh subagent when one is
available, otherwise perform the audit yourself). Pass the document path,
which lenses were loaded, and the observed stack.

Sort the reviewer's questions into three piles:

- **Answered already** by the conversation, the project, or a lens: put the
  answer in the document.
- **Minor:** a sensible builder could settle it without changing what gets
  built. Settle it yourself and mark it in the document as your call.
- **Theirs:** only your human partner can answer it, and the answer changes
  what gets built. Bring these in one message, most important first, update
  the document with their answers, and hand it over with a short list of the
  calls you made.

That is the only round of questions the review produces. Do not hand over the
document until the review is back.

<HARD-GATE>
Nothing gets built until your human partner approves the design document (in
chat for a small change; the written file for a project).

Building includes writing product code, scaffolding, installing dependencies,
creating projects, and invoking an implementation skill. Reading and
exploring are always allowed.

Two exceptions. If they opted out of the questions, this gate goes with it.
An explicitly approved throwaway spike may be built; it stays isolated and
labelled throwaway, and keeping what it produced is a new request that comes
back through this gate.

After approval, the next step is the planning skill.
</HARD-GATE>

## Visual Companion

Offer a local browser tab just in time — when a diagram, mockup, or side-by-
side comparison will expose edge cases faster than text — in its own message:

> "This might be easier if I show you. Want me to open a browser tab with a few options?"

If they decline, stay in text and do not offer again unless they raise it. If
they accept, read `visual-companion.md` in this directory before starting
`../brainstorming/scripts/start-server.sh`.

## Red Flags

| Thought | Reality |
| :--- | :--- |
| "I will offer a menu of what they might want" | Options steer. Ask them to describe it first. |
| "I will fill in sensible defaults" | Good. Say them out loud. A default they never heard is one they could not reject. |
| "I have answered their questions, so I will write the doc" | Lay out the approaches first, in a message of their own. |
| "I should explain the process first" | Ask the question. The process shows itself. |
| "They said sounds good to the idea" | Approval covers what you showed them. A design doc you have not written is not approved. |
| "The lens gives me a stack example, so I will use it" | Examples are illustrations. Read the actual project and mark any new choice as your proposal. |
| "It works locally, so the design is done" | The lens review asks what breaks in production, on a slow device, or for a person using a keyboard. |
