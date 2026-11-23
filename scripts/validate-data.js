"use strict";

const fs = require("fs");
const path = require("path");
const Catalog = require("../js/catalog.js");

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;
const PHRASE_RE = /^[\p{L}\p{N}][\p{L}\p{N} '&+./:,()\-]{0,79}$/u;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value, max) {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text || text !== value || text.length > max) return false;
  if (/[\u0000-\u001f]/.test(text)) return false;
  return true;
}

function cleanDescription(value) {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text || text !== value || text.length > 5000) return false;
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) return false;
  return true;
}

function allowed(value, list, openPattern) {
  if (list && list.length) return list.includes(value);
  if (openPattern) return openPattern.test(value);
  return typeof value === "string" && value.trim() === value && value.length > 0;
}

function validateFacets(facets) {
  const errors = [];
  if (facets === undefined) return errors;
  if (!isPlainObject(facets)) {
    errors.push("facets must be an object");
    return errors;
  }
  const slugLists = ["traditions", "structures", "levels"];
  const phraseLists = ["styles", "topics", "in_the_style_of"];
  for (const key of ["instruments"].concat(slugLists, phraseLists)) {
    if (facets[key] === undefined) continue;
    if (!Array.isArray(facets[key])) {
      errors.push("facets." + key + " must be an array");
      continue;
    }
    const seen = new Set();
    facets[key].forEach((entry, index) => {
      const where = "facets." + key + "[" + index + "]";
      if (typeof entry !== "string" || !entry.trim() || entry !== entry.trim()) {
        errors.push(where + " must be a non-empty string");
        return;
      }
      if (seen.has(entry)) errors.push(where + " repeats " + entry);
      seen.add(entry);
      if (key === "instruments" && !Catalog.isInstrument(entry)) {
        errors.push(where + " must be an instrument slug");
      }
      if (slugLists.includes(key) && !Catalog.isSlug(entry)) {
        errors.push(where + " must be a lowercase slug");
      }
      if (phraseLists.includes(key) && !PHRASE_RE.test(entry)) {
        errors.push(where + " must be a short name");
      }
      if (key === "structures" && !Catalog.STRUCTURES.includes(entry)) {
        errors.push(where + " must be structured or casual");
      }
      if (key === "levels" && !Catalog.LEVELS.includes(entry)) {
        errors.push(where + " must be beginner, intermediate, or advanced");
      }
    });
  }
  if (facets.notes !== undefined) {
    if (!isPlainObject(facets.notes)) {
      errors.push("facets.notes must be an object");
    } else {
      for (const group of ["instruments", "traditions"]) {
        if (facets.notes[group] === undefined) continue;
        if (!isPlainObject(facets.notes[group])) {
          errors.push("facets.notes." + group + " must be an object");
          continue;
        }
        const known = new Set(Array.isArray(facets[group]) ? facets[group] : []);
        for (const key of Object.keys(facets.notes[group])) {
          const note = facets.notes[group][key];
          if (typeof note !== "string" || !note.trim()) {
            errors.push("facets.notes." + group + "." + key + " must be a non-empty string");
          }
          if (known.size && !known.has(key)) {
            errors.push("facets.notes." + group + "." + key + " is not in facets." + group);
          }
        }
      }
    }
  }
  return errors;
}

function validate(lessons, facets) {
  const errors = [];
  if (!Array.isArray(lessons)) {
    errors.push("lessons must be an array");
    return errors;
  }
  errors.push(...validateFacets(facets || {}));
  const facet = Catalog.normalizeFacets(facets || {});
  const seen = new Set();
  lessons.forEach((lesson, index) => {
    const where = "lessons[" + index + "]";
    if (!isPlainObject(lesson)) {
      errors.push(where + " must be an object");
      return;
    }
    if (typeof lesson.id !== "string" || !ID_RE.test(lesson.id)) {
      errors.push(where + " id must be an 11-character YouTube id");
    } else if (seen.has(lesson.id)) {
      errors.push("duplicate id " + lesson.id);
    } else {
      seen.add(lesson.id);
    }
    if (typeof lesson.youtube_url !== "string" || Catalog.videoIdFromUrl(lesson.youtube_url) !== lesson.id) {
      errors.push(where + " youtube_url must be a YouTube URL for id");
    }
    for (const field of ["title", "channel_name", "teacher"]) {
      const max = field === "title" ? 300 : 200;
      if (!cleanText(lesson[field], max)) errors.push(where + " " + field + " is required");
    }
    if (typeof lesson.channel_id !== "string" || !CHANNEL_ID_RE.test(lesson.channel_id)) {
      errors.push(where + " channel_id must be a YouTube channel id");
    } else if (!Catalog.channelUrlOk(lesson.channel_url, lesson.channel_id)) {
      errors.push(where + " channel_url must be a YouTube channel URL");
    }
    if (!Number.isInteger(lesson.year) || lesson.year < 0 || lesson.year > 2100) {
      errors.push(where + " year must be a whole number (0 if unknown)");
    }
    if (!Number.isInteger(lesson.duration_seconds) || lesson.duration_seconds <= 0 || lesson.duration_seconds > 86400) {
      errors.push(where + " duration_seconds must be a positive whole number");
    }
    if (!cleanText(lesson.style, 80) || !allowed(lesson.style, facet.styles, PHRASE_RE)) {
      errors.push(where + " style is required");
    }
    if (lesson.in_the_style_of !== undefined) {
      if (!cleanText(lesson.in_the_style_of, 80) || !allowed(lesson.in_the_style_of, facet.in_the_style_of, PHRASE_RE)) {
        errors.push(where + " in_the_style_of must be a non-empty name when present");
      }
    }
    if (lesson.tradition !== undefined) {
      if (typeof lesson.tradition !== "string" || !Catalog.isSlug(lesson.tradition) || !allowed(lesson.tradition, facet.traditions, null)) {
        errors.push(where + " tradition must be a slug from facets.traditions when that list is present");
      }
    }
    if (!Array.isArray(lesson.topics) || lesson.topics.length === 0) {
      errors.push(where + " topics must be a non-empty list");
    } else {
      const topics = new Set();
      lesson.topics.forEach((topic, topicIndex) => {
        if (!cleanText(topic, 80) || !allowed(topic, facet.topics, PHRASE_RE)) {
          errors.push(where + " topics[" + topicIndex + "] must be a topic name");
          return;
        }
        if (topics.has(topic)) errors.push(where + " topics repeats " + topic);
        topics.add(topic);
      });
    }
    if (typeof lesson.instrument !== "string" || !Catalog.isInstrument(lesson.instrument) || !allowed(lesson.instrument, facet.instruments, null)) {
      errors.push(where + " instrument must be a slug from facets.instruments when that list is present");
    }
    if (typeof lesson.structure !== "string" || !Catalog.STRUCTURES.includes(lesson.structure)) {
      errors.push(where + " structure must be structured or casual");
    } else if (facet.structures.length && !facet.structures.includes(lesson.structure)) {
      errors.push(where + " structure must be listed in facets.structures");
    }
    if (lesson.level !== undefined && (typeof lesson.level !== "string" || !Catalog.LEVELS.includes(lesson.level))) {
      errors.push(where + " level must be beginner, intermediate, or advanced when present");
    } else if (lesson.level !== undefined && facet.levels.length && !facet.levels.includes(lesson.level)) {
      errors.push(where + " level must be listed in facets.levels");
    }
    if (lesson.series !== undefined && !cleanText(lesson.series, 200)) {
      errors.push(where + " series must be a non-empty string when present");
    }
    if (lesson.description !== undefined && !cleanDescription(lesson.description)) {
      errors.push(where + " description must be a non-empty string when present");
    }
    if (lesson.ytmusictrainer_url !== Catalog.trainerUrl(lesson.id || "")) {
      errors.push(where + " ytmusictrainer_url must be " + Catalog.YT_TRAINER_BASE + "<id>");
    }
  });
  return errors;
}

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error("Could not read " + file + ": " + error.message);
  }
}

function main() {
  const root = path.join(__dirname, "..");
  const lessonFile = process.argv[2] || path.join(root, "data", "lessons.json");
  const facetFile = process.argv[3] || path.join(root, "data", "facets.json");
  let lessons;
  let facets = {};
  try {
    lessons = loadJson(lessonFile);
    if (fs.existsSync(facetFile)) facets = loadJson(facetFile);
    else if (process.argv[3]) throw new Error("Could not read " + facetFile);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const errors = validate(lessons, facets);
  if (errors.length) {
    console.error("Invalid lesson data (" + errors.length + ")");
    for (const error of errors) console.error(" - " + error);
    process.exit(1);
  }
  const facet = Catalog.normalizeFacets(facets);
  console.log(
    "OK: " + lessons.length + " lessons, " +
    facet.instruments.length + " instruments, " +
    facet.traditions.length + " traditions"
  );
}

module.exports = { validate, validateFacets };

if (require.main === module) main();
