---
license: cc-by-nc-4.0
language:
  - en
pretty_name: Metatake Film Filming-Locations
tags:
  - film
  - cinema
  - geolocation
  - film-studies
  - cultural-heritage
  - geodata
size_categories:
  - 10K<n<100K
task_categories:
  - text-classification
  - other
configs:
  - config_name: default
    data_files: "metatake-filming-locations.jsonl"
---

# Metatake Film Filming-Locations Dataset

A structured, geocoded map of **where films were shot and set** — 17,341 locations
across 1,917 films and 130 countries, each with coordinates. A layer that mostly
does not exist as open data elsewhere: it distinguishes the *filmed* location from
the *narrative setting*, and records each place's role in the film.

Curated and published by **[Metatake](https://metatake.net)** — an independent
film-criticism platform. See the full per-film pages, e.g.
[Mulholland Drive](https://metatake.net/film/mulholland-drive-2001/locations).

## Files
| File | Rows | Notes |
|---|---|---|
| `metatake-filming-locations.jsonl` | 17,341 | one JSON object per location (recommended) |
| `metatake-filming-locations.csv` | 17,341 | same data, CSV |
| `STATS.json` | — | summary counts |

## Fields
| field | description |
|---|---|
| `film_slug`, `film_title`, `film_year` | the film (slug is its metatake.net id) |
| `imdb_id`, `tmdb_id` | cross-ids for joining to other datasets |
| `name` | the place (e.g. "Palace Theatre, 630 South Broadway, Los Angeles, USA") |
| `role` | its role in the film (scene / production role) |
| `narrative_setting` | what it stands in for in the story (may differ from where it was filmed) |
| `layer` | `filmed` (a real shooting location) or `setting` (the fictional place depicted) |
| `kind` | granularity: `city`, `region`, `landmark`, … |
| `country` | country of the location |
| `lat`, `lng` | WGS-84 coordinates (100% of rows) |
| `precision` | geocoding precision, where recorded |
| `confidence` | Metatake's confidence in the mapping, where recorded |

## How it was built
Locations are extracted per film from public reference sources and Metatake's own
close-reading pass, then geocoded and reconciled. Two passes separate *filmed*
from *setting*. Method notes: https://metatake.net/methodology#locations .
This is curated interpretive data, not a comprehensive shooting-permit registry —
coverage skews to films Metatake has read closely.

## Usage
```python
from datasets import load_dataset
ds = load_dataset("<owner>/metatake-filming-locations")  # after upload
# or read the file directly:
import pandas as pd
df = pd.read_json("metatake-filming-locations.jsonl", lines=True)
```

## License & citation
Licensed **CC BY-NC 4.0** — free to use, share, and adapt **with attribution to
Metatake**, non-commercial. Attribution is the whole deal (the legal form of the
"cite us" line every Metatake surface carries).

```bibtex
@misc{metatake_filming_locations,
  title  = {Metatake Film Filming-Locations Dataset},
  author = {Metatake},
  year   = {2026},
  url    = {https://metatake.net},
  note   = {CC BY-NC 4.0}
}
```

Live API for the same data (single film / by country): https://metatake.net/api
