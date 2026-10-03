// Per-question salt generation for the seal step (spec 03 R2, spec 04 design.md:
// "salt = 16 random bytes (hex)").
//
// Salts are NOT secret - they ship in the module file in plaintext (spec 00 R2
// keeps the *answer* out of the file, not the salt). Their only job is to make
// each question's hash input unique so identical answers across questions don't
// produce identical hashes, and so a precomputed table can't be reused across
// modules. That is why a CSPRNG is used (uniqueness/unpredictability of the salt)
// even though the overall scheme is honestly "tamper-resistant, not unbreakable".

/// 16 random bytes drawn from the OS CSPRNG, hex-encoded to a 32-char string.
/// 16 bytes matches the width in the spec 04 seal sketch and is far more than
/// enough to make collisions between per-question salts negligible.
pub fn generate_salt() -> String {
    let mut bytes = [0u8; 16];
    // getrandom reads from the OS entropy source (getrandom(2)/BCryptGenRandom/etc.).
    // It only fails if the OS RNG itself is unavailable, which on a desktop host
    // running the app is not an expected condition - treat it as fatal rather
    // than silently producing a weak/empty salt that would corrupt sealing.
    getrandom::fill(&mut bytes).expect("OS CSPRNG unavailable while generating salt");
    hex::encode(bytes)
}

#[cfg(test)]
mod tests {
    use super::generate_salt;
    use std::collections::HashSet;

    #[test]
    fn salt_is_32_hex_chars() {
        let s = generate_salt();
        assert_eq!(s.len(), 32, "16 bytes -> 32 hex chars");
        assert!(s.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn salts_are_distinct() {
        // Not a randomness-quality test - just a sanity check that we are not
        // handing back a constant. 1000 draws with zero collisions is expected
        // for a 128-bit space.
        let mut seen = HashSet::new();
        for _ in 0..1000 {
            assert!(seen.insert(generate_salt()), "salt collision - RNG is broken");
        }
    }
}
