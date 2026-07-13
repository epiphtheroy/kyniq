/**
 * The Method Docs — body map (slug → markdown string).
 * One file per doc in this directory; empty-string bodies render as 404
 * (invariant: a stub doc is not advertised). Metadata/order: lib/docs/registry.ts.
 */
import aiDisclosure from "./ai-disclosure";
import corpusGrowth from "./corpus-growth";
import corrections from "./corrections";
import counterpoints from "./counterpoints";
import credits from "./credits";
import editorialResponsibility from "./editorial-responsibility";
import embeddingMap from "./embedding-map";
import essays from "./essays";
import figures from "./figures";
import filmSelection from "./film-selection";
import frameworks from "./frameworks";
import howAPageIsMade from "./how-a-page-is-made";
import independence from "./independence";
import kinship from "./kinship";
import lineage from "./lineage";
import lineageSelection from "./lineage-selection";
import lineageStanding from "./lineage-standing";
import locations from "./locations";
import networkGraph from "./network-graph";
import nowPlaying from "./now-playing";
import rankings from "./rankings";
import reception from "./reception";
import reliability from "./reliability";
import search from "./search";
import sentences from "./sentences";
import sourcesAndIdentity from "./sources-and-identity";
import strongMisreadings from "./strong-misreadings";
import takescore from "./takescore";
import takescoreDimensions from "./takescore-dimensions";
import tiers from "./tiers";
import tropes from "./tropes";
import whatAiDoes from "./what-ai-does";
import whatTakescoreIgnores from "./what-takescore-ignores";
import whereToStart from "./where-to-start";
import whereToWatch from "./where-to-watch";
import whyAFilmIsInTheIndex from "./why-a-film-is-in-the-index";
import botsAndCrawlers from "./bots-and-crawlers";
import collaborate from "./collaborate";
import importDoc from "./import";
import metatakeTv from "./metatake-tv";
import myFilms from "./my-films";
import myRoom from "./my-room";
import saveAndShare from "./save-and-share";
import sourcesWeMonitor from "./sources-we-monitor";
import theDaily from "./the-daily";
import theoryExplorer from "./theory-explorer";
import openData from "./open-data";
import api from "./api";
import mcp from "./mcp";

export const DOC_BODIES: Record<string, string> = {
  "ai-disclosure": aiDisclosure,
  "corpus-growth": corpusGrowth,
  corrections,
  counterpoints,
  credits,
  "editorial-responsibility": editorialResponsibility,
  "embedding-map": embeddingMap,
  essays,
  figures,
  "film-selection": filmSelection,
  frameworks,
  "how-a-page-is-made": howAPageIsMade,
  independence,
  kinship,
  lineage,
  "lineage-selection": lineageSelection,
  "lineage-standing": lineageStanding,
  locations,
  "network-graph": networkGraph,
  "now-playing": nowPlaying,
  rankings,
  reception,
  reliability,
  search,
  sentences,
  "sources-and-identity": sourcesAndIdentity,
  "strong-misreadings": strongMisreadings,
  takescore,
  "takescore-dimensions": takescoreDimensions,
  tiers,
  tropes,
  "what-ai-does": whatAiDoes,
  "what-takescore-ignores": whatTakescoreIgnores,
  "where-to-start": whereToStart,
  "where-to-watch": whereToWatch,
  "why-a-film-is-in-the-index": whyAFilmIsInTheIndex,
  "bots-and-crawlers": botsAndCrawlers,
  collaborate,
  import: importDoc,
  "metatake-tv": metatakeTv,
  "my-films": myFilms,
  "my-room": myRoom,
  "save-and-share": saveAndShare,
  "sources-we-monitor": sourcesWeMonitor,
  "the-daily": theDaily,
  "theory-explorer": theoryExplorer,
  "open-data": openData,
  api,
  mcp,
};
