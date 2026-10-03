# Accessibility and UX standards

Target WCAG 2.2 Level AA for production-facing learner and teacher experiences. Automated checks support, but do not replace, keyboard and visual review of critical flows.

- Use semantic HTML before ARIA. Every control needs an accessible name; every form field needs an associated label.
- Keep all actions keyboard operable with visible focus and a logical focus order. Communicate state with text as well as color or motion.
- Give each route a unique title and clear heading. Announce asynchronous states without repeatedly disrupting assistive technology users.
- Manage focus after dialogs, validation, permission, and route transitions. Make errors actionable, preserve valid input, and provide a summary when several fields fail.
- Keep lesson and quiz content readable with zoom, text resizing, responsive layouts, adequate contrast, touch-friendly targets, and reduced motion.
- Distinguish loading, empty, saved offline, unavailable, success, and failure states using facts from the app. Explain the next action, especially after offline or sync failures.
- Give informative images meaningful alternative text and decorative images empty alt text. Do not invent descriptions for user-provided images.

The [Syndes design system](../design/design-system.md) supplies the project's visual and content guidance.
