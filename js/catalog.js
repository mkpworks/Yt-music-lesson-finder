"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Catalog = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PER_PAGE = 12;
  const SCHEMA_VERSION = "1";
  const STRUCTURES = ["structured", "casual"];
  const LEVELS = ["beginner", "intermediate", "advanced"];
  const YT_TRAINER_BASE = "https://ytmusictrainer.com/?video_id=";
  const MODES = ["channel", "instrument", "style", "styleOf", "tradition", "topic", "structure", "level", "list"];

  function compareNames(a, b) {
    return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
  }

  function fold(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function isSlug(value) {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value || ""));
  }

function labelOf(value) {
  const text = String(value || "");
  if (!text) return "";
  if (isSlug(text)) {
    return text.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
  if (text === text.toLowerCase()) {
    return text.split(" ").map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part)).join(" ");
  }
  return text;
}

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return hours + ":" + String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }

  function yearKey(year) {
    return year || 9999;
  }

  function listOf(value) {
    if (!Array.isArray(value)) return [];
    const out = [];
    const seen = new Set();
    for (const item of value) {
      if (typeof item !== "string") continue;
      const text = item.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
    return out;
  }

  function noteMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out = {};
    for (const key of Object.keys(value)) {
      if (typeof value[key] === "string" && value[key].trim()) out[key] = value[key].trim();
    }
    return out;
  }

  // Instrument, tradition, and the other vocabularies come from facets.json when it is present.
  function normalizeFacets(facets) {
    const source = facets && typeof facets === "object" && !Array.isArray(facets) ? facets : {};
    const notes = source.notes && typeof source.notes === "object" && !Array.isArray(source.notes) ? source.notes : {};
    return {
      instruments: listOf(source.instruments),
      traditions: listOf(source.traditions),
      styles: listOf(source.styles),
      topics: listOf(source.topics),
      structures: listOf(source.structures),
      levels: listOf(source.levels),
      in_the_style_of: listOf(source.in_the_style_of),
      notes: {
        instruments: noteMap(notes.instruments),
        traditions: noteMap(notes.traditions),
      },
    };
  }

  function orderedUnion(preferred, extra) {
    const out = [];
    const seen = new Set();
    for (const item of preferred) {
      if (!item || seen.has(item)) continue;
      seen.add(item);
      out.push(item);
    }
    const rest = [];
    for (const item of extra) {
      if (!item || seen.has(item)) continue;
      seen.add(item);
      rest.push(item);
    }
    rest.sort(compareNames);
    return out.concat(rest);
  }

  function textOf(lesson, field) {
    const value = lesson && lesson[field];
    return typeof value === "string" ? value.trim() : "";
  }

  function topicsOf(lesson) {
    return listOf(lesson && lesson.topics);
  }

  function traditionOf(lesson) {
    return textOf(lesson, "tradition");
  }

  function styleOfArtist(lesson) {
    return textOf(lesson, "in_the_style_of");
  }

  function seriesOf(lesson) {
    return textOf(lesson, "series");
  }

  function descriptionOf(lesson) {
    return textOf(lesson, "description");
  }

  function trainerUrl(id) {
    return YT_TRAINER_BASE + encodeURIComponent(id || "");
  }

  function videoIdFromUrl(value) {
    let url;
    try {
      url = new URL(String(value || ""));
    } catch (error) {
      return "";
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (url.pathname === "/watch" || parts[0] === "watch") return url.searchParams.get("v") || "";
      if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") return parts[1] || "";
    }
    return "";
  }

  function channelUrlOk(value, channelId) {
    let url;
    try {
      url = new URL(String(value || ""));
    } catch (error) {
      return false;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "youtube.com" && host !== "m.youtube.com") return false;
    const parts = url.pathname.split("/").filter(Boolean);
    if (!parts.length) return false;
    if (parts[0] === "channel") return parts[1] === channelId;
    if (parts[0] === "c" || parts[0] === "user") return Boolean(parts[1]);
    if (parts[0].charAt(0) === "@") return parts[0].length > 1;
    return false;
  }

  function youtubeUrl(lesson) {
    const stored = lesson && lesson.youtube_url;
    if (typeof stored === "string" && videoIdFromUrl(stored)) return stored;
    const id = lesson && lesson.id ? lesson.id : "";
    return "https://www.youtube.com/watch?v=" + encodeURIComponent(id);
  }

  function safeHttpUrl(value, fallback) {
    try {
      const url = new URL(String(value || ""));
      if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    } catch (error) {}
    return fallback;
  }

  function countValues(items, getValues) {
    const counts = {};
    for (const lesson of items) {
      const values = getValues(lesson);
      const seen = new Set(Array.isArray(values) ? values : [values]);
      for (const value of seen) {
        if (!value) continue;
        counts[value] = (counts[value] || 0) + 1;
      }
    }
    return counts;
  }

  function buildIndex(lessons, facets) {
    const items = Array.isArray(lessons) ? lessons : [];
    const facet = normalizeFacets(facets);
    const channelById = {};
    const channels = [];
    for (const lesson of items) {
      const id = lesson && lesson.channel_id;
      if (!id || channelById[id]) continue;
      channelById[id] = {
        channel_id: id,
        channel_name: textOf(lesson, "channel_name") || id,
        channel_url: textOf(lesson, "channel_url"),
      };
      channels.push(channelById[id]);
    }
    channels.sort((a, b) => compareNames(a.channel_name, b.channel_name) || compareNames(a.channel_id, b.channel_id));
    const structures = orderedUnion(facet.structures.length ? facet.structures : STRUCTURES, items.map((lesson) => textOf(lesson, "structure")));
    const levels = orderedUnion(facet.levels.length ? facet.levels : LEVELS, items.map((lesson) => textOf(lesson, "level")));
    return {
      lessons: items,
      facets: facet,
      notes: facet.notes,
      channels,
      channelById,
      channelCount: countValues(items, (lesson) => textOf(lesson, "channel_id")),
      instruments: orderedUnion(facet.instruments, items.map((lesson) => textOf(lesson, "instrument"))),
      traditions: orderedUnion(facet.traditions, items.map(traditionOf)),
      styles: orderedUnion(facet.styles, items.map((lesson) => textOf(lesson, "style"))),
      topics: orderedUnion(facet.topics, items.flatMap(topicsOf)),
      structures,
      levels,
      styleArtists: orderedUnion(facet.in_the_style_of, items.map(styleOfArtist)),
      instrumentCount: countValues(items, (lesson) => textOf(lesson, "instrument")),
      traditionCount: countValues(items, traditionOf),
      topicCount: countValues(items, topicsOf),
      styleCount: countValues(items, (lesson) => textOf(lesson, "style")),
      styleArtistCount: countValues(items, styleOfArtist),
    };
  }

  function facetNote(index, group, value) {
    if (!index || !value || value === "All") return "";
    const notes = index.notes && index.notes[group];
    return notes && notes[value] ? notes[value] : "";
  }

  function matches(lesson, filters, index) {
    const source = filters || {};
    const channel = source.channel || "All";
    const instrument = source.instrument || "All";
    const style = source.style || "All";
    const tradition = source.tradition || "All";
    const topic = source.topic || "All";
    const structure = source.structure || "All";
    const level = source.level || "All";
    const styleArtist = source.inTheStyleOf || source.in_the_style_of || "All";
    const query = fold(source.query || "").trim();
    if (channel !== "All" && lesson.channel_id !== channel && fold(lesson.channel_name) !== fold(channel)) return false;
    if (instrument !== "All" && lesson.instrument !== instrument) return false;
    if (style !== "All" && lesson.style !== style) return false;
    if (tradition !== "All" && traditionOf(lesson) !== tradition) return false;
    if (topic !== "All" && !topicsOf(lesson).includes(topic)) return false;
    if (structure !== "All" && lesson.structure !== structure) return false;
    if (level !== "All" && lesson.level !== level) return false;
    if (styleArtist !== "All" && fold(styleOfArtist(lesson)) !== fold(styleArtist)) return false;
    if (query) {
      const haystack = [
        lesson.title,
        lesson.channel_name,
        lesson.teacher,
        lesson.style,
        styleOfArtist(lesson),
        traditionOf(lesson),
        labelOf(traditionOf(lesson)),
        lesson.instrument,
        labelOf(lesson.instrument),
        lesson.structure,
        labelOf(lesson.structure),
        lesson.level,
        labelOf(lesson.level),
        seriesOf(lesson),
        descriptionOf(lesson),
        topicsOf(lesson).join(" "),
        topicsOf(lesson).map(labelOf).join(" "),
        lesson.year ? String(lesson.year) : "",
      ].join(" ");
      if (!fold(haystack).includes(query)) return false;
    }
    return true;
  }

  function sortLessons(list, sort) {
    const copy = list.slice();
    copy.sort((a, b) => {
      if (sort === "year") {
        return yearKey(a.year) - yearKey(b.year) || compareNames(a.channel_name, b.channel_name) || compareNames(a.title, b.title);
      }
      if (sort === "time") {
        return (b.duration_seconds || 0) - (a.duration_seconds || 0) || compareNames(a.channel_name, b.channel_name) || compareNames(a.title, b.title);
      }
      return compareNames(a.channel_name, b.channel_name) || compareNames(a.title, b.title) || yearKey(a.year) - yearKey(b.year);
    });
    return copy;
  }

  function groupLabel(key, mode, index) {
    if (mode === "channel") {
      const channel = index && index.channelById && index.channelById[key];
      return channel ? channel.channel_name : key;
    }
    if (mode === "style" || mode === "styleOf") return key;
    return labelOf(key);
  }

  function orderFor(mode, index) {
    if (!index) return [];
    if (mode === "instrument") return index.instruments;
    if (mode === "tradition") return index.traditions;
    if (mode === "topic") return index.topics;
    if (mode === "structure") return index.structures;
    if (mode === "level") return index.levels;
    if (mode === "style") return index.styles;
    return [];
  }

  function groupKeys(lesson, mode) {
    if (mode === "channel") return lesson.channel_id ? [lesson.channel_id] : [];
    if (mode === "instrument") return textOf(lesson, "instrument") ? [lesson.instrument] : [];
    if (mode === "style") return textOf(lesson, "style") ? [lesson.style] : [];
    if (mode === "styleOf") return styleOfArtist(lesson) ? [styleOfArtist(lesson)] : [];
    if (mode === "tradition") return traditionOf(lesson) ? [traditionOf(lesson)] : [];
    if (mode === "topic") return topicsOf(lesson);
    if (mode === "structure") return textOf(lesson, "structure") ? [lesson.structure] : [];
    if (mode === "level") return textOf(lesson, "level") ? [lesson.level] : [];
    return [];
  }

  function groupLessons(rows, mode, sort, options) {
    if (mode === "list") return [];
    const index = options && options.index;
    const map = new Map();
    for (const lesson of rows) {
      for (const key of new Set(groupKeys(lesson, mode))) {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(lesson);
      }
    }
    const keys = [...map.keys()];
    keys.sort((a, b) => {
      const left = map.get(a);
      const right = map.get(b);
      if (sort === "time") {
        const leftSeconds = left.reduce((sum, lesson) => sum + (lesson.duration_seconds || 0), 0);
        const rightSeconds = right.reduce((sum, lesson) => sum + (lesson.duration_seconds || 0), 0);
        return rightSeconds - leftSeconds || compareNames(groupLabel(a, mode, index), groupLabel(b, mode, index));
      }
      if (sort === "year") {
        const leftYear = Math.min(...left.map((lesson) => yearKey(lesson.year)));
        const rightYear = Math.min(...right.map((lesson) => yearKey(lesson.year)));
        return leftYear - rightYear || compareNames(groupLabel(a, mode, index), groupLabel(b, mode, index));
      }
      const order = orderFor(mode, index);
      if (order.length && mode !== "channel" && mode !== "styleOf") {
        const leftAt = order.indexOf(a);
        const rightAt = order.indexOf(b);
        const leftRank = leftAt === -1 ? order.length : leftAt;
        const rightRank = rightAt === -1 ? order.length : rightAt;
        return leftRank - rightRank || compareNames(groupLabel(a, mode, index), groupLabel(b, mode, index));
      }
      return compareNames(groupLabel(a, mode, index), groupLabel(b, mode, index));
    });
    return keys.map((key) => {
      const items = map.get(key);
      return {
        key,
        label: groupLabel(key, mode, index),
        items,
        count: items.length,
        seconds: items.reduce((sum, lesson) => sum + (lesson.duration_seconds || 0), 0),
      };
    });
  }

  function related(lesson, lessons, limit) {
    const max = limit || 5;
    return (lessons || [])
      .filter((other) => other && other.id !== lesson.id)
      .map((other) => {
        let score = 0;
        const sharedTopics = topicsOf(other).filter((topic) => topicsOf(lesson).includes(topic));
        if (other.channel_id && other.channel_id === lesson.channel_id) score += 5;
        if (traditionOf(other) && traditionOf(other) === traditionOf(lesson)) score += 3;
        if (styleOfArtist(other) && fold(styleOfArtist(other)) === fold(styleOfArtist(lesson))) score += 3;
        if (other.style && other.style === lesson.style) score += 2;
        if (other.instrument && other.instrument === lesson.instrument) score += 2;
        score += sharedTopics.length;
        return { lesson: other, score, sharedTopics };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || compareNames(a.lesson.channel_name, b.lesson.channel_name) || compareNames(a.lesson.title, b.lesson.title))
      .slice(0, max);
  }

  function relatedReason(item, lesson) {
    const other = item.lesson;
    if (other.channel_id && other.channel_id === lesson.channel_id) return "Same channel: " + other.channel_name;
    if (styleOfArtist(other) && fold(styleOfArtist(other)) === fold(styleOfArtist(lesson))) return "In the style of " + styleOfArtist(other);
    if (traditionOf(other) && traditionOf(other) === traditionOf(lesson)) return "Same tradition: " + labelOf(traditionOf(other));
    if (other.style && other.style === lesson.style) return "Same style: " + other.style;
    if (other.instrument && other.instrument === lesson.instrument) return "Same instrument: " + labelOf(other.instrument);
    if (item.sharedTopics.length) return "Shared topics: " + item.sharedTopics.map(labelOf).join(", ");
    return "";
  }

  function appearances(query, items) {
    const needle = fold(query).trim();
    if (needle.length < 2) return [];
    const map = new Map();
    function add(name, place) {
      if (!name || !fold(name).includes(needle)) return;
      if (!map.has(name)) map.set(name, new Set());
      if (place) map.get(name).add(place);
    }
    for (const lesson of items || []) {
      const place = lesson.channel_name || "";
      add(lesson.channel_name, place);
      if (fold(lesson.teacher) !== fold(lesson.channel_name)) add(lesson.teacher, place);
      add(styleOfArtist(lesson), place);
      add(seriesOf(lesson), place);
    }
    return [...map.entries()]
      .map(([name, places]) => ({ name, acts: [...places].sort(compareNames) }))
      .sort((a, b) => b.acts.length - a.acts.length || compareNames(a.name, b.name));
  }

  function pageCount(total) {
    return Math.max(1, Math.ceil(total / PER_PAGE));
  }

  const CSV_HEADERS = [
    "id",
    "title",
    "channel_name",
    "channel_id",
    "channel_url",
    "teacher",
    "year",
    "duration_seconds",
    "duration",
    "style",
    "in_the_style_of",
    "tradition",
    "topics",
    "instrument",
    "structure",
    "level",
    "series",
    "description",
    "youtube_url",
    "ytmusictrainer_url",
  ];

  function csvField(value) {
    const text = value == null ? "" : String(value);
    if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function csvRow(lesson) {
    const seconds = Math.max(0, Math.floor(Number(lesson && lesson.duration_seconds) || 0));
    const values = [
      (lesson && lesson.id) || "",
      (lesson && lesson.title) || "",
      (lesson && lesson.channel_name) || "",
      (lesson && lesson.channel_id) || "",
      (lesson && lesson.channel_url) || "",
      (lesson && lesson.teacher) || "",
      lesson && lesson.year ? String(lesson.year) : "",
      String(seconds),
      formatDuration(seconds),
      (lesson && lesson.style) || "",
      styleOfArtist(lesson),
      traditionOf(lesson),
      topicsOf(lesson).join("; "),
      (lesson && lesson.instrument) || "",
      (lesson && lesson.structure) || "",
      (lesson && lesson.level) || "",
      seriesOf(lesson),
      descriptionOf(lesson),
      youtubeUrl(lesson),
      trainerUrl(lesson && lesson.id),
    ];
    return values.map(csvField).join(",");
  }

  function toCsv(items) {
    const lines = [CSV_HEADERS.join(",")];
    for (const lesson of items || []) lines.push(csvRow(lesson));
    return "\uFEFF" + lines.join("\r\n") + "\r\n";
  }

  return {
    PER_PAGE,
    SCHEMA_VERSION,
    STRUCTURES,
    LEVELS,
    MODES,
    CSV_HEADERS,
    YT_TRAINER_BASE,
    compareNames,
    fold,
    isSlug,
    labelOf,
    formatDuration,
    yearKey,
    normalizeFacets,
    topicsOf,
    traditionOf,
    styleOfArtist,
    seriesOf,
    descriptionOf,
    trainerUrl,
    videoIdFromUrl,
    channelUrlOk,
    youtubeUrl,
    safeHttpUrl,
    buildIndex,
    facetNote,
    matches,
    sortLessons,
    groupLessons,
    related,
    relatedReason,
    appearances,
    pageCount,
    toCsv,
  };
});
