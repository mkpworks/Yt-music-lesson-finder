# YT Music Lesson Finder

A static catalog of online music lessons on YouTube. Lessons can be searched and grouped by channel, instrument, style, tradition, topic, structure, and level. Search matches the channel, teacher, title, style, tradition, topics, instrument, series, and description, ignoring case and accents. Choosing a channel name, teacher, series, or "in the style of" artist fills the search.

Published with GitHub Pages at <https://mkpworks.github.io/Yt-music-lesson-finder/>.

## Preview locally

From the repository root:

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>. The page loads JSON with `fetch`, so opening `index.html` directly from disk will not work.

To build the embed and the catalog files the same way Pages does:

```bash
node scripts/export-csv.js
node scripts/build-catalog.js
node scripts/build-embed.js
```

`data/catalog.csv`, `data/catalog.json`, `data/version.json`, and `embed.js` are build outputs and are gitignored.

## Add a lesson

Append an object to `data/lessons.json`. The researched catalog is not in this repo yet, so the file ships as an empty array. Keep it empty until each video has been checked.

```json
{
  "id": "xxxxxxxxxxx",
  "youtube_url": "https://www.youtube.com/watch?v=xxxxxxxxxxx",
  "title": "Lesson title",
  "channel_name": "Channel name",
  "channel_id": "UCxxxxxxxxxxxxxxxxxxxxxx",
  "channel_url": "https://www.youtube.com/@channel",
  "teacher": "Teacher name",
  "year": 0,
  "duration_seconds": 600,
  "style": "blues",
  "in_the_style_of": "Buddy Guy",
  "tradition": "western",
  "topics": ["technique"],
  "instrument": "guitar",
  "structure": "casual",
  "level": "beginner",
  "series": "Grade 1",
  "description": "What the lesson covers.",
  "ytmusictrainer_url": "https://ytmusictrainer.com/?video_id=xxxxxxxxxxx"
}
```

- `id` is the 11-character YouTube id and has to be unique.
- `year` is `0` when the title and description do not state one.
- `tradition` is optional. Omit the key when the lesson has no tradition.
- `in_the_style_of`, `series`, and `description` are optional.
- `structure` is `structured` or `casual`. `level` is `beginner`, `intermediate`, or `advanced`.
- Instrument and tradition values have to be listed in `data/facets.json` while those lists are non-empty. `general` is the instrument for theory-first lessons. `production/DAW` is the instrument for DAW software such as Ableton Live and for EDM beat-making. `voice` is for singing. `level` may be omitted when the lesson does not state one.

See `SCHEMA.md` for the full field list.

## Facets

`data/facets.json` supplies the filter vocabularies. The finder reads it when the file is present and does not keep its own copy of the instrument or tradition lists. A missing file, or an empty list, means that dimension is taken from the lessons themselves.

The catalog lists are:

- instruments: general, guitar, production/DAW, synthesizer, drums, piano, saxophone, bass, mallets, organ, voice
- traditions: western, indian-hindustani, west-african, arabic-maqam, flamenco, microtonal, brazilian, latin-caribbean, indian-carnatic
- topics: technique, theory, song-tutorial, improvisation, sound-design, rhythm-groove, chords, practice, gear-tone, scales, ear-training, reading, songwriting

`styles` and `in_the_style_of` start empty, so the first lessons can introduce those values. Once a list is non-empty, new values have to be added there too.

## Spreadsheet

**Download this list**, in the toolbar, saves the lessons that match the current search and filters. The rows follow the current sort, one lesson per row. With the filters cleared, that file is the whole catalog.

The Pages build also writes `data/catalog.csv`, the full catalog in channel order, as UTF-8 with a byte-order mark. The footer link **Download full spreadsheet** points at that file.

```bash
node scripts/export-csv.js
```

Columns are id, title, channel name and id and URL, teacher, year (blank when unknown), duration in seconds and as `h:mm:ss`, style, in the style of, tradition (blank when omitted), topics joined with `; `, instrument, structure, level, series, description, the YouTube URL, and `ytmusictrainer_url`. Every lesson row links to YouTube and to YT Trainer. The trainer base URL lives in `YT_TRAINER_BASE` in `js/catalog.js`.

## Embedding and data API

This contract is stable. The schema version is `"1"`. A later version will bump that string when the catalog shape changes. `generated_at` changes on every deploy and is only a cache key.

Other sites load the finder from this repository. They do not copy the catalog.

```html
<div id="lesson-finder"></div>
<script src="https://mkpworks.github.io/Yt-music-lesson-finder/embed.js" defer></script>
```

`embed.js` is published at the site root. It mounts `#lesson-finder` and any element with `data-lesson-finder`. The same call is `LessonFinder.mount(element, options)`.

| Attribute or option | Values | Default |
| --- | --- | --- |
| `data-theme` / `theme` | `light` or `dark` | Follows `prefers-color-scheme` |
| `data-accent` / `accent` | `#rgb` or `#rrggbb` | The finder gold |
| `data-height` / `height` | CSS length, or a number of pixels | Natural height |
| `data-channel` / `channel` | Channel id or channel name | No channel filter |
| `data-instrument` / `instrument` | An instrument slug from the facet list | No instrument filter |
| `data-style` / `style` | A style string | No style filter |
| `data-tradition` / `tradition` | A tradition slug from the facet list | No tradition filter |
| `data-topic` / `topic` | A topic name | No topic filter |
| `data-structure` / `structure` | `structured` or `casual` | No structure filter |
| `data-level` / `level` | `beginner`, `intermediate`, or `advanced` | No level filter |
| `data-in-the-style-of` / `inTheStyleOf` | An artist name | No artist filter |

The widget renders in a shadow root, so its CSS does not leak in or out. Search, filters, sort, channel groups, and the lesson cards are the same finder as this site. A thumbnail plays inline from `youtube-nocookie.com`. **View on YouTube** opens in a new tab. **Open on YT Trainer** opens in a new tab, and in the same tab when the page hosting the finder is `ytmusictrainer.com` or a subdomain such as `www`. Any other link to that site follows the same rule. **Download this list** exports the filtered rows. A **Powered by YT Music Lesson Finder** link points back here.

`embed-demo.html` on this site shows the snippet and a live embed. Build `embed.js` before opening that page locally.

### Catalog files

`data/lessons.json` and `data/facets.json` stay the source files the main page loads. If `facets.json` is missing, the page continues with an empty vocabulary.

The Pages build also writes these two files. `embed.js` fetches `data/version.json` with a cache-busting query (`cache: "no-store"` plus a timestamp), then fetches `data/catalog.json?v=<generated_at>`. GitHub Pages caches files for about 10 minutes. The version query changes when the site is rebuilt, so a new catalog shows up on the next page load.

`data/version.json`:

```json
{ "version": "1", "generated_at": "2026-11-23T00:00:00.000Z" }
```

`data/catalog.json` carries `version`, `generated_at`, `lessons`, and `facets`. Item fields are the ones in `SCHEMA.md`. Do not depend on key order. Unknown fields on an item may appear later and should be ignored. GitHub Pages sends `Access-Control-Allow-Origin: *` on these JSON files, which is what a page on another origin needs in order to `fetch` them.

## Check the data

```bash
node scripts/validate-data.js
node scripts/check-catalog.js
```

Validation requires unique YouTube ids, the required lesson fields, and facet membership when a facet list is non-empty. The Pages workflow runs the same checks before it deploys.

## Deploy

Pushes to `main` run `.github/workflows/pages.yml`, which checks the data, builds the catalog, CSV, and `embed.js`, and deploys with `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages`. Pull requests run the same check and build, and skip `actions/configure-pages`, because that action looks up the Pages site and fails until the source above is set.

The repository owner has to set **Settings → Pages → Build and deployment → Source** to **GitHub Actions** before the first deploy can succeed.
