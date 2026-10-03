// Hashing + compare (spec 00 R2/R5/R6, spec 04 R2/R4).
//
// Honest note (kept as a comment, not a UI claim - spec 04 R4, spec 02 R5):
// constant-time compare is good hygiene against timing side-channels, but MC/TF
// answers are low-entropy and the salt ships in plaintext in the module file.
// This is tamper-resistant, NOT unbreakable - the code and its comments must
// never imply cryptographic secrecy of the answer itself.

use crate::model::{AppError, Question};
use crate::normalize::normalize;
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

/// SHA-256(question_id : normalized_answer : salt), hex-encoded.
///
/// Separator note (spec 04): `question_id` and `salt` are controlled/opaque
/// (ids are author-chosen slugs, salts are hex), and the normalized answer sits
/// in the middle. A literal ':' typed by a student lands inside the answer
/// segment and is harmless - it cannot be confused with the id/salt boundaries.
/// Keep this separator identical between seal and check; it is part of the contract.
fn hash_answer(question_id: &str, normalized_answer: &str, salt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(question_id.as_bytes());
    hasher.update(b":");
    hasher.update(normalized_answer.as_bytes());
    hasher.update(b":");
    hasher.update(salt.as_bytes());
    hex::encode(hasher.finalize())
}

/// Score one raw answer against a question's sealed salt + answer_hash.
/// Returns `(correct, points_awarded)`. Never returns or logs the plaintext
/// answer, the normalized answer, or the hash preimage - only the verdict.
pub fn check(question: &Question, raw_answer: &str) -> Result<(bool, u32), AppError> {
    validate_kind(&question.kind)?;

    let normalized = normalize(raw_answer);
    let computed = hash_answer(&question.id, &normalized, &question.salt);

    // Constant-time comparison of the two hex digests. Both are fixed-length
    // (64 hex chars for SHA-256), so there is no length leak either.
    let correct = bool::from(computed.as_bytes().ct_eq(question.answer_hash.as_bytes()));
    let points = if correct { question.points } else { 0 };
    Ok((correct, points))
}

/// Seal-side helper (spec 03 R2): compute the hash a correct answer should seal
/// to, given a fresh random salt. Exposed via the `normalize_answer` command plus
/// this pure function so the teacher/content lane can seal through the SAME
/// normalizer and hashing path as the student-side check - never a second
/// implementation (spec 00 R3, spec 03 R3).
///
/// Not yet wired to a Tauri command: the content lane (spec 03) seals offline,
/// one-shot, from a draft module during generation rather than per-keystroke
/// from the webview, so it is exposed as a plain Rust fn for that lane (or a
/// future `seal_answer` command) to call directly, and used here by tests.
#[allow(dead_code)]
pub fn seal(question_id: &str, correct_answer: &str, salt: &str) -> String {
    hash_answer(question_id, &normalize(correct_answer), salt)
}

/// The three kinds named in spec 00 R4. Anything else is a typed, legible error
/// (spec 04 R6) rather than a silent wrong score or a panic.
const KNOWN_KINDS: [&str; 3] = ["multiple_choice", "identification", "true_false"];

fn validate_kind(kind: &str) -> Result<(), AppError> {
    if KNOWN_KINDS.contains(&kind) {
        Ok(())
    } else {
        Err(AppError::UnknownQuestionKind(kind.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Question;

    fn mc_question() -> Question {
        Question {
            id: "q1".to_string(),
            kind: "multiple_choice".to_string(),
            prompt: "Which gas do plants take in?".to_string(),
            options: Some(vec![
                "Oxygen".to_string(),
                "Carbon Dioxide".to_string(),
                "Nitrogen".to_string(),
                "Hydrogen".to_string(),
            ]),
            salt: "deadbeef".to_string(),
            answer_hash: seal("q1", "Carbon Dioxide", "deadbeef"),
            points: 1,
        }
    }

    #[test]
    fn correct_answer_scores_points() {
        let q = mc_question();
        let (correct, points) = check(&q, "carbon   dioxide!").unwrap();
        assert!(correct);
        assert_eq!(points, 1);
    }

    #[test]
    fn wrong_answer_scores_zero() {
        let q = mc_question();
        let (correct, points) = check(&q, "Oxygen").unwrap();
        assert!(!correct);
        assert_eq!(points, 0);
    }

    #[test]
    fn seal_and_check_round_trip_is_normalization_independent() {
        // Seal with one surface form, check with a differently-formatted but
        // normalization-equivalent surface form - this is the exact cross-lane
        // risk every spec calls out, and it must hold.
        let salt = "abc123";
        let hash = seal("q9", "  José's Plant!  ", salt);
        let q = Question {
            id: "q9".to_string(),
            kind: "identification".to_string(),
            prompt: "Name it.".to_string(),
            options: None,
            salt: salt.to_string(),
            answer_hash: hash,
            points: 2,
        };
        // Different case and whitespace/punctuation, but the SAME diacritic -
        // normalization is case/whitespace/punctuation-insensitive, never
        // accent-insensitive (spec 00).
        let (correct, points) = check(&q, "joSÉ's   Plant").unwrap();
        assert!(correct);
        assert_eq!(points, 2);
    }

    #[test]
    fn unknown_kind_is_a_typed_error_not_a_panic() {
        let mut q = mc_question();
        q.kind = "matching".to_string();
        let result = check(&q, "anything");
        assert!(matches!(result, Err(AppError::UnknownQuestionKind(_))));
    }
}
