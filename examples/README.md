# Handout to Acassist module examples

## Full guided module

The [full module JSON](problem-representation-full.module.json) turns selected ideas from all four pages of the supplied IT2206 handout into six short, paraphrased lessons and a six-question quiz. It starts with a quick overview and learning outcomes. The [guided module preview](full-module-preview.html) opens on that overview: **Start module** leads to lesson 1, **Next lesson** moves through each separate lesson view, and the last lesson leads to the short quiz and result. A learner can move backward through lessons or questions. The preview scores with browser Web Crypto so it runs as a standalone file; the planned app would score in Rust.

The [many-module library preview](modules-library-preview.html) and its [catalog fixture](module-catalog.json) show a 12-card library with search, subject filtering, and sorting. Only **Problem Representation in AI** has full lesson and quiz content here. The other eleven cards are illustrative metadata for testing a dense layout. Open either HTML file directly in a browser; each embeds its JSON so no server or network is required.

The v1.1 JSON shape is a proposed extension of the v1.0 event contract: `overview` adds a quick orientation and `lessons[]` replaces the single `lesson` object with ordered parts. Each lesson has an ID, title, time estimate, and heading/paragraph blocks. `quiz.questions[]` follows the lessons. The [product design reference](../docs/PRODUCT_DESIGN_REFERENCE.md) records the flow, library behavior, and production considerations. The guided preview also adapts the v1.0 example for display; it is not proof that the planned Tauri importer already supports v1.1.

## Earlier single-lesson example

This example takes only the opening **Problem Representation** concepts from page 1 of the user-provided `02_Handout_1(20).pdf`: possible states, a starting state, goal states, actions, and the effect of an action. The lesson text is paraphrased. The library-to-classroom route is a new illustrative example. The source page's typography, layout, figures, and longer explanations were not reproduced.

## Files

- [Sealed v1.0 JSON module](problem-representation.module.json)
- [Standalone visible preview](module-preview.html)
- [Visual design mockup](../docs/assets/problem-representation-module.png)

Open `module-preview.html` directly in a browser. It starts with the embedded copy of the example JSON so it works without a server. The **Preview another module JSON** control can parse a different v1.0 module from disk. The preview displays heading/paragraph lesson blocks and the three v1 quiz question kinds (multiple choice, true/false, identification); it does not grade answers.

## Mapping into the existing contract

| Handout idea | JSON field | Visible result |
| --- | --- | --- |
| Topic name | `module.title` | Module heading and breadcrumb |
| Short explanation of states and actions | `lesson.blocks` with `heading` and `paragraph` kinds | Readable lesson sections |
| Two checks for understanding | `quiz.questions` | One question at a time with radio choices |
| Teacher-reviewed correct choices | `salt` and `answer_hash` per question | No plaintext answer key in the shipped module |

`module.type` is `quiz` because this example includes an assessment. The preview exposes the lesson and quiz tabs according to which data fields are present. `grade_level` is metadata; `tertiary` reflects the handout's IT2206 context rather than the elementary sample content.

Each answer hash was computed as `SHA256(question_id + ":" + normalized_answer + ":" + salt)`, with normalization recorded as `lowercase|trim|strip_punctuation`. A production implementation must use the exact same normalization on the teacher seal side and the Rust scoring side. The preview treats JSON strings as text and never injects them as HTML.

The image is a design visualization of the lesson view using the [product design reference](../docs/PRODUCT_DESIGN_REFERENCE.md). It is not a screenshot of the HTML preview. The HTML is a portable content demonstration; the production UI remains planned for Next.js in Tauri, with scoring in Rust.

## Visual prompt

The mockup was generated with the built-in image tool using this prompt:

> Create a high-fidelity 1440 × 1024 Acassist desktop lesson screen from the example JSON. Show the module title “Problem Representation in AI,” tertiary level, two questions, the lesson sections “A problem as states” and “Picture a route,” and a “Start 2-question quiz” action. Use the saved dark navy mesh, Lexend-like typography, violet-to-indigo action, azure focus, and frosted glass card design. Show Home / Modules / Quizzes navigation and an offline-available status. Do not reproduce the PDF layout or add unrelated UI.
