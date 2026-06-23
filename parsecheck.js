const ts = require("typescript");
const fs = require("fs");
const f = "app/ask/page.tsx";
const src = fs.readFileSync(f, "utf8");
const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
// @ts-ignore internal: parseDiagnostics holds syntax errors
const diags = sf.parseDiagnostics || [];
if (!diags.length) { console.log("SYNTAX OK — no parse errors in " + f); }
else {
  for (const d of diags) {
    const pos = d.start != null ? sf.getLineAndCharacterOfPosition(d.start) : {line:0,character:0};
    console.log(`SYNTAX ERROR ${f}:${pos.line+1}:${pos.character+1} — ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);
  }
}
