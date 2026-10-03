// The seal step (spec 03 R2/R3). Turns a draft module whose questions carry
// PLAINTEXT answers into a contract-valid, shippable module whose questions
// carry only `{salt, answer_hash}` - with the plaintext dropped.
//
// Why this lives in the Rust core (spec 03 R3, spec 00 R3): sealing MUST use the
// exact same normalizer + hash as student-side checking, or every affected
// answer scores wrong. Rather than let the content lane reimplement normalize +
// SHA-256 in JS and risk drift, the core owns the one implementation and the
// content lane calls it. `seal_module`/`seal_answer` are the commands that do so.
//
// Plaintext handling (spec 03 R2 CRITICAL - "seal, then strip"): the plaintext
// answer enters only as draft input, is read once to compute the hash, and is
// never written into the returned Module, never stored, never logged.

use crate::loader;
use crate::model::{AppError, DraftModule, DraftQuestion, Module, Question, Quiz, SealedAnswer};
use crate::salt::generate_salt;
use crate::scoring;

const OPTION_KINDS: [&str; 2] = ["multiple_choice", "true_false"];
const KNOWN_QUESTION_KINDS: [&str; 3] = ["multiple_choice", "identification", "true_false"];

/// Seal one draft question: generate a fresh salt, hash through the core's
/// normalizer, and return `{salt, answer_hash}`. The plaintext `answer` is read
/// here and nowhere else.
fn seal_question(q: &DraftQuestion) -> Result<SealedAnswer, AppError> {
    if !KNOWN_QUESTION_KINDS.contains(&q.kind.as_str()) {
        return Err(AppError::UnknownQuestionKind(q.kind.clone()));
    }
    if q.answer.trim().is_empty() {
        return Err(AppError::MissingField(format!("question[{}].answer", q.id)));
    }

    // For MC/TF the sealed answer must be one of the shown options, otherwise the
    // question is unanswerable (the student can only pick an option, and none of
    // them would ever hash to the sealed value). Catch this at seal time where it
    // is cheap to fix, not at demo time as a silently-always-wrong question.
    if OPTION_KINDS.contains(&q.kind.as_str()) {
        match &q.options {
            Some(opts) => {
                let present = opts.iter().any(|opt| opt == &q.answer);
                if !present {
                    return Err(AppError::ValidationError(format!(
                        "question[{}]: sealed answer is not one of the options",
                        q.id
                    )));
                }
            }
            None => {
                return Err(AppError::MissingField(format!(
                    "question[{}].options",
                    q.id
                )));
            }
        }
    }

    let salt = generate_salt();
    // Route through the SAME seal path student-side checking uses (normalize + the
    // identical hash join). This is the whole point of centralizing here.
    let answer_hash = scoring::seal(&q.id, &q.answer, &salt);
    Ok(SealedAnswer { salt, answer_hash })
}

/// Seal a whole draft module into a contract-valid, shippable module.
///
/// Steps: convert each draft question to a sealed `Question` (plaintext dropped),
/// assemble the `Module`, then run it through the loader's validation so the
/// output is guaranteed to satisfy the same contract `load_module` enforces -
/// the content lane cannot hand the student path something that won't load.
pub fn seal_module(draft: DraftModule) -> Result<Module, AppError> {
    let sealed_quiz = match &draft.quiz {
        Some(dq) => {
            let mut questions = Vec::with_capacity(dq.questions.len());
            for q in &dq.questions {
                let sealed = seal_question(q)?;
                // Build the shipped question WITHOUT the plaintext answer field -
                // there is no `answer` on `Question`, so it cannot leak by construction.
                questions.push(Question {
                    id: q.id.clone(),
                    kind: q.kind.clone(),
                    prompt: q.prompt.clone(),
                    options: q.options.clone(),
                    salt: sealed.salt,
                    answer_hash: sealed.answer_hash,
                    points: q.points,
                });
            }
            Some(Quiz {
                hash_algo: dq.hash_algo.clone(),
                normalization: dq.normalization.clone(),
                questions,
            })
        }
        None => None,
    };

    let module = Module {
        schema_version: draft.schema_version,
        module: draft.module,
        lesson: draft.lesson,
        quiz: sealed_quiz,
    };

    // Final gate: the sealed module must satisfy the same contract the student
    // path loads against (locked schema/hash/normalization strings, valid kinds,
    // options present for MC/TF, etc.). Reusing loader::validate keeps one
    // definition of "contract-valid".
    loader::validate(&module)?;
    Ok(module)
}

/// Seal a single answer for incremental authoring (spec 03): the content lane
/// passes one question id + its plaintext answer and gets back `{salt, hash}` to
/// write into that question. Same path as `seal_module`, one question at a time.
pub fn seal_answer(question_id: &str, plaintext_answer: &str) -> Result<SealedAnswer, AppError> {
    if plaintext_answer.trim().is_empty() {
        return Err(AppError::MissingField(format!("answer for {question_id}")));
    }
    let salt = generate_salt();
    let answer_hash = scoring::seal(question_id, plaintext_answer, &salt);
    Ok(SealedAnswer { salt, answer_hash })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{DraftQuiz, ModuleMeta};
    use crate::scoring::check;

    fn draft() -> DraftModule {
        DraftModule {
            schema_version: "1.0".to_string(),
            module: ModuleMeta {
                id: "mod_seal_test".to_string(),
                module_type: "quiz".to_string(),
                title: "Seal Test".to_string(),
                subject: None,
                grade_level: None,
            },
            lesson: None,
            quiz: Some(DraftQuiz {
                hash_algo: "SHA-256".to_string(),
                normalization: "lowercase|trim|collapse-ws|strip-punct".to_string(),
                questions: vec![
                    DraftQuestion {
                        id: "q1".to_string(),
                        kind: "multiple_choice".to_string(),
                        prompt: "Which gas?".to_string(),
                        options: Some(vec!["Oxygen".to_string(), "Carbon dioxide".to_string()]),
                        answer: "Carbon dioxide".to_string(),
                        points: 1,
                    },
                    DraftQuestion {
                        id: "q2".to_string(),
                        kind: "identification".to_string(),
                        prompt: "Green pigment?".to_string(),
                        options: None,
                        answer: "Chlorophyll".to_string(),
                        points: 2,
                    },
                    DraftQuestion {
                        id: "q3".to_string(),
                        kind: "true_false".to_string(),
                        prompt: "Plants photosynthesize.".to_string(),
                        options: Some(vec!["True".to_string(), "False".to_string()]),
                        answer: "True".to_string(),
                        points: 1,
                    },
                ],
            }),
        }
    }

    #[test]
    fn sealed_module_scores_its_own_answers() {
        let sealed = seal_module(draft()).expect("draft seals");
        let quiz = sealed.quiz.as_ref().unwrap();

        // Each sealed question scores its correct answer (in a different surface
        // form to also exercise normalization parity through the seal path).
        let q1 = &quiz.questions[0];
        assert!(check(q1, "  carbon DIOXIDE! ").unwrap().0);
        let q2 = &quiz.questions[1];
        assert_eq!(check(q2, "chlorophyll").unwrap(), (true, 2));
        let q3 = &quiz.questions[2];
        assert!(check(q3, "true").unwrap().0);
    }

    #[test]
    fn sealed_output_drops_identification_plaintext() {
        // spec 03 R2 CRITICAL: "seal, then strip". The honest scope of this
        // guarantee: an IDENTIFICATION answer is free text shown NOWHERE in the
        // module, so its plaintext must not appear in the sealed output at all.
        //
        // MC/TF answers are a different story and the specs are explicit about it:
        // the correct answer for those IS one of the displayed `options` (the
        // student must see every option to choose), so that text necessarily
        // ships in the file. Sealing hides WHICH option is correct (via answer_hash),
        // not the option text itself - that is the "low-entropy, tamper-resistant,
        // not unbreakable" property, not a leak. So we only assert the strip for
        // the identification answer, which is the real secret-bearing case.
        let sealed = seal_module(draft()).expect("draft seals");
        let json = serde_json::to_string(&sealed).unwrap();

        // q2 is identification with answer "Chlorophyll" - must be gone.
        assert!(
            !json.contains("Chlorophyll"),
            "sealed JSON leaked the identification plaintext answer"
        );

        // Sanity: no `answer` key survived serialization for any question - the
        // shipped `Question` type has no such field, so this holds by construction,
        // but assert it so a future field addition can't silently reintroduce leaks.
        assert!(
            !json.contains("\"answer\""),
            "sealed JSON must not carry a plaintext `answer` field"
        );
    }

    #[test]
    fn mc_answer_must_match_an_option() {
        let mut d = draft();
        if let Some(q) = d.quiz.as_mut().unwrap().questions.get_mut(0) {
            q.answer = "Argon".to_string(); // not in options
        }
        assert!(matches!(seal_module(d), Err(AppError::ValidationError(_))));
    }

    #[test]
    fn seal_answer_round_trips_through_check() {
        use crate::model::Question;
        let sealed = seal_answer("qx", "Mitochondria").unwrap();
        let q = Question {
            id: "qx".to_string(),
            kind: "identification".to_string(),
            prompt: "p".to_string(),
            options: None,
            salt: sealed.salt,
            answer_hash: sealed.answer_hash,
            points: 1,
        };
        assert!(check(&q, "  mitochondria ").unwrap().0);
    }
}
