import { invoke, isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { supabase } from "@/lib/supabase";

const DESKTOP_CALLBACK = "syndes://auth/callback";
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Node environment augmentation
  namespace NodeJS {
    interface ProcessEnv {
      readonly NEXT_PUBLIC_SYNDES_SCHOOL_SSO_DOMAIN?: string;
    }
  }
}

const SCHOOL_DOMAIN = process.env.NEXT_PUBLIC_SYNDES_SCHOOL_SSO_DOMAIN;

export const identityProviderLabel = SCHOOL_DOMAIN ? "school account" : "Google";

export async function startOAuth(): Promise<void> {
  const redirectTo = isTauri() ? DESKTOP_CALLBACK : `${window.location.origin}/auth/callback`;
  const options = { redirectTo, skipBrowserRedirect: true };
  const result = SCHOOL_DOMAIN
    ? await supabase.auth.signInWithSSO({ domain: SCHOOL_DOMAIN, options })
    : await supabase.auth.signInWithOAuth({ provider: "google", options });

  if (result.error) throw result.error;
  if (!result.data.url) throw new Error("The sign-in link was not returned. Try again.");
  if (isTauri()) await openUrl(result.data.url);
  else window.location.assign(result.data.url);
}

export async function completeOAuthCallback(url: string): Promise<void> {
  const callback = new URL(url);
  const expected = isTauri()
    ? callback.protocol === "syndes:" && callback.host === "auth" && callback.pathname === "/callback"
    : callback.origin === window.location.origin && callback.pathname === "/auth/callback";
  if (!expected) throw new Error("The sign-in return link is invalid.");
  const providerError = callback.searchParams.get("error_description") ?? callback.searchParams.get("error");
  if (providerError) throw new Error(providerError);
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("The sign-in return link is missing its code. Try again.");
  const flowId = callback.searchParams.get("sb_flow_id");
  const { data, error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
  if (error) throw error;
  if (isTauri()) await invoke("auth_online_login", { accessToken: data.session.access_token });
}

export async function signOutAccount(hideLocalData: () => void): Promise<void> {
  // Native must forget its offline grant before the browser session is removed.
  if (isTauri()) await invoke("auth_logout");
  hideLocalData();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  // Supabase clears local storage even when its remote sign-out request fails.
  if (error && !isTauri()) throw error;
}
