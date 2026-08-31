// The screen Android needs and iOS never sees.
//
// Google sign-in redirects to Linking.createURL("auth-callback") — metatake://
// auth-callback?code=… in a store build. On iOS that URL is captured inside
// ASWebAuthenticationSession and handed straight back to signInWithGoogle();
// the OS never routes anywhere. On Android the Custom Tab hands it to the OS as
// an intent, so Expo Router navigates to /auth-callback — and until this file
// existed there was no such route.
//
// What the user saw was worse than a blank screen. +not-found redirects any
// unknown path into /read, the WebView reader, so the phone loaded
// https://metatake.net/auth-callback?code=… and rendered the WEBSITE'S 404 —
// which is why this read as "the site is broken" rather than "the app has no
// route", and why it never reproduced on an iPhone.
//
// Two ways in, and this screen has to survive both:
//   warm — signInWithGoogle() is still awaiting the browser and will do the code
//          exchange itself. We must not race it: a PKCE code is single-use, so a
//          second exchange fails and would report failure over a real sign-in.
//   cold — the deep link started a new process. That promise died with the old
//          one and nobody will exchange the code unless this screen does.
// So: wait for a session first, exchange only if none arrives, and re-check
// before calling it a failure.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Loading } from "../src/components/ui";
import { supabase } from "../src/lib/supabase";

const SESSION_WAIT_MS = 2500; // warm path: how long the other exchange may take
const POLL_MS = 150;

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const code = typeof params.code === "string" ? params.code : null;
  const denied = typeof params.error === "string" ? params.error : null;

  useEffect(() => {
    let alive = true;

    const leave = () => {
      if (!alive) return;
      // Warm path: onboarding (or the You tab) is still underneath — going back
      // returns the user to the step they left, mid-flow, which is what they
      // expect. Cold start has no stack to pop, so land on the app instead.
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)");
    };

    const session = async () => (await supabase.auth.getSession()).data.session;

    void (async () => {
      // Provider "Deny" comes back as a redirect carrying ?error=. That is a
      // decision, not a fault — leave quietly, the same as a cancelled sheet.
      if (denied) return leave();

      const deadline = Date.now() + SESSION_WAIT_MS;
      while (alive && Date.now() < deadline) {
        if (await session()) return leave();
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
      if (!alive) return;

      if (code) {
        // Cold start, or the warm exchange is slower than the wait above. Either
        // way an already-spent code throws, so a failure here is only a failure
        // if there is still no session after it.
        try {
          await supabase.auth.exchangeCodeForSession(code);
        } catch {
          /* fall through to the session re-check */
        }
      }
      leave();
    })();

    return () => {
      alive = false;
    };
    // Deep-link params are fixed for the life of this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Loading />;
}
