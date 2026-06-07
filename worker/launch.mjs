#!/usr/bin/env node
/**
 * Worker launcher — bypasses macOS ECANCELED on node_modules
 * Usage: node --import tsx/esm launch.mjs
 * 
 * Loads .env.local manually (no dotenv), then dynamic-imports index.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local
const envPath = process.env.DOTENV_CONFIG_PATH ?? resolve(".", "..", ".env.local");
try {
  const envFile = readFileSync(envPath, "utf8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  console.log("[launcher] .env.local loaded");
} catch (e) {
  console.error("[launcher] Failed to load .env.local:", e.message);
}

console.log("[launcher] Importing index.ts...");
import("./src/index.ts")
  .then(() => console.log("[launcher] index.ts loaded"))
  .catch((err) => { console.error("[launcher] FATAL:", err); process.exit(1); });
