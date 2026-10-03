// The ONE authoritative normalizer (spec 00 R3, spec 04 R3).
//
// This function is the single source of truth for turning a raw answer into the
// string that gets hashed. Both the seal step (teacher side, via `normalize_answer`)
// and the check step (`check_answer`/`score_submission`) call this exact function.
// Centralizing it here removes the #1 cross-lane bug class named in every spec:
// seal-time and check-time normalization drifting apart and marking correct
// answers wrong. Do not reimplement this rule anywhere else.

use regex::Regex;
use std::sync::OnceLock;
use unicode_normalization::UnicodeNormalization;

// Compiled once, reused for every normalize() call. `\p{P}` is the regex crate's
// Unicode general-category class for ALL punctuation subcategories (Pc, Pd, Pe,
// Pf, Pi, Po, Ps) in one pattern - this is why `regex` (built on Rust's Unicode
// tables) is used here instead of hand-rolling a category table. `\s+` collapses
// any run of Unicode whitespace to one space in the same pass.
static PUNCTUATION: OnceLock<Regex> = OnceLock::new();
static WHITESPACE_RUN: OnceLock<Regex> = OnceLock::new();

fn punctuation_re() -> &'static Regex {
    PUNCTUATION.get_or_init(|| Regex::new(r"\p{P}").expect("static punctuation regex"))
}

fn whitespace_run_re() -> &'static Regex {
    WHITESPACE_RUN.get_or_init(|| Regex::new(r"\s+").expect("static whitespace regex"))
}

/// Normalize per the contract string `"lowercase|trim|collapse-ws|strip-punct"`:
///   1. Unicode NFC
///   2. lowercase
///   3. strip Unicode punctuation (general category P*)
///   4. collapse internal whitespace runs to a single space
///   5. trim leading/trailing whitespace
///
/// Diacritics are KEPT on purpose ("José" stays "josé") - accent-insensitive
/// matching is a contract change, not a default (spec 00).
pub fn normalize(input: &str) -> String {
    // Step 1: NFC first, so case-folding and punctuation stripping below operate
    // on composed characters rather than a base letter + separate combining marks.
    let nfc: String = input.nfc().collect();

    // Step 2: lowercase (Rust's to_lowercase is the Unicode-aware, locale-independent
    // mapping - fine here since the contract does not call for locale-specific casing).
    let lower = nfc.to_lowercase();

    // Step 3: strip punctuation entirely - it contributes nothing to the hashed
    // string and must not be treated as a word boundary either.
    let no_punct = punctuation_re().replace_all(&lower, "");

    // Step 4: collapse any whitespace run (spaces, tabs, newlines, etc.) to one space.
    let collapsed = whitespace_run_re().replace_all(&no_punct, " ");

    // Step 5: trim leading/trailing whitespace.
    collapsed.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::normalize;

    #[test]
    fn lowercases() {
        assert_eq!(normalize("Carbon Dioxide"), "carbon dioxide");
    }

    #[test]
    fn trims_and_collapses_whitespace() {
        assert_eq!(normalize("  Carbon   Dioxide  "), "carbon dioxide");
    }

    #[test]
    fn strips_punctuation() {
        assert_eq!(normalize("It's a plant!"), "its a plant");
        assert_eq!(normalize("Chlorophyll."), "chlorophyll");
    }

    #[test]
    fn keeps_diacritics() {
        assert_eq!(normalize("José"), "josé");
    }

    #[test]
    fn handles_internal_hyphen_as_punctuation() {
        // Punctuation (including '-') is stripped, not treated as whitespace,
        // so "Carbon-dioxide" collapses to "carbondioxide", matching "Carbon Dioxide"
        // only if both sides are sealed/checked the same way - this test documents
        // the actual behavior rather than asserting a design intent beyond the spec.
        assert_eq!(normalize("Carbon-dioxide"), "carbondioxide");
    }

    #[test]
    fn empty_and_whitespace_only() {
        assert_eq!(normalize(""), "");
        assert_eq!(normalize("   "), "");
    }
}
