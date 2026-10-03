# Acassist product design reference

Status: proposed design direction, reviewed against the sample HTML source and product planning documents on 2026-10-02. The guided module and library patterns were added on 2026-10-03. These are local prototypes, not an integrated Tauri app.

## Product and scope

Acassist is an offline-first Tauri desktop app for classrooms with unreliable internet. A student opens a local JSON module, reads a lesson, takes a quiz, and receives a score from the Rust core on the same device. Teachers use an online Groq call to draft a module, review it, then seal and export a JSON file. AI never grades a student's answers.

The first build should prove this path:

1. Open a local module file into the library.
2. Read its quick overview and select **Start module**.
3. Move through its ordered lessons with **Previous lesson** and **Next lesson**.
4. Take its short quiz while offline.
5. See the locally scored result.
6. On the teacher side, generate one module online, review it, seal/export it, and retain a pre-generated fallback.

Flashcards and richer teacher templates are follow-up priorities. Accounts, roles, a full teacher dashboard, and network distribution are roadmap features. The sample's sign-in and role controls are a visual reference for future auth, not a first-build dependency.

## Navigation and layout

- **App shell:** Keep the sample's dark top bar, brand on the left, and a text-labeled connection status on the right. Show **Home**, **Modules**, and **Quizzes** as visible navigation. On narrow windows, place those links in a solid navy Sheet. Do not rely on a hover-only brand menu for core routes.
- **Home:** Use a content width up to 56rem. Put **Continue**, when real saved progress exists, and **Open module file** before recent subjects and other discovery content.
- **Modules library:** Use a content width up to 72rem for a growing catalog. Put a page title and short orientation above labeled search, subject filter, and sort controls. Show a result count and a three-column card grid on desktop, two columns on medium windows, and one column on mobile. Each card shows subject, title, level, lesson count, quiz count, estimated time, and an offline state backed by actual local availability. Its primary action is **Open module**. A no-results state should offer **Clear filters**; an empty library should offer **Open module file**. Do not imply metadata-only catalog entries are installed content.
- **Module overview:** Use one glass surface up to 56rem wide. Show the module title, a concise quick overview, learning outcomes, ordered lesson outline with time estimates, quiz length, and a full-width **Start module** action. When saved progress exists, use **Continue module** and resume at the saved lesson or quiz question.
- **Lesson:** Use one centered glass surface up to 44rem wide, with readable text no wider than 62ch. Show **Lesson N of M**, a labeled progress bar, title, short sections, and **Previous lesson** / **Next lesson** controls. Each lesson is its own view. The final lesson action becomes **Start short quiz**. Preserve the learner's place when they return to the overview.
- **Quiz:** Use one centered glass surface up to 44rem wide and one question at a time. Show the module title, **Question N of M**, a labeled progress bar, clear radio or text answer controls, **Previous**, **Next**, and **Submit**. Preserve answers when moving backward and review unanswered questions before final submission.
- **Results:** Show a numeric score alongside the sample's score ring, a clear “Scored on this device” message, per-question correct/not-quite status, **Retry**, and **Review lesson**. Do not derive or reveal protected answers from the hash.
- **Flashcards:** Use one large glass card up to 44rem wide. Show the front/back label, card count, and explicit **Flip**, **Previous**, and **Next** controls with keyboard support. Backs must come from teacher-approved study text or lesson content; the shipped quiz hash is not a source for card backs.
- **Teacher creation:** For the first build, use one guided panel: topic and authorized source notes → online Generate → review lesson, questions, and teacher-side cleartext answers → seal/export local JSON. Show the connection requirement beside Generate and keep a pre-generated fallback. Richer templates and revisitable steps can follow.
- **Future auth:** Reuse the sample's centered glass sign-in composition when accounts are built. Do not show it as a required gateway in the first build.

## Visual system

| Element | Decision |
| --- | --- |
| Font | Self-host Lexend with a system sans-serif fallback. |
| Background | Navy `#070B2E` with the sample's restrained violet/azure mesh; deeper content base `#0A1040`. |
| Text | Primary `#F4F5FF`; muted `#A9AED6`. |
| Action and focus | Primary gradient `#8B2EFF` → `#3A4BFF`; focus and selection `#7CCBFF`. |
| State colors | Success `#3DDC97`; error `#FF5C7A`. Pair color with words or icons. |
| Glass | Outer cards: 8% white fill, 16px blur, fine orchid-to-azure gradient edge, navy shadow. Stronger inner surfaces: 12% white fill. Use flat inner tiles where content is dense. |
| Solid fallback | `#1B2260` and `#232B6E` when reduced transparency or performance mode is active. |
| Type scale | 15, 17, 24, 30, and 38px. |
| Spacing and shape | 8px spacing base; 14, 20, and 28px corner radii. |
| Controls | At least 44px hit targets; 56px in elementary or large-control mode. Visible keyboard focus and reduced-motion support. |

Glass frames the task; lesson text, answer controls, and review details remain on steady, readable surfaces. Keep motion out of quiz answering. A short, optional result reveal may follow the sample's count-up behavior and must respect reduced motion.

## Module content and flow reference

The new example extends the original single-lesson `1.0` format to a proposed `1.1` content shape. The `1.1` version is a design contract for this prototype; the existing Rust scorer and import code, when built, must explicitly support and validate it.

| JSON field | Purpose | Student view |
| --- | --- | --- |
| `module` | ID, title, subject, level, provenance | Library card and overview heading |
| `overview.summary` and `overview.outcomes[]` | Short orientation before study | Quick overview and learning outcomes |
| `lessons[]` | Ordered parts, each with ID, title, time, and text blocks | One lesson per step with Previous/Next |
| `quiz.questions[]` | Short assessment with IDs, choices, salts, and answer hashes | One question per step after the last lesson |

Flow: **Library → Quick overview → Start module → Lesson 1…N → Short quiz → Result**. The overview has no answer controls. The quiz follows the last lesson and allows backward navigation while preserving answers. The result links to lesson review and retry. Saved progress should store module ID, content version, current step, and student answers locally, with a clear reset path. Do not mark a module complete until the final lesson has been reached and, when present, its quiz submitted.

The full worked handout example has six lessons and six multiple-choice questions. It paraphrases selected ideas across four pages: defining a search problem, characterizing it, state-space search, problem reduction, production rules, and evaluating methods. The source file's page design is not used. Its six question hashes are enough for a functional local-scoring demonstration, but public answer options plus hashes do not securely conceal low-entropy answers; the production trust model needs review before treating a shipped quiz as tamper-resistant.

The many-module catalog is a visual test with twelve cards. Only **Problem Representation in AI** has full lesson and quiz data in this repository. Other cards are illustrative metadata and must not be mistaken for downloadable lessons.

## Component choices

Use shadcn/ui for functional controls: Card, Button, Badge, Tabs, Field/Input/Textarea, Radio Group, Progress, Breadcrumb, Alert, Sheet, and Alert Dialog. Style these with the tokens above. React Bits can provide optional decoration on home, future auth, or results after performance checks in Tauri; it is not required for navigation, answering, scoring, or flashcard controls.

For the requested Next.js + Rust + Tauri stack, plan the Next.js UI as a static export for the Tauri webview. Keep local file handling and offline scoring in the Tauri/Rust integration. The older build sheet describes vanilla JavaScript for its event build; this design reference follows the current stack preference without claiming that code already exists.

## Reference fidelity and cautions

The design preserves the sample's Lexend, navy mesh, violet/indigo actions, azure focus, frosted outer cards, flat inner tiles, top bar, 56rem home, and 44rem task surfaces. Visible top-level navigation, quiz back/review controls, and the single-panel teacher flow are intentional usability improvements.

The sample hard-codes a resume state and flashcard text, and its sign-in, module import, and save actions are demonstrations. Show progress or offline availability only when backed by actual app state. Connection status should say what works offline and what requires internet; it should not imply that AI generation works offline.

This decision was checked against the HTML/CSS/JS source and planning PDFs. A rendered screenshot comparison was unavailable during review.

## Sources

- [Acassist sample HTML](</Users/brandonorphiano/Downloads/Acassist Sample Web.html>) — visual and interaction reference supplied by the user; stored outside this repository.
- [Worked handout-to-module example](../examples/README.md) — small JSON module, local preview, and visual mockup using this design system.
- [Full guided module JSON](../examples/problem-representation-full.module.json), [guided preview](../examples/full-module-preview.html), and [many-module library preview](../examples/modules-library-preview.html) — updated flow reference.
- [The Idea in One Page](<../Acassist — The Idea in One Page (1).pdf>) — product purpose and offline-first model.
- [Team Build Sheet](<../Acassist — Team Build Sheet.pdf>) — MVP scope, JSON contract, and scoring boundary.
- [Pre-Build Checklist](<../Acassist — Pre-Build Checklist.pdf>) — planning and build timing.
- [shadcn/ui components](https://ui.shadcn.com/docs/components) and [React Bits](https://reactbits.dev/) — preferred component sources.
- [Tauri's Next.js guide](https://v2.tauri.app/start/frontend/nextjs/) — static export requirement.
