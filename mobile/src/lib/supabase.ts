import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config";

// AsyncStorage (not SecureStore): Supabase session JSON exceeds SecureStore's 2KB
// value cap. This matches the official Supabase React Native guide.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE is the reliable OAuth flow on native: the provider redirects back
    // with `?code=` (a query param survives the custom-scheme deep link, unlike
    // an implicit `#access_token` fragment which iOS can drop), and the stored
    // verifier lets exchangeCodeForSession() complete the sign-in. Required for
    // the Google flow in app/onboarding.tsx to work in the store build.
    flowType: "pkce",
  },
});
