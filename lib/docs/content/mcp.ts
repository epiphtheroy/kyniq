const body = `
# Metatake in your AI
There is a difference between an AI that was *trained on* a site months ago and one that can *read it now*. Metatake runs a small server that lets an AI assistant do the second thing — look up the criticism live, mid-conversation, and answer with a link back — using an open standard called MCP (the Model Context Protocol).

## What it is
MCP is a common way for AI apps to plug into an outside source of knowledge. Connect Metatake once, and an assistant like Claude can, whenever you ask, search the corpus and pull a film's [readings](/methodology/strong-misreadings), its [TakeScore](/methodology/takescore), kindred films and [locations](/methodology/open-data) — always current, never a stale copy. There is no key and no charge for conversational use.

The plain-language setup — the server address and the three steps to connect it in Claude — is on **[metatake.net/mcp](/mcp)**, and there is a button on every film page that walks a first-timer through it.

## Why we built it this way
It follows from a choice about how we want machines to use this work. Training scrapers take the writing, drop the attribution, and send nothing back; an assistant reading us live, on the other hand, cites us with a link at the moment it answers. So we make the second easy and the first pointless: the tools are open and free, and every result they return carries an instruction to credit Metatake and keep the source link. Giving the data away and making the attribution structural is the whole design.

## Nothing is invented
The server does not write anything new. It hands over the record that already exists — the same assembled readings and rule-made data described throughout these docs — so an assistant using it is standing on compiled work, not improvising. What it can and cannot do is set out in the [AI disclosure](/methodology/ai-disclosure).

---
> To call the same data from a script or an agent framework instead of a chat, see [the API](/methodology/api). How we treat automated visitors more broadly is in [bots and crawlers](/methodology/bots-and-crawlers).
`;
export default body;
