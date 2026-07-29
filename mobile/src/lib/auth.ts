// Shared native OAuth flows — one implementation for every sign-in surface
// (onboarding account step + the You tab's sign-in panel), so the flows can't drift.
// Google: system browser via expo-web-browser, PKCE code exchange on the deep link
// (metatake://auth-callback in dev/store builds, exp://<lan-ip> in Expo Go — both
// whitelisted in the Supabase Auth console). Cancel is not an error.
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

export type OAuthOutcome = "ok" | "cancel" | "error";

export async function signInWithGoogle(): Promise<OAuthOutcome> {
  try {
    const redirectTo = Linking.createURL("auth-callback");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) throw error ?? new Error("no oauth url");
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type !== "success" || !res.url) return "cancel"; // user closed the sheet
    const back = new URL(res.url);
    const code = back.searchParams.get("code");
    if (code) {
      const { error: ex } = await supabase.auth.exchangeCodeForSession(code);
      if (ex) throw ex;
    } else {
      // implicit flow — tokens ride the URL fragment
      const frag = new URLSearchParams((back.hash || "").replace(/^#/, ""));
      const access_token = frag.get("access_token");
      const refresh_token = frag.get("refresh_token");
      if (!access_token || !refresh_token) throw new Error("no tokens in callback");
      const { error: es } = await supabase.auth.setSession({ access_token, refresh_token });
      if (es) throw es;
    }
    return "ok";
  } catch {
    return "error";
  }
}
