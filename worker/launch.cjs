#!/usr/bin/env node
// Launcher: loads tsx programmatically then runs index.ts
// Bypasses npx tsx shebang/hanging issues
console.log("[launcher] Starting...");
require("tsx/cjs");
console.log("[launcher] tsx loaded, importing index.ts...");
require("./src/index.ts");
