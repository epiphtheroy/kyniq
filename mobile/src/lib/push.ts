// Push registration — permission → Expo push token → own-row upsert (push_tokens).
// Returns true only when the token is actually persisted server-side; callers
// (the My-tab switch) revert their UI when this resolves false.
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { clientPlatform } from "../platform/env";
import { ensureNotificationChannel } from "../platform/notifications";
import { api } from "./api";

export async function registerPush(country: string, locale: string): Promise<boolean> {
  // Simulators never get real push tokens.
  if (!Device.isDevice) return false;

  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return false;

  // Android needs a channel before any notification can be shown; iOS does not.
  await ensureNotificationChannel();

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
      ?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  let token: Notifications.ExpoPushToken;
  try {
    token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  } catch {
    // TODO(owner: eas init) — getExpoPushTokenAsync throws until the EAS project exists.
    return false;
  }

  return api.registerPushToken(token.data, country, locale, clientPlatform);
}
