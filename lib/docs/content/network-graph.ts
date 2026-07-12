const body = `
# Reading the Network graph

The page labelled **Connections** on Metatake is one graph shown four ways. Every node and every edge is computed from the same underlying ledger of relationships — nothing on the canvas is placed by hand. This page explains the four views, what each kind of edge means, and how the galaxy is laid out.

## The four views

The graph opens on a single entity and its neighbourhood — an *ego* view — and you move through it by clicking. A click recentres the graph on whatever you clicked; the little ↗ on each node opens that entity's own page instead. A search box jumps the map to any film, director, [trope](/tropes), idea, or [theorist](/theorist) by name.

Four tabs reshape what the graph draws.

| View | What it centres on |
|---|---|
| **Films** | One film and its nearest connected films |
| **Directors** | One [director](/director) and the directors adjacent to them |
| **Grouped** | A single entity surrounded by the films, figures, tropes, ideas, directors and theorists it touches |
| **Galaxy** | Every film at once, as a single projected field of dots |

The Films and Directors views also carry a small filter panel — release year, and for films an IMDb or Rotten Tomatoes floor — that reshapes the opening cloud before you start clicking. These filters only decide which films appear; they never change how a connection is scored.

## What the edges mean

An edge is never just a line. In the film view three different relationships are drawn, each in its own colour, and the difference matters.

**A watch-next arrow.** A directed arrow points from a film to what we suggest you watch next, or, reversed, to the films that recommend it. Arrows have direction because the relationship does: *A leads to B* is not the same claim as *B leads to A*.

**A kinship link.** An undirected line joins two films that read as kin. Its **thickness grows with the [kinship](/methodology/kinship) index** — a thin thread is a faint echo, a heavy line is close family. The number behind that thickness is the same one described in the kinship doc, fused from shared tropes and taste distance; here we simply let the eye read strength as weight rather than printing a figure on every edge.

**A counterpoint edge.** A third kind of line marks films that share a trope but read it in *opposite* directions — the same device pulled toward contrary meanings. How these pairs are found is explained in the [counterpoints](/methodology/counterpoints) doc.

The grouped view drops the arrows and instead colours nodes by kind — film, figure, trope, idea, director, theorist — so you can see how one entity sits across every layer at once. Hovering any node dims everything that is not its neighbour, which is the quickest way to read a crowded patch.

## The galaxy

The galaxy is the whole corpus in one frame. Each film is reduced to a single point of taste — the averaged position described in [the embedding map](/methodology/embedding-map) — and those points are projected down to two dimensions so that films which read alike land near each other. Distance on the galaxy is meaning, not chronology or alphabet: neighbouring dots are neighbours in how they were read.

The coloured neighbourhoods are found in the data, not drawn by us. We cluster the points and then **name each cluster from what is actually inside it** — the pair of genres that dominate it and a representative trope — so a region might read "Crime · Thriller — Hopper's Lonely American Light". No one wrote those labels by hand; if the underlying readings shift, the clusters and their names shift with them. Because the coordinates are stored once computed rather than re-projected on each visit, a galaxy view can be shared by link and will look the same when it loads — until the corpus grows enough for a recompute.

## What we decided, and why

A few calls were not obvious.

We draw the graph **from the readings, not from viewing behaviour**. Two films are kin because of how they were interpreted, never because the same people happened to watch both.

We let **thickness carry kinship strength instead of a printed number** on every edge. A similarity figure invites more precision than it deserves; a heavier line says "closer" without pretending to a decimal.

We **leave films with no connections out of the search jump**. A film that has earned no edges yet would open as a single dot with nothing around it, so the map's search quietly skips those rather than lead you to a dead end.

## Limits

The galaxy is a projection, and every projection lies a little: squeezing a high-dimensional taste space onto a flat page distorts some distances, so two dots that look adjacent are near but not necessarily nearest. Read the clusters as neighbourhoods, not as measurements.

The graph is also only as complete as the corpus. A film with few readings will show few edges — that is thin evidence, not a verdict that the film stands alone. And the cluster labels describe what a region mostly contains; individual films inside a neighbourhood can sit at its edge for good reasons.

---

> The Network graph reads from the same ledger as everything else and sits under the same [corrections](/methodology#corrections) loop: if a connection is factually mislabelled, tell us and we will fix the row.
`;
export default body;
