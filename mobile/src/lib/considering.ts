// "Considering" — the deliberation pile (v4 §5.0, owner decision D2).
// A film the user OPENED (judgment brief) but left without judging. Client-side
// ring buffer only (AsyncStorage, last 50) — deliberately NOT in the DB until
// demand is proven (then migration 0109 promotes it). Device-local by design.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "mt-considering-v1";
const CAP = 50;

export type ConsideringItem = { slug: string; title: string; poster_path: string | null; at: number };

let cache: ConsideringItem[] | null = null;

async function load(): Promise<ConsideringItem[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as ConsideringItem[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function save(items: ConsideringItem[]): Promise<void> {
  cache = items;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // best-effort — this is an approximation pile, never the ledger (§13-16)
  }
}

/** Record "opened the brief" — newest first, deduped, capped. */
export async function noteOpened(item: Omit<ConsideringItem, "at">): Promise<void> {
  const items = await load();
  const rest = items.filter((x) => x.slug !== item.slug);
  await save([{ ...item, at: Date.now() }, ...rest].slice(0, CAP));
}

/** A judgment settles the film — drop it from the pile. */
export async function noteJudged(slug: string): Promise<void> {
  const items = await load();
  if (items.some((x) => x.slug === slug)) await save(items.filter((x) => x.slug !== slug));
}

/** The pile, newest first, minus anything the ledger has since settled. */
export async function pile(settled: (slug: string) => boolean): Promise<ConsideringItem[]> {
  const items = await load();
  return items.filter((x) => !settled(x.slug));
}
