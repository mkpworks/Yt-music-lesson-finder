# YT Music Lesson Finder data schema (v1)

`data/lessons.json` is the catalog. `data/facets.json` is the vocabulary for filters. The page and the embed read instrument and tradition values from `facets.json` when that file is present. They are not hardcoded in the scripts.

An empty `lessons.json` array is valid. Add a lesson only when the YouTube id, channel id, duration, and title have been checked against the video itself. Use `0` for `year` when the year is not stated in the title or description. Do not infer a year from the upload date.

## Files

- `lessons.json` — array of lesson objects.
- `facets.json` — optional vocabulary. When a list in this file is non-empty, lesson values for that field must use it. When the list is missing or empty, the field stays open (a slug for `instrument` and `tradition`, a short name for the others) and the page builds the filter from the lessons.

The Pages build writes `data/catalog.json` and `data/version.json`. Those files are the stable data API. Do not edit them by hand.

`data/catalog.json` (version `"1"`):

| Field | Meaning |
| --- | --- |
| `version` | Schema version. Currently `"1"`. |
| `generated_at` | ISO-8601 timestamp from the build that wrote the file. Cache key only. |
| `lessons` | The same array as `data/lessons.json`. |
| `facets` | The same object as `data/facets.json`, or `{}` when that file is absent. |

## Lesson fields

Required on every lesson:

| Field | Meaning |
| --- | --- |
| `id` | 11-character YouTube video id. Unique across the catalog. |
| `youtube_url` | A YouTube URL whose video id is `id`. `watch`, `youtu.be`, `embed`, and `shorts` URLs are accepted. |
| `title` | Video title. |
| `channel_name` | YouTube channel name. Clicking it in the finder fills the search. |
| `channel_id` | YouTube channel id, `UC` plus 22 characters. |
| `channel_url` | `https://www.youtube.com/channel/<channel_id>`, or a `/@handle`, `/c/`, or `/user/` URL on YouTube. |
| `teacher` | Teacher name. Often the same as `channel_name`. |
| `year` | Year from the title or description. `0` if unknown. |
| `duration_seconds` | Running time in seconds, from 1 through 86400. |
| `style` | Broad style, such as blues or rock. |
| `topics` | Non-empty array of topic names, such as technique, theory, or song tutorial. A lesson can have more than one. |
| `instrument` | One slug. The current vocabulary lives in `facets.json`. |
| `structure` | `structured` (a course or series) or `casual`. |
| `level` | `beginner`, `intermediate`, or `advanced`. |
| `ytmusictrainer_url` | `https://ytmusictrainer.com/?video_id=<id>`. |

Optional:

| Field | Meaning |
| --- | --- |
| `in_the_style_of` | An artist the lesson is in the style of, such as Buddy Guy. Omit it when that does not apply. |
| `tradition` | A tradition slug. Omit it when the lesson is not filed under one. |
| `series` | Course or series name. |
| `description` | Short description. Newlines are allowed. |

Unknown fields are ignored.

### Instrument

`facets.json` `instruments` is the allow-list when it is non-empty. The seed list is guitar, piano, bass, drums, saxophone, synthesizer, mallets, organ, production, and theory.

- `theory` is for lessons that are not tied to one instrument.
- `production` is for DAW software such as Ableton Live and for EDM beat-making.

Labels in the page are the slug with each word capitalized. `west-african` is not an instrument; traditions use that shape. Notes for individual instruments can live in `facets.notes.instruments` and are shown when that instrument filter is selected.

### Tradition

`tradition` is optional. `facets.json` `traditions` is the allow-list when it is non-empty. The seed list is western, jazz, indian-hindustani, indian-carnatic, arabic-maqam, microtonal, west-african, flamenco, and brazilian.

Lessons with no `tradition` still appear in every other view. The Tradition browse hides them, and the filter for one tradition does not match them.

## Facets

```json
{
  "instruments": ["guitar", "theory"],
  "traditions": ["jazz"],
  "styles": [],
  "topics": ["technique", "theory", "song tutorial"],
  "structures": ["structured", "casual"],
  "levels": ["beginner", "intermediate", "advanced"],
  "in_the_style_of": [],
  "notes": {
    "instruments": {
      "theory": "Instrument-agnostic theory lessons."
    }
  }
}
```

`structures` and `levels` stay the closed sets above. `styles`, `topics`, and `in_the_style_of` accept any short name when their list is empty. Add a value to the list before using it once the list is non-empty.

## Validation

```bash
node scripts/validate-data.js
node scripts/check-catalog.js
```

`validate-data.js` checks ids, URLs, the closed structure and level sets, and membership in any non-empty facet list. The Pages workflow runs the same checks before it deploys.
