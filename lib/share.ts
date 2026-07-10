/**
 * lib/share.ts — isomorphic share helpers (see HANDOFF-공유-저장-시스템.md).
 * No third-party SDKs: every channel is a URL scheme; mobile uses the native
 * share sheet. The shared URL is always canonical metatake.net + a UTM tag so
 * inbound share traffic is measurable (canonical stays UTM-free — no dup index).
 */

export type ShareChannel =
  | "x" | "facebook" | "whatsapp" | "telegram" | "reddit" | "linkedin" | "email" | "copy" | "native";

const SITE = "https://metatake.net";

/** Absolute canonical URL for `path` (a site-relative "/film/..") with a share UTM. */
export function shareHref(path: string, channel: ShareChannel): string {
  const clean = path.split("#")[0].split("?")[0];
  const src = channel === "copy" ? "copy" : channel === "native" ? "native" : channel;
  return `${SITE}${clean}?utm_source=${src}&utm_medium=share`;
}

/** The intent URL for an external channel, or null for copy/native (handled in-app). */
export function channelIntent(
  channel: ShareChannel,
  args: { path: string; text: string; title: string },
): string | null {
  const url = encodeURIComponent(shareHref(args.path, channel));
  const text = encodeURIComponent(args.text);
  const title = encodeURIComponent(args.title);
  switch (channel) {
    case "x": return `https://x.com/intent/post?text=${text}&url=${url}`;
    case "facebook": return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    case "whatsapp": return `https://wa.me/?text=${text}%20${url}`;
    case "telegram": return `https://t.me/share/url?url=${url}&text=${text}`;
    case "reddit": return `https://www.reddit.com/submit?url=${url}&title=${text}`;
    case "linkedin": return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    case "email": return `mailto:?subject=${title}&body=${text}%0A%0A${decodeURIComponent(url)}`;
    default: return null; // copy / native
  }
}

export const PRIMARY_CHANNELS: ShareChannel[] = ["x", "facebook"];
export const MORE_CHANNELS: ShareChannel[] = ["whatsapp", "telegram", "reddit", "linkedin", "email"];

export const CHANNEL_LABEL: Record<ShareChannel, string> = {
  x: "X", facebook: "Facebook", whatsapp: "WhatsApp", telegram: "Telegram",
  reddit: "Reddit", linkedin: "LinkedIn", email: "Email", copy: "Copy link", native: "Share",
};

/** X caps at 280; keep the URL room. Trim the hook to ~200 chars on a word break. */
export function trimForX(text: string, max = 200): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}
