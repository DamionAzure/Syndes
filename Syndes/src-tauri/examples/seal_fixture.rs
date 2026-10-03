// One-off dev tool: seals the hand-authored example module's known answers into
// real salt + answer_hash pairs using the SAME normalizer/hasher the core uses
// at check time (via the lib's re-exported `seal_for_fixture`). The
// example.module.json fixture ships with placeholder hashes (see its own
// "_note") that must be replaced before it can score correctly in demo or dev.
// Run with: cargo run --example seal_fixture
//
// Not part of the app binary or any Tauri command - this is a build-time/dev
// utility only, kept here (not in src/) so it is obviously not part of the
// shipped core.

use syndes_lib::seal_for_fixture as seal;

fn fresh_salt(seed: u8) -> String {
    // Deterministic-but-distinct hex salts for a reproducible fixture. A real
    // seal step (spec 03) would use a CSPRNG; a dev fixture only needs salts
    // that are present, distinct per question, and non-trivial.
    let mut bytes = [0u8; 16];
    for (i, b) in bytes.iter_mut().enumerate() {
        *b = seed.wrapping_mul(31).wrapping_add(i as u8);
    }
    hex::encode(bytes)
}

fn main() {
    let answers = [
        ("q1", "Carbon dioxide"),
        ("q2", "Chlorophyll"),
        ("q3", "True"),
    ];

    for (i, (id, answer)) in answers.iter().enumerate() {
        let salt = fresh_salt(i as u8 + 1);
        let hash = seal(id, answer, &salt);
        println!("{id}: salt=\"{salt}\" answer_hash=\"{hash}\"");
    }
}
