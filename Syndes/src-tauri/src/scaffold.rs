// Deterministic prompting scaffolds (spec 03 R6 / the "SHOULD" task). TEACHER-SIDE.
//
// A non-techy teacher - down to elementary level - should never face a blank
// prompt box. This module gives the UI a fixed, ordered catalog of structured
// starting points (subject + grade + a concrete topic hint + a sensible question
// count), and a PURE builder that turns a teacher's pick (with optional
// overrides) into a well-formed `groq::GenerationRequest`. That request then
// flows through the SAME online generation + guaranteed-fallback path as
// `generate_module` (see commands.rs).
//
// PURITY / ISOLATION: everything here is pure, offline, deterministic - no
// network, no I/O, no randomness. Same input -> same output, every call. Like
// groq.rs, this module is TEACHER-SIDE only and MUST NOT be imported by or
// reachable from loader.rs / scoring.rs / module_store.rs (the student/offline
// scoring path). It reuses `groq::GenerationRequest` rather than forking it, so
// the generation contract stays single-sourced.
//
// Content note (spec 03 design.md, honest framing): topic hints are ORIGINAL,
// phrased to align with DepEd/MELC-style elementary competencies WITHOUT quoting
// or reproducing any copyrighted DepEd text.

use crate::groq::GenerationRequest;
use crate::model::AppError;
use serde::{Deserialize, Serialize};

/// Lower/upper bounds for the generated question count, applied deterministically
/// when a scaffold preset or a teacher override is turned into a request. Keeps
/// the prompt sane (never 0, never a runaway count) regardless of input.
const MIN_QUESTIONS: u32 = 1;
const MAX_QUESTIONS: u32 = 20;

/// A single deterministic starting point the UI renders in a picker. `Serialize`
/// + camelCase so the whole catalog ships to JS as-is via `list_scaffolds`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Scaffold {
    /// Stable, unique id (never reused/renumbered) - the key the teacher's
    /// choice refers back to.
    pub id: String,
    /// Short human label for the picker.
    pub label: String,
    /// Preset subject - ALWAYS taken from the scaffold (never overridden), so the
    /// generated module's subject matches the chosen lane.
    pub subject: String,
    /// Preset grade level (overridable by the teacher).
    pub grade_level: String,
    /// A concrete, original topic hint so the box is never blank (overridable).
    pub topic_hint: String,
    /// Sensible default number of questions (overridable), already within range.
    pub suggested_question_count: u32,
    /// One-line description shown under the label to orient the teacher.
    pub description: String,
}

/// The teacher's pick plus optional overrides. `Deserialize` + camelCase so it
/// arrives from JS via `invoke("generate_from_scaffold", { choice: {...} })`.
/// Any `None`/blank override falls back to the scaffold preset.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScaffoldChoice {
    /// Which built-in scaffold the teacher picked (matched against `Scaffold.id`).
    pub scaffold_id: String,
    /// Optional topic override; blank/None falls back to the scaffold `topic_hint`.
    pub topic: Option<String>,
    /// Optional grade override; blank/None falls back to the scaffold `grade_level`.
    pub grade_level: Option<String>,
    /// Optional question-count override; None falls back to the preset. Clamped
    /// to [MIN_QUESTIONS, MAX_QUESTIONS] either way.
    pub num_questions: Option<u32>,
}

/// The deterministic built-in catalog (spec 03 R6). A fixed, ordered set of
/// scaffolds spanning common Philippine elementary subjects. Ids and order are
/// stable across calls - this is a plain constructor, no randomness, no I/O.
///
/// Topic hints are original phrasings of common elementary competencies; no
/// copyrighted DepEd text is reproduced (spec 03 design.md).
pub fn builtin_scaffolds() -> Vec<Scaffold> {
    vec![
        Scaffold {
            id: "sci_plant_parts".to_string(),
            label: "Science: Parts of a Plant".to_string(),
            subject: "Science".to_string(),
            grade_level: "elementary".to_string(),
            topic_hint: "Parts of a plant and their functions".to_string(),
            suggested_question_count: 5,
            description:
                "A short lesson and quiz on roots, stem, leaves, and flowers and what each does."
                    .to_string(),
        },
        Scaffold {
            id: "math_two_digit_addition".to_string(),
            label: "Mathematics: Two-Digit Addition".to_string(),
            subject: "Mathematics".to_string(),
            grade_level: "elementary".to_string(),
            topic_hint: "Addition of two-digit numbers with regrouping".to_string(),
            suggested_question_count: 5,
            description:
                "Practice adding two-digit numbers, including carrying over to the tens place."
                    .to_string(),
        },
        Scaffold {
            id: "eng_nouns".to_string(),
            label: "English: Common and Proper Nouns".to_string(),
            subject: "English".to_string(),
            grade_level: "elementary".to_string(),
            topic_hint: "Telling common nouns apart from proper nouns".to_string(),
            suggested_question_count: 5,
            description: "Identify naming words and sort them into common nouns and proper nouns."
                .to_string(),
        },
        Scaffold {
            id: "fil_pangngalan".to_string(),
            label: "Filipino: Mga Uri ng Pangngalan".to_string(),
            subject: "Filipino".to_string(),
            grade_level: "elementary".to_string(),
            topic_hint: "Pagkilala sa pambalana at pantanging pangngalan".to_string(),
            suggested_question_count: 5,
            description:
                "Pagsasanay sa pagtukoy ng pangngalan at pag-uuri nito sa pambalana at pantangi."
                    .to_string(),
        },
        Scaffold {
            id: "ap_community_helpers".to_string(),
            label: "Araling Panlipunan: Community Helpers".to_string(),
            subject: "Araling Panlipunan".to_string(),
            grade_level: "elementary".to_string(),
            topic_hint: "Community helpers and the services they provide".to_string(),
            suggested_question_count: 5,
            description:
                "Learn about workers in the community and how each one helps people every day."
                    .to_string(),
        },
    ]
}

/// Clamp a question count into the sane [MIN_QUESTIONS, MAX_QUESTIONS] range,
/// deterministically. Pulled out so the bounds are tested at both edges.
fn clamp_question_count(n: u32) -> u32 {
    n.clamp(MIN_QUESTIONS, MAX_QUESTIONS)
}

/// Treat a `None` or whitespace-only override as "not provided" so a blank text
/// field from the UI falls back to the preset rather than overriding it with "".
fn override_or(over: &Option<String>, preset: &str) -> String {
    match over {
        Some(v) if !v.trim().is_empty() => v.clone(),
        _ => preset.to_string(),
    }
}

/// Pure builder (spec 03 R6): look up the chosen scaffold by id and turn it,
/// plus any teacher overrides, into a well-formed `GenerationRequest`. No
/// network, no I/O, fully deterministic.
///
/// - Unknown `scaffold_id` -> `AppError::ValidationError`.
/// - `topic`: teacher's if given (non-blank), else the scaffold `topic_hint`.
/// - `grade_level`: teacher's if given (non-blank), else the scaffold preset.
/// - `num_questions`: teacher's if given, else the preset - clamped to range.
/// - `subject`: ALWAYS the scaffold's subject (not overridable), so the lane is
///   consistent with what the teacher picked.
/// - `source_text`: never set here; scaffolds are prompt starting points, not
///   source material.
pub fn request_from_choice(choice: &ScaffoldChoice) -> Result<GenerationRequest, AppError> {
    let scaffold = builtin_scaffolds()
        .into_iter()
        .find(|s| s.id == choice.scaffold_id)
        .ok_or_else(|| {
            AppError::ValidationError(format!("unknown scaffold id '{}'", choice.scaffold_id))
        })?;

    let topic = override_or(&choice.topic, &scaffold.topic_hint);
    let grade_level = override_or(&choice.grade_level, &scaffold.grade_level);
    let num_questions = clamp_question_count(
        choice
            .num_questions
            .unwrap_or(scaffold.suggested_question_count),
    );

    Ok(GenerationRequest {
        topic,
        subject: Some(scaffold.subject),
        grade_level: Some(grade_level),
        source_text: None,
        num_questions: Some(num_questions),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::groq::build_request_body;

    #[test]
    fn catalog_is_non_empty() {
        assert!(!builtin_scaffolds().is_empty());
    }

    #[test]
    fn ids_are_unique_and_order_is_stable() {
        let a = builtin_scaffolds();
        let b = builtin_scaffolds();

        // Deterministic: identical ids in identical order on every call.
        let ids_a: Vec<&str> = a.iter().map(|s| s.id.as_str()).collect();
        let ids_b: Vec<&str> = b.iter().map(|s| s.id.as_str()).collect();
        assert_eq!(ids_a, ids_b);

        // Unique.
        let mut sorted = ids_a.clone();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(sorted.len(), ids_a.len(), "scaffold ids must be unique");
    }

    #[test]
    fn every_scaffold_is_well_formed() {
        for s in builtin_scaffolds() {
            assert!(!s.id.trim().is_empty(), "id non-empty");
            assert!(!s.label.trim().is_empty(), "label non-empty");
            assert!(!s.subject.trim().is_empty(), "subject non-empty: {}", s.id);
            assert!(
                !s.grade_level.trim().is_empty(),
                "grade non-empty: {}",
                s.id
            );
            assert!(
                !s.topic_hint.trim().is_empty(),
                "topic_hint non-empty: {}",
                s.id
            );
            assert!(
                (MIN_QUESTIONS..=MAX_QUESTIONS).contains(&s.suggested_question_count),
                "sane question count: {}",
                s.id
            );
        }
    }

    #[test]
    fn choice_with_only_id_uses_presets() {
        let scaffold = &builtin_scaffolds()[0];
        let choice = ScaffoldChoice {
            scaffold_id: scaffold.id.clone(),
            topic: None,
            grade_level: None,
            num_questions: None,
        };
        let req = request_from_choice(&choice).expect("known id builds a request");

        assert_eq!(req.topic, scaffold.topic_hint);
        assert_eq!(req.subject.as_deref(), Some(scaffold.subject.as_str()));
        assert_eq!(
            req.grade_level.as_deref(),
            Some(scaffold.grade_level.as_str())
        );
        assert_eq!(req.num_questions, Some(scaffold.suggested_question_count));
        assert!(req.source_text.is_none());
    }

    #[test]
    fn overrides_win_over_presets() {
        let scaffold = &builtin_scaffolds()[0];
        let choice = ScaffoldChoice {
            scaffold_id: scaffold.id.clone(),
            topic: Some("Water cycle basics".to_string()),
            grade_level: Some("grade 4".to_string()),
            num_questions: Some(8),
        };
        let req = request_from_choice(&choice).unwrap();

        assert_eq!(req.topic, "Water cycle basics");
        assert_eq!(req.grade_level.as_deref(), Some("grade 4"));
        assert_eq!(req.num_questions, Some(8));
        // Subject is never overridable - stays the scaffold's.
        assert_eq!(req.subject.as_deref(), Some(scaffold.subject.as_str()));
    }

    #[test]
    fn blank_overrides_fall_back_to_presets() {
        // A whitespace-only field from the UI must NOT override the preset.
        let scaffold = &builtin_scaffolds()[0];
        let choice = ScaffoldChoice {
            scaffold_id: scaffold.id.clone(),
            topic: Some("   ".to_string()),
            grade_level: Some("".to_string()),
            num_questions: None,
        };
        let req = request_from_choice(&choice).unwrap();
        assert_eq!(req.topic, scaffold.topic_hint);
        assert_eq!(
            req.grade_level.as_deref(),
            Some(scaffold.grade_level.as_str())
        );
    }

    #[test]
    fn unknown_scaffold_id_is_validation_error() {
        let choice = ScaffoldChoice {
            scaffold_id: "does_not_exist".to_string(),
            topic: None,
            grade_level: None,
            num_questions: None,
        };
        assert!(matches!(
            request_from_choice(&choice),
            Err(AppError::ValidationError(_))
        ));
    }

    #[test]
    fn num_questions_clamps_at_both_bounds() {
        let id = builtin_scaffolds()[0].id.clone();

        // Below the floor -> clamped up to MIN_QUESTIONS.
        let low = request_from_choice(&ScaffoldChoice {
            scaffold_id: id.clone(),
            topic: None,
            grade_level: None,
            num_questions: Some(0),
        })
        .unwrap();
        assert_eq!(low.num_questions, Some(MIN_QUESTIONS));

        // Above the ceiling -> clamped down to MAX_QUESTIONS.
        let high = request_from_choice(&ScaffoldChoice {
            scaffold_id: id,
            topic: None,
            grade_level: None,
            num_questions: Some(9999),
        })
        .unwrap();
        assert_eq!(high.num_questions, Some(MAX_QUESTIONS));
    }

    #[test]
    fn produced_request_is_accepted_by_build_request_body() {
        // The whole point: a scaffold choice yields a request the EXISTING groq
        // request builder accepts, carrying the resolved topic in the user message.
        let choice = ScaffoldChoice {
            scaffold_id: "sci_plant_parts".to_string(),
            topic: None,
            grade_level: None,
            num_questions: None,
        };
        let req = request_from_choice(&choice).unwrap();
        let resolved_topic = req.topic.clone();

        let body = build_request_body(&req);
        assert_eq!(body["model"], "openai/gpt-oss-120b");

        let messages = body["messages"].as_array().expect("messages array");
        let user = messages
            .iter()
            .find(|m| m["role"] == "user")
            .expect("has a user message");
        assert!(
            user["content"].as_str().unwrap().contains(&resolved_topic),
            "user message carries the resolved topic"
        );
    }
}
