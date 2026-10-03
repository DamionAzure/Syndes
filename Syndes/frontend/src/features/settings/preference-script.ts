/**
 * Storage key for saved preferences. It lives here, not in preferences.ts,
 * because the root layout (a Server Component) needs it for the script below.
 */
export const PREFERENCES_KEY = "syndes:preferences:v1";

/**
 * Inline script that applies saved preferences to <html> before first paint,
 * so the page never flashes the wrong theme. Keep it dependency-free and in
 * step with `applyPreferences` in preferences.ts.
 */
export const preferenceScript = `(function () {
  var root = document.documentElement;
  try {
    var saved = JSON.parse(window.localStorage.getItem(${JSON.stringify(PREFERENCES_KEY)}) || "null") || {};
    var theme = saved.theme;
    root.dataset.theme = theme === "dark" || theme === "system" ? theme : "light";
    root.dataset.controls = saved.largerControls === true ? "large" : "default";
  } catch (error) {
    root.dataset.theme = "light";
    root.dataset.controls = "default";
  }
})();`;
