#!/usr/bin/env node
// Diagnostic: test each import from index.ts one by one
console.log("[diag] 1. dotenv/config...");
await import("dotenv/config");
console.log("[diag] 2. node:http...");
await import("node:http");
console.log("[diag] 3. @supabase/supabase-js...");
await import("@supabase/supabase-js");
console.log("[diag] 4. ./src/generator.ts...");
await import("./src/generator.ts");
console.log("[diag] 5. ./src/publisher.ts...");
await import("./src/publisher.ts");
console.log("[diag] 6. ./src/curiobot.ts...");
await import("./src/curiobot.ts");
console.log("[diag] 7. ./src/reaudit.ts...");
await import("./src/reaudit.ts");
console.log("[diag] ALL IMPORTS OK!");
