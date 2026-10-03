// LIVE smoke test of the teacher-side generation path (spec 03 T2/T4) WITHOUT
// the frontend/webview. Runs the exact functions the `generate_module` command
// calls - groq::generate_draft -> seal::seal_module - against the real Groq API,
// using GROQ_API_KEY from .env.
//
// Run from Syndes/src-tauri:   cargo run --example live_groq
//
// MAKES A REAL NETWORK CALL and spends Groq credits. This is a manual dev tool,
// not a test, and never part of the shipped app.
//
// Output discipline (spec 03 R2): the DRAFT (pre-seal) carries plaintext answers
// and is NEVER printed. We only print the SEALED module, which by construction
// has no plaintext answer field - prompts, option text, and opaque hashes only.
// The API key is never printed.

use syndes_lib::{
    generate_draft_for_smoke as generate_draft, seal_module_for_smoke as seal_module,
    GenerationRequest, ModuleForSmoke as Module,
};

fn print_sealed(module: &Module) {
    println!("  module.id    : {}", module.module.id);
    println!("  module.title : {}", module.module.title);
    println!("  module.type  : {}", module.module.module_type);
    if let Some(quiz) = &module.quiz {
        println!("  questions    : {}", quiz.questions.len());
        for q in &quiz.questions {
            // Prompt + option text are display content (safe to show). The answer
            // is NOT here - only salt + answer_hash, which are opaque by design.
            let opts = q
                .options
                .as_ref()
                .map(|o| o.join(" | "))
                .unwrap_or_else(|| "(free text)".to_string());
            println!(
                "    - [{}] {} ({})  options: {}  hash: {}…",
                q.kind,
                q.prompt,
                q.id,
                opts,
                // Show only a short prefix of the hash so output stays compact.
                &q.answer_hash[..q.answer_hash.len().min(12)]
            );
        }
    } else {
        println!("  (no quiz section)");
    }
}

fn main() {
    // Load .env the same way the app does at startup.
    let _ = dotenvy::dotenv();

    let request = GenerationRequest {
        topic: "The water cycle".to_string(),
        subject: Some("Science".to_string()),
        grade_level: Some("elementary".to_string()),
        source_text: None,
        num_questions: Some(3),
    };

    println!(
        "Requesting a module from Groq (topic: \"{}\")…",
        request.topic
    );

    // The live path: generate a draft (network), then seal it (drops plaintext).
    match generate_draft(request) {
        Ok(draft) => {
            // Do NOT print the draft - it holds plaintext answers. Seal first.
            match seal_module(draft) {
                Ok(sealed) => {
                    println!("\n✓ LIVE generation + seal succeeded. Sealed module:");
                    print_sealed(&sealed);
                    println!(
                        "\nThe sealed module above carries NO plaintext answers (only hashes)."
                    );
                }
                Err(e) => {
                    // Draft came back but failed to seal (e.g. an MC answer not in
                    // its options). Still don't print the draft.
                    eprintln!("\n✗ Generation succeeded but sealing failed: {e}");
                    std::process::exit(1);
                }
            }
        }
        Err(e) => {
            // In the real command this is where the guaranteed fallback kicks in.
            // Here we surface the error so the smoke test is informative.
            eprintln!("\n✗ LIVE generation failed: {e}");
            eprintln!("(In the app, generate_module would serve the fallback fixture here.)");
            std::process::exit(1);
        }
    }
}
