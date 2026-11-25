"use strict";

const fs = require("fs");
const path = require("path");
const Catalog = require("../js/catalog.js");

const root = path.join(__dirname, "..");
const outDir = path.resolve(process.argv[2] || path.join(root, "data"));
const lessons = JSON.parse(fs.readFileSync(path.join(root, "data", "lessons.json"), "utf8"));
const facetPath = path.join(root, "data", "facets.json");
const facets = fs.existsSync(facetPath) ? JSON.parse(fs.readFileSync(facetPath, "utf8")) : {};
const generatedAt = new Date().toISOString();
const packed = Catalog.packLessons(lessons);
const catalog = Object.assign({
  version: Catalog.SCHEMA_VERSION,
  generated_at: generatedAt,
  packing: "rows",
  facets,
}, packed);
const version = {
  version: Catalog.SCHEMA_VERSION,
  generated_at: generatedAt,
  lessons: lessons.length,
};

const shardDir = path.join(outDir, "shards");
fs.rmSync(shardDir, { recursive: true, force: true });
fs.mkdirSync(shardDir, { recursive: true });
const shards = {};
for (const lesson of lessons) {
  const slug = Catalog.disciplineSlug(lesson.discipline);
  if (!shards[slug]) shards[slug] = {};
  if (lesson.description) shards[slug][lesson.id] = lesson.description;
}
for (const slug of Object.keys(shards)) {
  fs.writeFileSync(path.join(shardDir, slug + ".json"), JSON.stringify(shards[slug]));
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "catalog.json"), JSON.stringify(catalog));
fs.writeFileSync(path.join(outDir, "version.json"), JSON.stringify(version));
console.log("Wrote catalog v" + Catalog.SCHEMA_VERSION + " (" + lessons.length + " lessons, " + Object.keys(shards).length + " shards) to " + outDir);
