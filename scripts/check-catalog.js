"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const Catalog = require("../js/catalog.js");
const { validate } = require("./validate-data.js");

const root = path.join(__dirname, "..");
const lessons = JSON.parse(fs.readFileSync(path.join(root, "data", "lessons.json"), "utf8"));
const facets = JSON.parse(fs.readFileSync(path.join(root, "data", "facets.json"), "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message || "assertion failed");
}

const errors = validate(lessons, facets);
if (errors.length) {
  console.error(errors.join("\n"));
  throw new Error("seed data failed validation");
}
assert(Array.isArray(lessons), "lessons array");

const instrumentSamples = ["guitar", "piano", "bass", "drums", "saxophone", "synthesizer", "mallets", "organ", "production", "theory"];
const traditionSamples = ["western", "jazz", "indian-hindustani", "indian-carnatic", "arabic-maqam", "microtonal", "west-african", "flamenco", "brazilian"];
for (const name of instrumentSamples) assert(facets.instruments.includes(name), "facets instruments include " + name);
for (const name of traditionSamples) assert(facets.traditions.includes(name), "facets traditions include " + name);
assert(facets.notes.instruments.theory && facets.notes.instruments.production.includes("Ableton"), "instrument notes");
assert(JSON.stringify(facets.structures) === JSON.stringify(["structured", "casual"]));
assert(JSON.stringify(facets.levels) === JSON.stringify(["beginner", "intermediate", "advanced"]));

const runtimeFiles = [
  "js/catalog.js",
  "js/view.js",
  "js/embed-boot.js",
  "js/app.js",
  "scripts/validate-data.js",
  "scripts/build-catalog.js",
  "scripts/build-embed.js",
  "scripts/export-csv.js",
];
for (const file of runtimeFiles) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  for (const sample of ["synthesizer", "indian-hindustani", "arabic-maqam", "Ableton", "mallets"]) {
    assert(!text.includes(sample), file + " hardcodes " + sample);
  }
}

function channelId(fill) {
  return "UC" + String(fill).repeat(22);
}

function lesson(overrides) {
  const extra = overrides || {};
  const id = extra.id || "aaaaaaaaaaa";
  const channel = extra.channel_id || channelId("a");
  const item = Object.assign({
    id,
    youtube_url: "https://www.youtube.com/watch?v=" + id,
    title: "A lesson",
    channel_name: "Example Channel",
    channel_id: channel,
    channel_url: "https://www.youtube.com/channel/" + channel,
    teacher: "Example Teacher",
    year: 2020,
    duration_seconds: 600,
    style: "blues",
    topics: ["technique"],
    instrument: "guitar",
    structure: "casual",
    level: "beginner",
    description: "A lesson description.",
    ytmusictrainer_url: Catalog.trainerUrl(id),
  }, extra);
  if (!Object.prototype.hasOwnProperty.call(extra, "youtube_url")) item.youtube_url = "https://www.youtube.com/watch?v=" + item.id;
  if (!Object.prototype.hasOwnProperty.call(extra, "ytmusictrainer_url")) item.ytmusictrainer_url = Catalog.trainerUrl(item.id);
  if (!Object.prototype.hasOwnProperty.call(extra, "channel_url")) item.channel_url = "https://www.youtube.com/channel/" + item.channel_id;
  return item;
}

const sample = lesson({ tradition: "jazz", in_the_style_of: "Buddy Guy" });
assert(validate([sample], facets).length === 0, "a tradition lesson validates");
assert(validate([lesson()], facets).length === 0, "tradition is optional");
assert(validate([lesson({ instrument: "theory", topics: ["theory"] })], facets).length === 0, "theory instrument");
assert(validate([lesson({ instrument: "production", topics: ["technique"] })], facets).length === 0, "production instrument");
assert(validate([lesson({ instrument: "oud" })], facets).some((error) => error.includes("instrument")), "unknown instrument");
assert(validate([lesson({ tradition: "baroque" })], facets).some((error) => error.includes("tradition")), "unknown tradition");
const openFacets = { instruments: [], traditions: [], styles: [], topics: [], structures: [], levels: [], in_the_style_of: [] };
assert(validate([lesson({ instrument: "oud", tradition: "baroque", topics: ["ear training"], style: "hip-hop" })], openFacets).length === 0, "empty facet lists stay open");
const openIndex = Catalog.buildIndex([lesson({ instrument: "oud", tradition: "baroque" })], openFacets);
assert(JSON.stringify(openIndex.instruments) === JSON.stringify(["oud"]), "instruments come from the lessons when facets are empty");
assert(JSON.stringify(openIndex.traditions) === JSON.stringify(["baroque"]));
assert(!openIndex.instruments.includes("guitar") && !openIndex.instruments.includes("theory"), "no hardcoded instrument list");

const duplicate = [lesson(), lesson()];
assert(validate(duplicate, facets).some((error) => error.includes("duplicate id")), "duplicate id");
const missingTitle = lesson();
delete missingTitle.title;
assert(validate([missingTitle], facets).some((error) => error.includes("title")), "missing title");
assert(validate([lesson({ structure: "course" })], facets).some((error) => error.includes("structure")), "structure enum");
assert(validate([lesson({ level: "expert" })], facets).some((error) => error.includes("level")), "level enum");
assert(validate([lesson({ year: 0 })], facets).length === 0, "unknown year");
assert(validate([lesson({ duration_seconds: 0 })], facets).some((error) => error.includes("duration_seconds")), "duration");
assert(validate([lesson({ topics: ["technique", "technique"] })], facets).some((error) => error.includes("repeats")), "duplicate topic");
assert(validate([lesson({ youtube_url: "https://youtu.be/aaaaaaaaaaa" })], facets).length === 0, "youtu.be");
assert(validate([lesson({ youtube_url: "https://www.youtube.com/shorts/aaaaaaaaaaa" })], facets).length === 0, "shorts");
assert(validate([lesson({ youtube_url: "https://www.youtube.com/watch?v=bbbbbbbbbbb" })], facets).some((error) => error.includes("youtube_url")), "url id");
assert(validate([lesson({ channel_url: "https://www.youtube.com/@ExampleTeacher" })], facets).length === 0, "handle url");
assert(validate([lesson({ channel_url: "https://example.com/@ExampleTeacher" })], facets).some((error) => error.includes("channel_url")), "channel host");
assert(validate([lesson({ ytmusictrainer_url: "https://ytmusictrainer.com/?video_id=bbbbbbbbbbb" })], facets).some((error) => error.includes("ytmusictrainer_url")), "trainer url");
assert(validate([lesson({ series: " " })], facets).some((error) => error.includes("series")), "blank series");
assert(validate(lessons, ["guitar"]).some((error) => error.includes("object")), "facets shape");

assert(Catalog.formatDuration(0) === "0:00:00");
assert(Catalog.formatDuration(61) === "0:01:01");
assert(Catalog.formatDuration(7474) === "2:04:34");
assert(Catalog.pageCount(0) === 1);
assert(Catalog.pageCount(12) === 1);
assert(Catalog.pageCount(13) === 2);
assert(Catalog.PER_PAGE === 12);
assert(Catalog.YT_TRAINER_BASE === "https://ytmusictrainer.com/?video_id=");
assert(Catalog.trainerUrl("aaaaaaaaaaa") === "https://ytmusictrainer.com/?video_id=aaaaaaaaaaa");
assert(Catalog.labelOf("indian-hindustani") === "Indian Hindustani");
assert(Catalog.labelOf("song tutorial") === "Song Tutorial");
assert(Catalog.labelOf("Buddy Guy") === "Buddy Guy");
assert(Catalog.fold("José") === "jose");

const facetIndex = Catalog.buildIndex([], facets);
assert(JSON.stringify(facetIndex.instruments) === JSON.stringify(facets.instruments), "instrument order follows facets");
assert(JSON.stringify(facetIndex.traditions) === JSON.stringify(facets.traditions), "tradition order follows facets");
assert(Catalog.facetNote(facetIndex, "instruments", "production").includes("Ableton"));
assert(Catalog.facetNote(facetIndex, "instruments", "All") === "");

const alpha = lesson({
  id: "aaaaaaaaaaa",
  channel_name: "Alpha Channel",
  channel_id: channelId("a"),
  teacher: "Ada Lovelace",
  instrument: "guitar",
  tradition: "jazz",
  style: "blues",
  topics: ["technique", "theory"],
  level: "beginner",
  structure: "structured",
  series: "Grade 1",
  year: 2019,
  duration_seconds: 90,
  in_the_style_of: "Buddy Guy",
});
const alphaAgain = lesson({
  id: "bbbbbbbbbbb",
  channel_name: "Alpha Channel",
  channel_id: channelId("a"),
  teacher: "Ada Lovelace",
  instrument: "guitar",
  tradition: "western",
  style: "blues",
  topics: ["song tutorial"],
  level: "advanced",
  structure: "casual",
  year: 0,
  duration_seconds: 600,
  title: "Second lesson",
});
const beta = lesson({
  id: "ccccccccccc",
  channel_name: "Beta Lessons",
  channel_id: channelId("b"),
  teacher: "José González",
  instrument: "piano",
  style: "Folk, early",
  topics: ["theory"],
  level: "intermediate",
  structure: "casual",
  year: 2024,
  duration_seconds: 30,
  title: 'Hello, "world"',
  description: "Line one\nLine two",
});
const catalogLessons = [alpha, alphaAgain, beta];
assert(validate(catalogLessons, facets).length === 0, validate(catalogLessons, facets).join("; "));
const index = Catalog.buildIndex(catalogLessons, facets);
assert(index.channelCount[channelId("a")] === 2, "channel count");
assert(index.channels[0].channel_name === "Alpha Channel");
assert(index.instrumentCount.guitar === 2 && index.instrumentCount.piano === 1);
assert(index.traditionCount.jazz === 1 && !index.traditionCount[""]);

assert(catalogLessons.filter((item) => Catalog.matches(item, { instrument: "guitar" }, index)).length === 2);
assert(catalogLessons.filter((item) => Catalog.matches(item, { instrument: "piano" }, index)).length === 1);
assert(catalogLessons.filter((item) => Catalog.matches(item, { tradition: "jazz" }, index)).map((item) => item.id).join() === alpha.id);
assert(catalogLessons.filter((item) => Catalog.matches(item, { tradition: "flamenco" }, index)).length === 0);
assert(Catalog.matches(beta, { tradition: "All" }, index), "missing tradition still matches All");
assert(!Catalog.matches(beta, { tradition: "jazz" }, index));
assert(Catalog.matches(alpha, { topic: "theory" }, index) && Catalog.matches(alpha, { topic: "technique" }, index));
assert(Catalog.matches(alpha, { structure: "structured", level: "beginner", style: "blues", inTheStyleOf: "buddy guy" }, index));
assert(Catalog.matches(beta, { channel: "Beta Lessons" }, index));
assert(Catalog.matches(beta, { query: "jose gonzalez" }, index), "accent-insensitive search");
assert(Catalog.matches(alpha, { query: "buddy guy" }, index));
assert(Catalog.matches(alpha, { query: "grade 1" }, index));
assert(!Catalog.matches(beta, { instrument: "guitar" }, index));

const byChannel = Catalog.sortLessons(catalogLessons, "channel");
assert(byChannel[0].channel_name === "Alpha Channel" && byChannel[2].channel_name === "Beta Lessons");
const byTime = Catalog.sortLessons(catalogLessons, "time");
assert(byTime[0].id === alphaAgain.id);
const byYear = Catalog.sortLessons(catalogLessons, "year");
assert(byYear[0].year === 2019 && byYear[byYear.length - 1].year === 0, "unknown years sort last");

const channelGroups = Catalog.groupLessons(byChannel, "channel", "channel", { index });
const alphaGroup = channelGroups.find((group) => group.key === channelId("a"));
assert(alphaGroup && alphaGroup.count === 2 && alphaGroup.label === "Alpha Channel", "browse by channel counts");
assert(channelGroups.length === 2, "single-lesson channels stay visible");
const traditionGroups = Catalog.groupLessons(catalogLessons, "tradition", "channel", { index });
assert(traditionGroups.length === 2, "lessons without a tradition are left out of that view");
assert(!traditionGroups.some((group) => group.items.some((item) => item.id === beta.id)));
const topicGroups = Catalog.groupLessons([alpha], "topic", "channel", { index });
assert(topicGroups.length === 2 && topicGroups.every((group) => group.items[0].id === alpha.id), "a lesson can sit in each topic");
const levelGroups = Catalog.groupLessons(catalogLessons, "level", "channel", { index });
assert(levelGroups.map((group) => group.key).join() === "beginner,intermediate,advanced", "level order follows facets");

const related = Catalog.related(alpha, catalogLessons, 5);
assert(related[0].lesson.id === alphaAgain.id && related[0].score > Catalog.related(alpha, [beta], 5)[0].score);
assert(Catalog.relatedReason(related[0], alpha).includes("Alpha Channel"));

const appearances = Catalog.appearances("ada", catalogLessons);
assert(appearances.some((person) => person.name === "Ada Lovelace" && person.acts.includes("Alpha Channel")));

global.Catalog = Catalog;
const FinderView = require("../js/view.js");
const cleared = FinderView.clearedFilters(index, {
  channel: channelId("b"),
  instrument: "piano",
  style: "All",
  tradition: "flamenco",
  topic: "All",
  structure: "All",
  level: "All",
  inTheStyleOf: "All",
}, "Alpha Channel");
assert(cleared.query === "Alpha Channel");
assert(cleared.channel === "All" && cleared.instrument === "All" && cleared.tradition === "All", "a name search clears filters that hide hits");
const preset = FinderView.presets({ tradition: "Jazz", instrument: "Theory", channel: "Alpha Channel", level: "nope" }, index);
assert(preset.tradition === "jazz" && preset.instrument === "theory" && preset.channel === channelId("a") && preset.level === "All");

function parseCsv(text) {
  assert(text.charCodeAt(0) === 0xFEFF, "csv starts with a UTF-8 BOM");
  const body = text.slice(1);
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      if (field.endsWith("\r")) field = field.slice(0, -1);
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    if (field.endsWith("\r")) field = field.slice(0, -1);
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.length > 1 || cells[0] !== "");
}

const sheet = parseCsv(Catalog.toCsv(Catalog.sortLessons(catalogLessons, "channel")));
assert(sheet[0].join(",") === Catalog.CSV_HEADERS.join(","), "csv header");
assert(sheet[0].includes("tradition") && sheet[0].includes("instrument") && sheet[0].includes("ytmusictrainer_url"));
const traditionAt = sheet[0].indexOf("tradition");
const betaRow = sheet.slice(1).find((row) => row[0] === beta.id);
const alphaRow = sheet.slice(1).find((row) => row[0] === alpha.id);
assert(betaRow[traditionAt] === "", "omitted tradition is blank");
assert(alphaRow[traditionAt] === "jazz");
assert(alphaRow[sheet[0].indexOf("in_the_style_of")] === "Buddy Guy");
assert(alphaRow[sheet[0].indexOf("topics")] === "technique; theory");
assert(betaRow[sheet[0].indexOf("title")] === 'Hello, "world"');
assert(betaRow[sheet[0].indexOf("description")] === "Line one\nLine two");
assert(betaRow[sheet[0].indexOf("year")] === "2024");
assert(alphaAgainRow(sheet, alphaAgain.id)[sheet[0].indexOf("year")] === "", "unknown year is blank");
assert(betaRow[sheet[0].indexOf("ytmusictrainer_url")] === Catalog.trainerUrl(beta.id));
assert(Catalog.toCsv([beta]).includes('"Hello, ""world"""'), "quotes are doubled");

function alphaAgainRow(rows, id) {
  return rows.slice(1).find((row) => row[0] === id);
}

const filtered = Catalog.sortLessons(catalogLessons.filter((item) => Catalog.matches(item, { instrument: "guitar" }, index)), "channel");
const filteredSheet = parseCsv(Catalog.toCsv(filtered));
assert(filteredSheet.length === filtered.length + 1, "filtered csv is one row per lesson");
assert(filteredSheet.slice(1).every((row) => row[sheet[0].indexOf("instrument")] === "guitar"));

const emptySheet = parseCsv(Catalog.toCsv([]));
assert(emptySheet.length === 1, "empty catalog csv is a header");

const exported = path.join(os.tmpdir(), "ylf-catalog-" + process.pid + ".csv");
const exportRun = spawnSync(process.execPath, [path.join(root, "scripts", "export-csv.js"), exported], { encoding: "utf8" });
assert(exportRun.status === 0, exportRun.stderr || "export-csv failed");
assert(fs.readFileSync(exported, "utf8") === Catalog.toCsv(Catalog.sortLessons(lessons, "channel")), "export script matches the catalog csv");
fs.unlinkSync(exported);

const validateRun = spawnSync(process.execPath, [path.join(root, "scripts", "validate-data.js")], { encoding: "utf8" });
assert(validateRun.status === 0, validateRun.stderr || "validate-data failed");

for (const file of ["index.html", "embed-demo.html", "css/styles.css", "js/app.js", "js/view.js", "js/catalog.js", "js/embed-boot.js", "README.md", "SCHEMA.md"]) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (/(?:href|src|url\()\s*["']?\//.test(text)) throw new Error(file + " has a root-absolute path");
  const banned = "con" + "cert";
  assert(!text.toLowerCase().includes(banned), file + " uses retired catalog wording");
  assert(!text.toLowerCase().includes("musician"), file);
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const ref of ["css/styles.css", "js/catalog.js", "js/view.js", "js/app.js", "favicon.svg", "data/lessons.json"]) {
  const bundle = ref.endsWith(".json") ? fs.readFileSync(path.join(root, "js/app.js"), "utf8") : html;
  assert(bundle.includes(ref), "missing " + ref);
}
assert(html.includes("data/facets.json") === false);
assert(fs.readFileSync(path.join(root, "js/app.js"), "utf8").includes("data/facets.json"), "the page loads facets when present");
const ids = ["summary", "stats", "theme", "q", "channel", "instrument", "style", "style-of", "tradition", "topic", "structure", "level", "sort", "status", "facet-note", "results", "discover", "discover-body", "channel-heading", "channel-count", "channel-list", "tradition-heading", "tradition-count", "tradition-list", "style-of-heading", "style-of-count", "style-of-list"];
const shell = FinderView.shellHtml();
for (const id of ids) {
  assert(html.includes('id="' + id + '"'), "page missing " + id);
  assert(shell.includes('id="' + id + '"'), "shell missing " + id);
}
assert(html.includes("Browse by channel") && shell.includes("Browse by channel"));
assert(html.includes("Download this list") && html.includes("Download full spreadsheet") && html.includes("data/catalog.csv"));
assert(shell.includes("Download this list") && shell.includes("Powered by"));
function disclosureOrder(markup, label) {
  const discoverAt = markup.indexOf('id="discover"');
  const channelAt = markup.indexOf('id="channel-heading"');
  const traditionAt = markup.indexOf('id="tradition-heading"');
  assert(discoverAt > -1 && channelAt > discoverAt && traditionAt > channelAt, label + " section order");
  assert(markup.includes('<details class="fold">'), label + " uses a collapsed details element");
  assert(!markup.includes('<details class="fold" open'), label + " starts collapsed");
}
disclosureOrder(html, "site");
disclosureOrder(shell, "embed shell");

const viewSource = fs.readFileSync(path.join(root, "js", "view.js"), "utf8");
assert(viewSource.includes("View on YouTube") && viewSource.includes("Open on YT Trainer"), "video links");
assert(viewSource.includes("Catalog.trainerUrl") && !viewSource.includes("ytmusictrainer.com"), "trainer url stays in catalog.js");
assert(viewSource.includes("youtube-nocookie.com/embed/"), "inline player");
assert(viewSource.includes('data-action="csv"') && viewSource.includes('data-action="search"') && viewSource.includes("runSearch"));
assert(viewSource.includes('"name-link"'), "channel names are search links");
const demo = fs.readFileSync(path.join(root, "embed-demo.html"), "utf8");
assert(demo.includes('id="lesson-finder"') || demo.includes("&lt;div id=\"lesson-finder\"&gt;&lt;/div&gt;"), "demo snippet");
assert(demo.includes("https://mkpworks.github.io/Yt-music-lesson-finder/embed.js") && demo.includes("defer"), "demo script url");
assert(demo.includes('src="embed.js"'), "demo runs the local embed");
assert(demo.includes("data-tradition") && demo.includes("data-height") && demo.includes("data-theme") && demo.includes("data-accent"));
const boot = fs.readFileSync(path.join(root, "js", "embed-boot.js"), "utf8");
assert(boot.includes("document.currentScript") && boot.includes("data/version.json") && boot.includes("data/catalog.json"), "embed resolves data from its own src");
assert(boot.includes("attachShadow") && boot.includes("[data-lesson-finder]") && boot.includes("window.LessonFinder"), "embed contract");
assert(boot.includes('cache: "no-store"'), "version fetch bypasses the pages cache");
assert(boot.includes("data-tradition") && boot.includes("data-instrument") && boot.includes("options.tradition"), "embed presets tradition and instrument");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/pages.yml"), "utf8");
for (const name of ["actions/configure-pages", "actions/upload-pages-artifact", "actions/deploy-pages", "scripts/validate-data.js", "scripts/check-catalog.js", "scripts/build-catalog.js", "scripts/build-embed.js", "embed-demo.html", "workflow_dispatch", "needs: build"]) {
  assert(workflow.includes(name), name);
}
const deployJob = workflow.split(/\n {2}deploy:\n/)[1] || "";
assert(deployJob.length > 0, "deploy job");
assert(!deployJob.includes("actions/upload-pages-artifact"), "deploy job only deploys");
assert(deployJob.includes("pages: write") && deployJob.includes("id-token: write"), "deploy permissions");
assert(workflow.includes("scripts/export-csv.js") && workflow.includes("_site/data/catalog.csv"), "pages build publishes the csv");
assert(/Configure GitHub Pages\n\s+if: github\.event_name != 'pull_request'\n\s+uses: actions\/configure-pages/.test(workflow), "pull requests do not require a Pages site");

const built = path.join(os.tmpdir(), "ylf-embed-" + process.pid);
fs.mkdirSync(built, { recursive: true });
const catalogBuild = spawnSync(process.execPath, [path.join(root, "scripts", "build-catalog.js"), built], { encoding: "utf8" });
assert(catalogBuild.status === 0, catalogBuild.stderr || "build-catalog failed");
const versionFile = JSON.parse(fs.readFileSync(path.join(built, "version.json"), "utf8"));
const catalogFile = JSON.parse(fs.readFileSync(path.join(built, "catalog.json"), "utf8"));
assert(versionFile.version === "1" && catalogFile.version === "1", "schema version 1");
assert(versionFile.generated_at === catalogFile.generated_at && /^\d{4}-\d{2}-\d{2}T/.test(versionFile.generated_at), "generated_at");
assert(catalogFile.lessons.length === lessons.length, "catalog.json lessons");
assert(catalogFile.facets.instruments.includes("theory") && catalogFile.facets.traditions.includes("jazz"), "catalog.json facets");
const embedOut = path.join(built, "embed.js");
const embedBuild = spawnSync(process.execPath, [path.join(root, "scripts", "build-embed.js"), embedOut], { encoding: "utf8" });
assert(embedBuild.status === 0, embedBuild.stderr || "build-embed failed");
const embedCheck = spawnSync(process.execPath, ["--check", embedOut], { encoding: "utf8" });
assert(embedCheck.status === 0, embedCheck.stderr || "embed.js syntax");
const embedSource = fs.readFileSync(embedOut, "utf8");
for (const needle of ["window.LessonFinder", "attachShadow", "[data-lesson-finder]", "data/version.json", "data/catalog.json", "Open on YT Trainer", "youtube-nocookie.com/embed/", "Powered by", 'id="tradition"', "Browse by channel"]) {
  assert(embedSource.includes(needle), "embed bundle missing " + needle);
}

const started = process.hrtime.bigint();
const benchFacets = { instruments: ["guitar", "piano"], traditions: ["jazz"], topics: ["technique"], styles: ["blues"], structures: ["casual"], levels: ["beginner"] };
const bench = [];
for (let i = 0; i < 180; i += 1) {
  const id = "a" + String(i).padStart(10, "0");
  bench.push(lesson({
    id,
    channel_id: channelId(i % 2 ? "a" : "b"),
    channel_name: i % 2 ? "Alpha Channel" : "Beta Lessons",
    instrument: i % 2 ? "guitar" : "piano",
    tradition: "jazz",
    title: "Lesson " + i,
  }));
}
const benchIndex = Catalog.buildIndex(bench, benchFacets);
for (let pass = 0; pass < 40; pass += 1) {
  const filteredRows = Catalog.sortLessons(
    bench.filter((item) => Catalog.matches(item, { query: "lesson", instrument: pass % 2 ? "guitar" : "All", tradition: pass % 3 ? "jazz" : "All" }, benchIndex)),
    "channel"
  );
  Catalog.groupLessons(filteredRows, "channel", "channel", { index: benchIndex });
  Catalog.groupLessons(filteredRows, "tradition", "time", { index: benchIndex });
}
const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
assert(elapsed < 1500, "filtering the catalog took " + elapsed.toFixed(0) + "ms");
console.log("OK: catalog checks passed (" + lessons.length + " lessons, " + facetIndex.instruments.length + " instruments, " + facetIndex.traditions.length + " traditions, filter pass " + elapsed.toFixed(0) + "ms)");
