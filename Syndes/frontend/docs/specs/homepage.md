# Spec: Home and learner experience

Status: proposed. Sources: [design system](../design/design-system.md) and its [visual reference](../design/design-system.png), [coding standards](../../CODING_STANDARDS.md), the files in [`docs/standards/`](../standards/), [GLOSSARY.md](../../GLOSSARY.md), and [ADR-0001](../adr/0001-search-param-routes-for-local-modules.md).

Home is the hub for the learner experience. Each capability (Library, Module overview, Lesson, Quiz, Result, Flashcards, Progress, Settings) is its own route and its own feature module, in separate files. Home links to them and shows only what is useful at the start of a session.

## Decisions

| # | Decision |
| --- | --- |
| D1 | Home is a hub. Each capability has its own route, as the design system requires ("one task page at a time", `aria-current` routes). |
| D2 | Separate files means both thin route entries in `src/app/` and one `src/features/<domain>/` module per capability. |
| D3 | There are no accounts. "Profile" becomes **Progress**: the Learner's saved place on this device, plus reset. |
| D4 | Settings holds the theme (Light / Dark / System) and larger controls (56px). |
| D5 | Student side only. Teacher creation (Generate → review → seal/export) is out of scope. |
| D6 | Screens read a frontend view model through a `ModuleSource` port, backed by a fixture for now. Scoring goes through a `QuizScorer` port and never runs inside components. |
| D7 | Stack: Next.js 16, React 19, Tailwind 4, shadcn/ui. React Bits is optional and only for reveals the user opens. |
| D8 | Runtime module IDs travel in search params, not dynamic segments ([ADR-0001](../adr/0001-search-param-routes-for-local-modules.md)). |

## Out of scope

- Teacher creation, accounts, roles, sign-in, the teacher dashboard.
- The real module importer, schema validation, and the Tauri bridge. `src-tauri/tauri.conf.json` currently points at the Vite scaffold (`../dist`, port 1420), not this app. Wiring it is a separate change.
- Sync, distribution, or downloading modules over the network.
- AI grading of any kind.

---

## Requirements

### R1 — Application shell
1. Every route shares a compact header with the **Syndes** wordmark; the primary routes **Home**, **Modules**, and **Quizzes**; the secondary routes **Progress** and **Settings**; and a text-labeled connection status.
2. The current route is marked visibly and with `aria-current="page"`.
3. Below 768px, the routes move into a Sheet opened by a labeled **Menu** button. The Sheet has a visible title and a labeled **Close** control, and returns focus to **Menu** when closed.
4. The connection status reads **Online** or **Offline**. It comes from the browser's online and offline events and is never shown as an error. The words "secure", "encrypted", "hash", "salt", and "seal" never appear in the UI.
5. Every route has a unique `<title>` and a single `<h1>`. A skip link moves focus to the main content.

### R2 — Home (`/`)
1. When saved Progress exists for at least one Module, a **Continue** section comes first. It shows the most recently used Module, its place ("Lesson 2 of 6" or "Question 3 of 5"), and a **Continue** button that opens that exact place. Without saved Progress, this section is not rendered.
2. Next comes **Open module file**. Until a real importer exists, the fixture source reports that opening files is unsupported, and the UI shows an Alert: "Opening module files is not available in this build yet."
3. Lower on the page, **Your modules** lists up to three Modules from the Library as aligned rows (subject, title, lesson count, availability). It ends with a **Browse all modules** link to `/modules`.
4. Below that, **Other ways to study** links to **Quizzes** and to the Flashcard decks of Modules that have one. A link is shown only when its target exists.
5. If the Library is empty, Home shows an empty state that explains this and offers **Open module file**.
6. The content width is at most 56rem.

### R3 — Library (`/modules`)
1. Shows a title, one sentence of orientation, a labeled search field, a labeled subject filter (Select), and a live result count ("4 modules").
2. Each Module row shows the subject and title on the left, and the lesson count and availability on the right, plus an **Open module** action. **Open module** appears only when the Module is Ready offline. Otherwise the row says "Not on this device" and has no open action.
3. If no results match, show a no-results state with **Clear filters**. An empty Library shows the same empty state as Home.
4. Search and filter state are kept in the URL (`?q=`, `?subject=`).
5. Two columns only at widths of 72rem and up where summaries stay readable. Otherwise one column. Maximum width is 72rem.

### R4 — Module overview (`/module?module=<id>`)
1. Shows the title, summary, learning outcomes, the ordered Lessons with time estimates, and the Quiz length (if there is a Quiz).
2. The main action is **Start module**. If saved Progress exists, it reads **Continue module** and opens the saved place.
3. If the Module has a Flashcard deck, a secondary action **Study flashcards** is shown.
4. No answer controls appear on this page.
5. A missing or unknown `module` shows "Module not found on this device" and a link back to the Library.

### R5 — Lesson (`/lesson?module=<id>&lesson=<n>`)
1. Uses the folio layout: chapter rail, reading page (44rem maximum), and study margin. Below 1024px, the rail moves above the reader and the margin moves below it.
2. The chapter rail shows the Module title, "N lessons / short quiz", the numbered Lesson sequence with the current Lesson marked (`aria-current="step"`), and "After lesson N: Short quiz".
3. The reader shows **Lesson N of M**, a labeled Progress bar, the title, an optional subtitle, and the sections. A section may include a **Try this** prompt.
4. The margin shows **Where you are**, any **Remember** notes for that Lesson, and **Available on this device** with **Ready offline** only when the source reports it.
5. Navigation uses **Previous lesson** and **Next lesson**. The last Lesson's next action is **Start short quiz**, or **Finish module** when the Module has no Quiz.
6. When the Lesson changes, the Learner's place is saved and focus moves to the Lesson heading.
7. An out-of-range `lesson` value falls back to Lesson 1 and updates the URL.

### R6 — Quizzes (`/quizzes`)
1. Lists the Modules that have a Quiz. Each row shows the Module title, question count, Completed or in-progress status in words, and **Start quiz** or **Continue quiz**.
2. If no Module has a Quiz, the empty state links to the Library.

### R7 — Quiz (`/quiz?module=<id>`)
1. Shows one Question at a time with **Question N of M** and a labeled Progress bar.
2. Choice Questions use a Radio Group where the whole answer row can be clicked. The selected row shows a checked control and a 2px primary border with a quiet fill. Text Questions use a labeled Input.
3. Navigation uses **Previous** and **Next**, and **Submit** on the last Question. Answers are kept when moving back and are saved on every change.
4. Before submission, unanswered Questions are listed by number with links to each one. The Learner can still submit.
5. The page stays still while answering: no transitions on Question change other than moving focus to the Question heading.
6. Submitting calls `QuizScorer.score`, marks the Quiz submitted in Progress, and opens the Result.

### R8 — Result (`/quiz/result?module=<id>`)
1. Shows the numeric score ("4 of 5"), the text **Scored on this device**, and a review for each Question with a status word (**Correct** / **Incorrect** / **Unanswered**). Color only reinforces the word.
2. Actions: **Retry** clears this Module's Quiz answers and opens Question 1. **Review lesson** opens Lesson 1.
3. The Result is rebuilt by scoring the saved submitted answers again. No score is stored.
4. If the Quiz has not been submitted, the page redirects to the Quiz.
5. No text suggests that AI graded the answers or that an answer key is available.

### R9 — Flashcards (`/flashcards?module=<id>`)
1. Shows one large square Flashcard with a visible **Front** or **Back** label and a count ("Card 3 of 12").
2. Controls are **Flip**, **Previous**, and **Next**. Keyboard: Space or Enter flips, and the Left and Right arrows move between cards when focus is in the card area.
3. Flashcard backs come only from the Module's Flashcard deck, which holds teacher-approved text. They are never derived from Quiz data.
4. A Module without a deck shows "This module has no flashcards" and a link to its overview.
5. With reduced motion, flipping swaps the content without animation.

### R10 — Progress (`/progress`)
1. Lists each Module with saved Progress: its title, place, and Completed or in progress status.
2. Each row has **Continue** and **Reset progress**. A **Reset all progress** action is also available. Both reset actions confirm in a Dialog that says what will be removed. After a reset, focus returns to a sensible element.
3. It states plainly: "Progress is saved on this device only."
4. With no Progress, it explains this and links to the Library.

### R11 — Settings (`/settings`)
1. **Theme** is a labeled Radio Group: **Light**, **Dark**, **System**. Light is the default. **System** follows `prefers-color-scheme` and updates live.
2. **Larger controls** is a labeled switch that raises the minimum control height from 44px to 56px.
3. Preferences are saved on this device and applied before first paint, so the theme does not flash.

### R12 — Progress persistence contract
1. For each Module, saved Progress holds the Module ID, content version, current step, Learner answers, whether the Quiz was submitted, and the last-used time. Nothing else is stored.
2. Stored data is treated as untrusted. Malformed entries are dropped instead of crashing the app.
3. If the content version differs from the Module's current version, that Module's Progress is discarded. The next view of the Module shows a notice: "This module was updated, so your saved place was reset."
4. A Module is Completed only after its final Lesson is reached and, when it has a Quiz, the Quiz is submitted.

### R13 — Visual and accessibility baseline
1. All colors come from the semantic tokens in the design system, with Light and Dark values. There are no shadows, gradients, glass effects, pills, or textures. Radius is 2px everywhere.
2. Lexend is self-hosted, with the fallback `ui-sans-serif, system-ui, sans-serif`. Type sizes: 14 (metadata), 17 (body, line height 1.55), 22, 32, and 42px. Lesson paragraphs use line height 1.7 and about 62 characters per line.
3. Keyboard focus shows a 3px `--focus` outline with a 3px offset. Controls are at least 44px tall, or 56px with larger controls. Spacing follows an 8px rhythm.
4. Target WCAG 2.2 AA. Contrast is checked for text, borders, the selected choice, and disabled states in both themes.

---

## Design

### Routes

All routes are fixed and work with static export ([ADR-0001](../adr/0001-search-param-routes-for-local-modules.md)). Route files stay thin and only compose feature components.

| Route file | Renders |
| --- | --- |
| `src/app/page.tsx` | `features/home` → `HomeView` |
| `src/app/modules/page.tsx` | `features/modules` → `LibraryView` |
| `src/app/module/page.tsx` | `features/modules` → `ModuleOverviewView` |
| `src/app/lesson/page.tsx` | `features/lessons` → `LessonView` |
| `src/app/quizzes/page.tsx` | `features/quiz` → `QuizListView` |
| `src/app/quiz/page.tsx` | `features/quiz` → `QuizView` |
| `src/app/quiz/result/page.tsx` | `features/quiz` → `ResultView` |
| `src/app/flashcards/page.tsx` | `features/flashcards` → `FlashcardsView` |
| `src/app/progress/page.tsx` | `features/progress` → `ProgressView` |
| `src/app/settings/page.tsx` | `features/settings` → `SettingsView` |

Each route exports `metadata` with a unique title. Views that read search params are Client Components wrapped in `<Suspense>` by their route.

### File layout

```text
src/
├── app/
│   ├── layout.tsx                   # html/body, fonts, preference script, AppShell
│   └── <routes above>/page.tsx
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx            # header + skip link + <main>
│   │   ├── site-header.tsx          # wordmark, routes, connection status
│   │   ├── site-nav.tsx             # route list with aria-current (client)
│   │   ├── mobile-nav-sheet.tsx     # Sheet below 768px (client)
│   │   ├── connection-status.tsx    # Online / Offline (client)
│   │   └── folio-layout.tsx         # rail / reader / margin slots
│   └── ui/                          # shadcn/ui primitives, restyled to folio tokens
├── features/
│   ├── modules/
│   │   ├── module-types.ts          # view model (below)
│   │   ├── module-source.ts         # ModuleSource port + useModuleSource
│   │   ├── fixture-module-source.ts # fixture implementation
│   │   ├── fixture-modules.ts       # demo content
│   │   ├── routes.ts                # href builders for every module route
│   │   └── components/              # LibraryView, ModuleRow, ModuleOverviewView, ModuleNotFound
│   ├── home/components/             # HomeView, ContinueSection, OpenModuleFile
│   ├── lessons/components/          # LessonView, ChapterRail, LessonReader, StudyMargin
│   ├── quiz/
│   │   ├── quiz-scorer.ts           # QuizScorer port
│   │   ├── fixture-quiz-scorer.ts   # fixture-only scorer
│   │   ├── quiz-session.ts          # pure navigation/unanswered logic
│   │   └── components/              # QuizListView, QuizView, ChoiceQuestion, TextQuestion,
│   │                                #   UnansweredSummary, ResultView
│   ├── flashcards/components/       # FlashcardsView, Flashcard
│   ├── progress/
│   │   ├── progress-types.ts
│   │   ├── progress-store.ts        # read/write/validate/reset, pure + storage adapter
│   │   ├── use-progress.ts          # useSyncExternalStore hook
│   │   └── components/              # ProgressView, ResetProgressDialog
│   └── settings/
│       ├── preferences.ts           # types, read/write, apply to <html>
│       ├── preference-script.ts     # inline pre-paint script source
│       └── components/              # SettingsView, ThemeChoice, LargerControlsSwitch
├── lib/
│   └── local-json-storage.ts        # safe JSON get/set over localStorage
└── styles/globals.css               # tokens, themes, base type, focus
```

Allowed dependencies: `app → features, components, lib`; `features → components, lib`; `components → lib`. Feature-to-feature dependencies are limited to the public files that `home`, `lessons`, `quiz`, `flashcards`, and `progress` import from `features/modules` (types, source, routes) and `features/progress` (hook). These two shared feature modules are the contract for the learner experience. Record the edges in an ADR before adding any others.

### View model (`features/modules/module-types.ts`)

```ts
export type ModuleSummary = {
  id: string;
  version: string;          // content version; used to invalidate Progress
  subject: string;
  title: string;
  summary: string;
  lessonCount: number;
  questionCount: number;    // 0 when there is no Quiz
  hasFlashcards: boolean;
  readyOffline: boolean;    // fact from the source, never assumed
};

export type Module = ModuleSummary & {
  outcomes: string[];
  lessons: Lesson[];
  quiz?: Quiz;
  flashcards?: Flashcard[];
};

export type Lesson = {
  id: string;
  title: string;
  subtitle?: string;
  minutes: number;
  sections: { heading: string; paragraphs: string[]; tryThis?: string[] }[];
  remember?: string[];      // margin notes
};

export type Quiz = { questions: Question[] };

export type Question =
  | { id: string; kind: "choice"; prompt: string; options: { id: string; label: string }[] }
  | { id: string; kind: "text"; prompt: string };

export type Flashcard = { id: string; front: string; back: string };
```

The student view model has no answer fields. Correctness exists only behind `QuizScorer`.

### Ports

```ts
// features/modules/module-source.ts
export interface ModuleSource {
  listModules(): Promise<ModuleSummary[]>;
  getModule(id: string): Promise<Module | null>;
  openModuleFile(): Promise<
    | { status: "opened"; moduleId: string }
    | { status: "cancelled" }
    | { status: "unsupported" }
    | { status: "invalid"; message: string }
  >;
}

// features/quiz/quiz-scorer.ts
export type QuestionStatus = "correct" | "incorrect" | "unanswered";
export interface QuizScorer {
  score(moduleId: string, answers: Record<string, string>): Promise<{
    correct: number;
    total: number;
    questions: { questionId: string; status: QuestionStatus }[];
  }>;
}
```

The fixture implementations are chosen in one place (`useModuleSource` and `useQuizScorer`). Later, the Tauri bridge replaces them there. `fixture-quiz-scorer.ts` holds expected answers only for the made-up fixture content, carries a header comment saying so, and must never score real modules.

### Progress contract (`features/progress/progress-types.ts`)

```ts
export type Step =
  | { kind: "overview" }
  | { kind: "lesson"; lesson: number }      // 1-based
  | { kind: "quiz"; question: number }      // 1-based
  | { kind: "result" };

export type ModuleProgress = {
  moduleId: string;
  contentVersion: string;
  step: Step;
  answers: Record<string, string>;          // questionId → option id or text
  finalLessonReached: boolean;
  quizSubmitted: boolean;
  updatedAt: string;                        // ISO time; orders Continue
};

export type ProgressStore = { schema: 1; modules: Record<string, ModuleProgress> };
```

- Storage key `syndes:progress:v1`. Each entry is validated when read and invalid entries are dropped (R12.2).
- `isCompleted(p, module) = p.finalLessonReached && (!module.quiz || p.quizSubmitted)`.
- `use-progress.ts` subscribes with `useSyncExternalStore`, including `storage` events, so every view stays in sync. The server snapshot is "no progress", so prerendered HTML never claims progress exists.
- The Continue target is the entry with the latest `updatedAt` whose Module still exists.

### Preferences (`features/settings`)

- Storage key `syndes:preferences:v1`: `{ theme: "light" | "dark" | "system"; largerControls: boolean }`. The default is `{ theme: "light", largerControls: false }`.
- They are applied as `data-theme` (`light` / `dark` / `system`) and `data-controls` (`default` / `large`) on `<html>`. A small inline script in `layout.tsx` sets both before paint. `<html>` uses `suppressHydrationWarning` only for these attributes.

### Styling (`styles/globals.css`)

- Define the semantic tokens from the design system on `:root` (Light) and on `[data-theme="dark"]`. Under `[data-theme="system"]`, a `prefers-color-scheme: dark` media query applies the Dark values. Map them into Tailwind with `@theme inline` so classes such as `bg-surface` and `text-muted-foreground` work.
- Add `--radius: 2px`, plus a `--control-height` variable: 44px by default and 56px under `[data-controls="large"]`.
- Load Lexend with `next/font/local` from a committed woff2. Its OFL license is already in `docs/design/`, so copy it next to the font file.
- Set global `:focus-visible` to a 3px solid `--focus` outline with a 3px offset. Under `prefers-reduced-motion: reduce`, turn off transitions.
- Restyle the shadcn components: 2px radius, no default Card shadow, outline buttons for secondary actions, solid primary for the main action.

### Server and client split

Route files and static text stay as Server Components. Anything that reads search params, local storage, `navigator.onLine`, or handles input is a Client Component in its feature. No Server Actions or Route Handlers are added, so no new public server boundary appears.

### Dependencies

Add shadcn/ui through its CLI. Only these components are added: Button, Card, Field, Input, Select, Radio Group, Switch, Progress, Badge, Alert, Breadcrumb, Sheet, and Dialog. Commit the resulting `components.json`, `src/components/ui/*`, the `src/lib/utils.ts` it creates, and `package-lock.json`, with exact versions pinned. React Bits is not added in this spec.

---

## Tasks

- [ ] **T1 — Tokens, type, and shell.** Tokens and themes in `globals.css`, self-hosted Lexend, the preference script, `AppShell` / `SiteHeader` / `SiteNav` / `MobileNavSheet` / `ConnectionStatus`, and a skip link. _R1, R11.3, R13_
- [ ] **T2 — shadcn/ui setup.** Initialize, add only the listed components, restyle them to folio tokens, and pin versions. _R13.1_
- [ ] **T3 — Module view model and fixture source.** `module-types.ts`, `ModuleSource`, the fixture with at least three Modules (one with a Flashcard deck, one without a Quiz, one not Ready offline), and `routes.ts`. _D6, D8_
- [ ] **T4 — Progress store.** Types, validation, version invalidation, reset, the `useProgress` hook, and `local-json-storage.ts`. _R12_
- [ ] **T5 — Home.** Continue, Open module file, Your modules, Other ways to study, and the empty state. _R2_
- [ ] **T6 — Library and Module overview.** Search and filter in the URL, aligned rows, no-results and empty states, overview actions, and not-found. _R3, R4_
- [ ] **T7 — Lesson.** `FolioLayout`, `ChapterRail`, `LessonReader`, `StudyMargin`, navigation, saving the place, and focus moves. _R5_
- [ ] **T8 — Quiz and Result.** `QuizScorer` with its fixture, `quiz-session.ts`, the Quizzes list, choice and text Questions, the unanswered summary, submission, Result, Retry, and Review lesson. _R6, R7, R8_
- [ ] **T9 — Flashcards.** The card, flip, the keyboard map, reduced motion, and the no-deck state. _R9_
- [ ] **T10 — Progress and Settings.** The Progress list, reset Dialogs, the theme Radio Group, and the larger-controls switch. _R10, R11_
- [ ] **T11 — Tests.** Add Vitest and Testing Library (pinned) with a `test` script. Cover `progress-store` (validation, version reset, completion), `quiz-session` (navigation, unanswered list), and a component test for choice selection with role and label queries. _testing standards_
- [ ] **T12 — Verify.** Run `npm run lint`, `npm run typecheck`, and `npm run build`. Do a keyboard-only pass through Home → Lesson → Quiz → Result → Progress → Settings in both themes, with larger controls on and reduced motion on. _Definition of done_

## Open items for later specs

- Wire the real Tauri bridge into `ModuleSource` and `QuizScorer`, and point `tauri.conf.json` at this app's export (`output: "export"`).
- Real module importer and validation behind `openModuleFile`.
- A real "Ready offline" signal from the desktop runtime.
