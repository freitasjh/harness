# Frontend Lens

Loaded by `SKILL.md` when the work touches screens, components, interaction,
accessibility, responsive layout, client state, frontend performance, or
frontend stack choices. It adds territory to the common conversation; it does
not replace the common flow, the review, or the approval gate.

## What To Inspect First

Read the project before asking. Look for:

- routes, screens, and the main journeys people take through them
- component library, design tokens, styling approach, and existing patterns
- client state, data fetching/caching, forms, and validation conventions
- accessibility setup, keyboard behavior, localization, and browser targets
- rendering mode, build tooling, test strategy, and deployment model
- the actual stack, including versions that constrain choices

Only ask about what is missing and would change the design. Never reopen a
decision the project already made.

## Territory To Cover

Never read this as a questionnaire. Use it to judge whether the design is
ready. Ask about the person and the task before asking about components.

- **People and journeys.** Who uses this, in what context, and what must they
  accomplish? What does success look like to them?
- **Screens and states.** Which screens exist, and what do they show in
  loading, empty, error, partial, and success states? What happens on a slow
  device or a lost connection?
- **Interaction details.** What can be clicked, typed, undone, or left
  half-finished? Which validations happen when, and how are mistakes
  recovered?
- **Accessibility and inclusion.** Keyboard paths, focus order, readable
  names, contrast, motion preferences, and assistive technology. Accessibility
  is a design requirement, not a final polish pass.
- **Responsive behavior.** How the layout adapts across sizes and input
  methods, not just how it looks at one desktop width.
- **Client data boundaries.** What lives on the client, what comes from the
  server, what is cached, and what happens when the two disagree.
- **Performance and anti-goals.** What would make this fail even if it looks
  right: layout shift, long tasks, unbounded lists, request waterfalls, icons
  without labels, or a design that ignores the existing system.

## How To Make The How Calls

- Reuse the project's components, tokens, and conventions before proposing
  anything new.
- When the human partner describes an outcome, choose the how yourself:
  component breakdown, rendering approach, state placement, and error states.
  State each as your proposal with a one-line reason.
- When they raise a frontend trade-off (rendering mode, state management,
  styling, component strategy), give 2–3 concrete options. For each, state the
  user-visible difference, implementation cost, and accessibility/performance
  impact. Recommend one.
- When the look itself is theirs to decide, offer the visual companion in its
  own message instead of describing mockups in prose.

## Required Design Sections

When this lens is loaded, the written design adds:

1. **User flows and screens** — the journey, a short text sketch of each
   important screen, and its loading/empty/error/success states.
2. **Component and design-system decisions** — what is reused, what is new,
   and why; how tokens and variants are applied.
3. **Interaction, accessibility, and responsive behavior** — keyboard and
   focus paths, validation and recovery, and behavior across sizes.
4. **Client data and performance** — state placement, fetching/caching,
   request bounds, and the performance budget that matters here.

## Stack Profile To Fill

Fill this from the repository. Ask only about blanks that change the design.

- Framework, rendering mode, and router
- Styling approach, design tokens, and component library
- Client state and data-fetching/caching layer
- Form and validation conventions
- Testing and accessibility tooling
- Browser/device targets and deployment model

## Review Risks

The unified `review-prompt.md` asks these for frontend work:

- states with no design (loading, empty, error, offline, partial success)
- unreachable actions, missing keyboard/focus paths, unlabelled controls,
  and contrast or motion problems
- duplicate client/server sources of truth and unclear cache invalidation
- unbounded lists, request waterfalls, and layout shift
- new components or styles that bypass the existing design system

## Visual And Spike Cues

Offer a wireframe, side-by-side layout, or clickable prototype when seeing the
choice would settle it faster than reading it. Keep requirements, scope, and
trade-off lists in text. Offer a throwaway spike when an interaction or
protocol is uncertain; label it throwaway and bring what it taught you back
before any implementation is approved.
