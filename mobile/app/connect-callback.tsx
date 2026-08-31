// The connector twin of auth-callback, and it exists for the same Android
// reason: app/connect.tsx redirects Trakt/TMDB/Simkl to
// Linking.createURL("connect-callback"), which iOS keeps inside the auth
// session and Android hands to the OS as an intent. Without a route here the
// redirect fell through +not-found into the WebView reader and showed
// metatake.net's 404.
//
// This screen deliberately does less than auth-callback. The sync it would have
// to resume — provider, pending token, cascade, theater state — lives in the
// connect screen's own state, and a cold start has none of it. Reviving that
// from a URL would be a second implementation of the flow, free to drift from
// the first. So: put the user back on /connect, where the connector tile still
// reads its persisted state and the sheet can be tapped again. The warm path,
// which is the common one, is unaffected — runOAuth already holds the redirect
// and completes the sync itself.
import { useRouter, type Href } from "expo-router";
import React, { useEffect } from "react";
import { Loading } from "../src/components/ui";

// Same cast, same reason as app/onboarding.tsx: the generated typed-routes file
// only refreshes on the next `expo start`, and /connect arrived after the last one.
const CONNECT_HREF = "/connect" as Href;

export default function ConnectCallback() {
  const router = useRouter();

  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace(CONNECT_HREF);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Loading />;
}
