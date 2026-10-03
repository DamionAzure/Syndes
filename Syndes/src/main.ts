// Minimal entry point for the Syndes Tauri app. The real UI lanes are built out
// per the specs under docs/; this wires up just enough to render index.html and
// prove the webview boots. The greet form is a placeholder from the Tauri
// scaffold, handled entirely in the webview — the Rust side (see
// src-tauri/src/lib.rs) registers the scoring/content commands, which the UI
// lane will call via `invoke` from "@tauri-apps/api/core" once real screens land.

window.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector<HTMLFormElement>("#greet-form");
  const input = document.querySelector<HTMLInputElement>("#greet-input");
  const msg = document.querySelector<HTMLElement>("#greet-msg");

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = input?.value.trim() ?? "";
    if (msg) {
      msg.textContent = name ? `Hello, ${name}!` : "Hello!";
    }
  });
});
