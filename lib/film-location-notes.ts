/** Source-backed additions to five existing location guides. Dates record actual
 * editorial changes, not a dataset refresh or a request to the page. */
type FilmLocationNote = {
  updated: string;
  summary: string;
  question: string;
  answer: string;
  source: { title: string; url: string };
};

const NOTES: Record<string, FilmLocationNote> = {
  "the-piano-1993": {
    updated: "2026-09-12",
    summary: "The Piano (1993) filmed its famous beach tableau at Karekare Beach in New Zealand's Auckland region.",
    question: "Which beach holds Ada's abandoned piano?",
    answer: "Karekare Beach. Tourism New Zealand identifies this shoreline with the abandoned piano and describes how Jane Campion tells the story through New Zealand's landscapes. The beach is a specific filming location; the wider Auckland label identifies its region, not an additional beach or a separate scene.",
    source: {
      title: "Tourism New Zealand — The Piano at Karekare Beach",
      url: "https://www.newzealand.com/ca/feature/new-zealand-directors-top-10-film-locations/",
    },
  },
  "memories-of-murder-2003": {
    updated: "2026-09-12",
    summary: "Memories of Murder (2003) combines filming locations across South Korea: its quarry scene was shot in Seoul and its climactic tunnel scene near Jinju, although the story is set in Hwaseong.",
    question: "Was Memories of Murder filmed entirely in Hwaseong?",
    answer: "No. The Korean Film Council describes the cast and crew spending six months filming around the country. It places the quarry scene in Seoul and the climax at an abandoned tunnel near Jinju. Hwaseong is the setting that joins these places in the story; the film's apparent local geography was assembled from widely separated shooting locations.",
    source: {
      title: "Korean Film Council — filming the landscapes of Memories of Murder",
      url: "https://www.koreanfilm.or.kr/mobile3/news/featuresView.jsp?seq=490",
    },
  },
  "hook-1991": {
    updated: "2026-09-12",
    summary: "Hook (1991) used the Sony Pictures studio lot in Culver City, California. Sony specifically names Stage 30 among the film's shooting spaces.",
    question: "What does Sony confirm about Hook's studio filming?",
    answer: "Sony identifies Hook as a production filmed on Stage 30, a soundstage with a 90-by-100-foot water tank. This establishes a physical studio location behind the fantasy. Sony's account does not assign individual Hook scenes to that stage, so it should not be used to identify the pirate ship's exact stage or every Neverland set.",
    source: {
      title: "Sony Pictures — Culver City soundstages and Stage 30",
      url: "https://www.sonypictures.com/corp/press_releases/2019/0911",
    },
  },
  "gattaca-1997": {
    updated: "2026-09-12",
    summary: "Gattaca (1997) was partly filmed at the Marin County Civic Center in San Rafael, California, a real public building designed by Frank Lloyd Wright.",
    question: "Was Gattaca's futuristic architecture built for the film?",
    answer: "One of its key architectural locations already existed: the Marin County Civic Center opened in 1962. The county confirms that Gattaca filmed there and used the building as a futuristic setting. That makes this location an example of existing civic architecture repurposed for science fiction, rather than a purpose-built futuristic set. This does not describe every interior in the film.",
    source: {
      title: "County of Marin — Civic Center history and Gattaca filming",
      url: "https://www.marincounty.gov/news-releases/county-mark-civic-centers-60th-anniversary",
    },
  },
  "the-blair-witch-project-1999": {
    updated: "2026-09-12",
    summary: "The Blair Witch Project (1999) filmed at Seneca Creek State Park in Maryland. The state park authority documents the park's connection to the production.",
    question: "Which park is confirmed as a Blair Witch Project filming location?",
    answer: "Seneca Creek State Park. Maryland's Department of Natural Resources explicitly identifies it as a filming site in its account of a park history hike. This is evidence for the park as a whole, not the coordinates of every tree, campsite or camera position. Read the precision label on each map entry before treating a pin as an exact scene location.",
    source: {
      title: "Maryland Department of Natural Resources — Blair Witch at Seneca Creek",
      url: "https://news.maryland.gov/dnr/2018/10/25/fall-foliage-and-festival-report-oct-27-28-2018/",
    },
  },
};

export function filmLocationNote(slug: string): FilmLocationNote | undefined {
  return Object.hasOwn(NOTES, slug) ? NOTES[slug] : undefined;
}
