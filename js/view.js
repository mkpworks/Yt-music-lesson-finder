"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FinderView = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STYLE_COLORS = ["#e07a5f", "#3aa99a", "#e6a23c", "#7ea2e0", "#c46bdc", "#8fbf6a", "#e09ab2", "#d98a4a"];
  const PIVOT_KEYS = ["instrument", "style", "tradition", "topic", "structure", "level", "inTheStyleOf"];
  const SELECTS = [
    ["channel", "channel"],
    ["instrument", "instrument"],
    ["style", "style"],
    ["style-of", "inTheStyleOf"],
    ["tradition", "tradition"],
    ["topic", "topic"],
    ["structure", "structure"],
    ["level", "level"],
    ["sort", "sort"],
  ];
  const MODE_NOTES = {
    channel: "Each group is a YouTube channel. The count is the number of lessons. Choose a channel name to fill the search.",
    styleOf: "Only lessons that name an artist under in the style of are listed here.",
    tradition: "Only lessons that name a tradition are listed here.",
    topic: "A lesson is listed under each of its topics.",
    level: "Lessons with no stated level are left out of this view.",
  };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function pickValue(value, allowed, labels) {
    const choices = allowed || [];
    if (value == null) return "All";
    const text = String(value).trim();
    if (!text || Catalog.fold(text) === "all") return "All";
    if (choices.includes(text)) return text;
    const folded = Catalog.fold(text);
    const found = choices.find((item) => Catalog.fold(item) === folded || Catalog.fold(Catalog.labelOf(item, labels)) === folded);
    return found || "All";
  }

  function presets(options, index) {
    const source = options || {};
    const idx = index || {};
    let channel = "All";
    if (source.channel) {
      const folded = Catalog.fold(source.channel);
      const match = (idx.channels || []).find((item) => item.channel_id === source.channel || Catalog.fold(item.channel_name) === folded);
      if (match) channel = match.channel_id;
    }
    const labels = (idx.facets && idx.facets.labels) || {};
    return {
      channel,
      instrument: pickValue(source.instrument, idx.instruments, labels.instruments),
      style: pickValue(source.style, idx.styles, labels.styles),
      tradition: pickValue(source.tradition, idx.traditions, labels.traditions),
      topic: pickValue(source.topic, idx.topics, labels.topics),
      structure: pickValue(source.structure, idx.structures, labels.structures),
      level: pickValue(source.level, idx.levels, labels.levels),
      inTheStyleOf: pickValue(source.inTheStyleOf || source.in_the_style_of, idx.styleArtists),
    };
  }

  function clearedFilters(index, filters, query) {
    const next = {
      channel: (filters && filters.channel) || "All",
      instrument: (filters && filters.instrument) || "All",
      style: (filters && filters.style) || "All",
      tradition: (filters && filters.tradition) || "All",
      topic: (filters && filters.topic) || "All",
      structure: (filters && filters.structure) || "All",
      level: (filters && filters.level) || "All",
      inTheStyleOf: (filters && filters.inTheStyleOf) || "All",
      query: query || "",
    };
    const hits = index.lessons.filter((item) => Catalog.matches(item, { query: next.query }, index));
    if (!hits.length) return next;
    if (next.channel !== "All" && hits.some((item) => item.channel_id !== next.channel)) next.channel = "All";
    if (next.instrument !== "All" && hits.some((item) => item.instrument !== next.instrument)) next.instrument = "All";
    if (next.style !== "All" && hits.some((item) => item.style !== next.style)) next.style = "All";
    if (next.tradition !== "All" && hits.some((item) => Catalog.traditionOf(item) !== next.tradition)) next.tradition = "All";
    if (next.topic !== "All" && hits.some((item) => !Catalog.topicsOf(item).includes(next.topic))) next.topic = "All";
    if (next.structure !== "All" && hits.some((item) => item.structure !== next.structure)) next.structure = "All";
    if (next.level !== "All" && hits.some((item) => item.level !== next.level)) next.level = "All";
    if (next.inTheStyleOf !== "All" && hits.some((item) => Catalog.fold(Catalog.styleOfArtist(item)) !== Catalog.fold(next.inTheStyleOf))) next.inTheStyleOf = "All";
    return next;
  }

  function shellHtml(options) {
    const home = (options && options.home) || "https://mkpworks.github.io/Yt-music-lesson-finder/";
    const csv = (options && options.csv) || (home + "data/catalog.csv");
    return (
      '<div class="finder">' +
        '<header class="site-header"><div class="wrap header-row"><div>' +
          '<p class="eyebrow">YouTube lessons</p>' +
          "<h1>YT Music Lesson Finder</h1>" +
          '<p class="lede" id="summary">Online music lessons on YouTube, grouped by channel and filtered by instrument, style, tradition, topic, structure, and level.</p>' +
          '<dl class="stats" id="stats"></dl>' +
        "</div>" +
        '<button type="button" class="btn" id="theme" data-action="theme">Light theme</button>' +
        "</div></header>" +
        '<div class="wrap">' +
          '<section class="panel" aria-labelledby="browse-heading">' +
            '<div class="panel-head">' +
              '<h2 id="browse-heading">Browse</h2>' +
              '<div class="modes" role="group" aria-label="Browse mode">' +
                '<button type="button" data-action="mode" data-mode="channel" aria-pressed="true">Browse by channel</button>' +
                '<button type="button" data-action="mode" data-mode="instrument" aria-pressed="false">Instrument</button>' +
                '<button type="button" data-action="mode" data-mode="style" aria-pressed="false">Style</button>' +
                '<button type="button" data-action="mode" data-mode="styleOf" aria-pressed="false">In the style of</button>' +
                '<button type="button" data-action="mode" data-mode="tradition" aria-pressed="false">Tradition</button>' +
                '<button type="button" data-action="mode" data-mode="topic" aria-pressed="false">Topic</button>' +
                '<button type="button" data-action="mode" data-mode="structure" aria-pressed="false">Structure</button>' +
                '<button type="button" data-action="mode" data-mode="level" aria-pressed="false">Level</button>' +
                '<button type="button" data-action="mode" data-mode="list" aria-pressed="false">All lessons</button>' +
              "</div>" +
            "</div>" +
            '<div class="filters">' +
              '<label class="field field-search"><span>Search <kbd>/</kbd></span><input id="q" type="search" placeholder="Channel, teacher, style, topic, artist" autocomplete="off"></label>' +
              '<label class="field">Channel <select id="channel"></select></label>' +
              '<label class="field">Instrument <select id="instrument"></select></label>' +
              '<label class="field">Style <select id="style"></select></label>' +
              '<label class="field">In the style of <select id="style-of"></select></label>' +
              '<label class="field">Tradition <select id="tradition"></select></label>' +
              '<label class="field">Topic <select id="topic"></select></label>' +
              '<label class="field">Structure <select id="structure"></select></label>' +
              '<label class="field">Level <select id="level"></select></label>' +
              '<label class="field">Sort by <select id="sort"><option value="channel">Channel A–Z</option><option value="year">Year (oldest first)</option><option value="time">Running time (longest)</option></select></label>' +
            "</div>" +
          "</section>" +
          '<div class="toolbar"><p class="status" id="status" aria-live="polite">Loading the catalog…</p>' +
            '<div class="toolbar-actions">' +
              '<button type="button" class="btn" data-action="prev">Previous</button>' +
              '<button type="button" class="btn" data-action="next">Next</button>' +
              '<button type="button" class="btn" data-action="expand" data-group-only>Expand all</button>' +
              '<button type="button" class="btn" data-action="collapse" data-group-only>Collapse all</button>' +
              '<button type="button" class="btn" data-action="clear">Clear filters</button>' +
              '<button type="button" class="btn" data-action="csv">Download this list</button>' +
            "</div>" +
          "</div>" +
          '<p id="facet-note" class="section-note" hidden></p>' +
          '<div id="results" tabindex="-1"></div>' +
          '<section class="discover" id="discover" aria-labelledby="discover-heading"><div class="discover-head"><h2 id="discover-heading">Discover</h2>' +
            '<button type="button" class="btn btn-primary" data-action="random">Random lesson</button></div>' +
            '<p class="section-note">Related lessons share a channel, tradition, style, instrument, or topic.</p>' +
            '<div id="discover-body"></div></section>' +
          '<details class="fold"><summary>' +
            '<span class="chev" aria-hidden="true">▸</span>' +
            '<span class="cross-title" id="channel-heading">Channels</span>' +
            '<span class="cross-count" id="channel-count"></span>' +
            "</summary>" +
            '<p class="section-note">Choose a channel name to fill the search. The number is how many lessons are on that channel.</p>' +
            '<div id="channel-list" class="chips"></div></details>' +
          '<details class="fold"><summary>' +
            '<span class="chev" aria-hidden="true">▸</span>' +
            '<span class="cross-title" id="tradition-heading">Traditions</span>' +
            '<span class="cross-count" id="tradition-count"></span>' +
            "</summary>" +
            '<p class="section-note">Traditions come from the facet list. The number is how many lessons name that tradition.</p>' +
            '<div id="tradition-list" class="chips"></div></details>' +
          '<details class="fold"><summary>' +
            '<span class="chev" aria-hidden="true">▸</span>' +
            '<span class="cross-title" id="style-of-heading">In the style of</span>' +
            '<span class="cross-count" id="style-of-count"></span>' +
            "</summary>" +
            '<p class="section-note">Artists a lesson is in the style of. Choose a name to fill the search.</p>' +
            '<div id="style-of-list" class="chips"></div></details>' +
          '<footer class="site-footer">' +
            "<p>Watch links open YouTube uploads. Those videos are not hosted here, and the uploads can change or be removed.</p>" +
            '<p><a href="' + esc(csv) + '">Download full spreadsheet</a></p>' +
            '<p class="powered">Powered by <a href="' + esc(home) + '">YT Music Lesson Finder</a></p>' +
          "</footer>" +
        "</div>" +
      "</div>"
    );
  }

  function mount(root, options) {
    const opts = options || {};
    const byId = (id) => root.getElementById(id);
    const themeTarget = opts.themeTarget || document.documentElement;
    const persistTheme = Boolean(opts.persistTheme);
    const state = {
      mode: "channel",
      sort: "channel",
      channel: "All",
      instrument: "All",
      style: "All",
      tradition: "All",
      topic: "All",
      structure: "All",
      level: "All",
      inTheStyleOf: "All",
      query: "",
      page: 0,
      open: {},
      pickId: "",
      seedMode: true,
    };
    let index = null;
    let defaults = presets({}, null);
    let channelStamp = "";
    let traditionStamp = "";
    let styleOfStamp = "";
    let discoverStamp = "";

    function styleColor(style) {
      const at = Math.max(0, index.styles.indexOf(style));
      return STYLE_COLORS[at % STYLE_COLORS.length];
    }

    function groupDomId(key) {
      return state.mode + ":" + key;
    }

    function currentRows() {
      return Catalog.sortLessons(
        index.lessons.filter((lesson) => Catalog.matches(lesson, state, index)),
        state.sort
      );
    }

    function currentGroups(rows) {
      if (state.mode === "list") return [];
      return Catalog.groupLessons(rows, state.mode, state.sort, { index });
    }

    function filtersAreClear() {
      return !state.query.trim() &&
        state.channel === "All" &&
        state.instrument === "All" &&
        state.style === "All" &&
        state.tradition === "All" &&
        state.topic === "All" &&
        state.structure === "All" &&
        state.level === "All" &&
        state.inTheStyleOf === "All";
    }

    function fillSelect(id, values, labeler, titleFor) {
      const select = byId(id);
      const choices = ['<option value="All">All</option>'];
      for (const value of values) {
        const label = labeler ? labeler(value) : value;
        const title = titleFor ? titleFor(value) : "";
        const titleAttr = title ? ' title="' + esc(title) + '"' : "";
        choices.push('<option value="' + esc(value) + '"' + titleAttr + ">" + esc(label) + "</option>");
      }
      select.innerHTML = choices.join("");
    }

    function facetLabel(value, key) {
      const group = {
        instrument: "instruments",
        style: "styles",
        tradition: "traditions",
        topic: "topics",
        structure: "structures",
        level: "levels",
      }[key] || key;
      const labels = index.facets && index.facets.labels && index.facets.labels[group];
      return Catalog.labelOf(value, labels);
    }

    function searchButton(name, className, label) {
      const on = Catalog.fold(state.query) === Catalog.fold(name) ? " is-on" : "";
      const text = label || name;
      return '<button type="button" class="' + className + on + '" data-action="search" data-query="' + esc(name) + '" aria-label="Search for ' + esc(name) + '">' + esc(text) + "</button>";
    }

    function pivotButton(key, value, className, label) {
      const on = state[key] === value ? " is-on" : "";
      const text = label || facetLabel(value, key);
      return '<button type="button" class="' + className + on + '" data-action="pivot" data-key="' + esc(key) + '" data-value="' + esc(value) + '" aria-label="Filter by ' + esc(text) + '">' + esc(text) + "</button>";
    }

    function lessonArticle(lesson, articleOptions) {
      const grouped = Boolean(articleOptions && articleOptions.grouped);
      const feature = Boolean(articleOptions && articleOptions.feature);
      const showRelated = Boolean(articleOptions && articleOptions.related);
      const shared = articleOptions && articleOptions.shared;
      const titleTag = feature || !grouped ? "h3" : "h4";
      const yearHtml = lesson.year ? "<span>" + esc(lesson.year) + "</span>" : "";
      const teacherHtml = lesson.teacher && Catalog.fold(lesson.teacher) !== Catalog.fold(lesson.channel_name)
        ? searchButton(lesson.teacher, "name-link")
        : "";
      const styleHtml = lesson.style
        ? '<button type="button" class="style-mark" data-action="pivot" data-key="style" data-value="' + esc(lesson.style) + '"><i style="background:' + styleColor(lesson.style) + '"></i>' + esc(facetLabel(lesson.style, "style")) + "</button>"
        : "";
      const chips = [];
      if (lesson.instrument) chips.push(pivotButton("instrument", lesson.instrument, "chip-btn"));
      if (Catalog.traditionOf(lesson)) chips.push(pivotButton("tradition", lesson.tradition, "chip-btn"));
      for (const topic of Catalog.topicsOf(lesson)) chips.push(pivotButton("topic", topic, "chip-btn"));
      if (Catalog.styleOfArtist(lesson)) {
        const artist = Catalog.styleOfArtist(lesson);
        chips.push('<span class="chip">' + searchButton(artist, "chip-btn", "Style of " + artist) + "</span>");
      }
      if (Catalog.seriesOf(lesson)) {
        const series = Catalog.seriesOf(lesson);
        chips.push('<span class="chip">' + searchButton(series, "chip-btn", "Series · " + series) + "</span>");
      }
      const wrapped = chips.map((chip) => chip.startsWith("<span") ? chip : '<span class="chip">' + chip + "</span>").join("");
      const description = Catalog.descriptionOf(lesson);
      const watchUrl = Catalog.safeHttpUrl(Catalog.youtubeUrl(lesson), "https://www.youtube.com/watch?v=" + encodeURIComponent(lesson.id || ""));
      const trainer = Catalog.trainerUrl(lesson.id);
      const links =
        '<div class="video-links">' +
          '<a class="watch" href="' + esc(watchUrl) + '" target="_blank" rel="noopener noreferrer" aria-label="View ' + esc(lesson.title) + ' on YouTube">View on YouTube</a>' +
          '<a class="trainer" href="' + esc(trainer) + '" target="_blank" rel="noopener noreferrer" aria-label="Open ' + esc(lesson.title) + ' on YT Trainer">Open on YT Trainer</a>' +
        "</div>";
      const relatedHtml = showRelated
        ? '<button type="button" class="text-btn" data-action="similar" data-id="' + esc(lesson.id) + '">Related</button>'
        : "";
      const sharedHtml = shared ? '<p class="shared">' + esc(shared) + "</p>" : "";
      return (
        '<article class="lesson' + (feature ? " is-feature" : "") + '">' +
          '<div class="thumb-wrap"><button type="button" class="play" data-action="play" data-id="' + esc(lesson.id) + '" aria-label="Play ' + esc(lesson.title) + '">' +
            '<img class="thumb" alt="" width="320" height="180" loading="lazy" decoding="async" src="https://i.ytimg.com/vi/' + encodeURIComponent(lesson.id || "") + '/mqdefault.jpg">' +
            '<span class="play-mark" aria-hidden="true">Play</span>' +
          "</button></div>" +
          '<div class="lesson-body">' +
            '<div class="lesson-top">' +
              "<" + titleTag + ' class="lesson-title">' + esc(lesson.title) + "</" + titleTag + ">" +
              links +
            "</div>" +
            '<p class="meta">' +
              searchButton(lesson.channel_name, "name-link") +
              teacherHtml +
              yearHtml +
              (lesson.level ? '<span class="type-badge is-' + esc(lesson.level) + '">' + esc(facetLabel(lesson.level, "level")) + "</span>" : "") +
              '<span class="type-badge">' + esc(facetLabel(lesson.structure, "structure")) + "</span>" +
              styleHtml +
              '<span class="time">' + esc(Catalog.formatDuration(lesson.duration_seconds)) + "</span>" +
            "</p>" +
            (description ? '<p class="desc">' + esc(description) + "</p>" : "") +
            (wrapped ? '<div class="chips">' + wrapped + "</div>" : "") +
            sharedHtml +
            relatedHtml +
          "</div>" +
        "</article>"
      );
    }

    function groupBlock(group) {
      const id = groupDomId(group.key);
      const open = Boolean(state.open[id]);
      const named = state.mode === "channel" || state.mode === "styleOf";
      const titleHtml = named
        ? searchButton(group.label, "group-title")
        : pivotButton(state.mode, group.key, "group-title", group.label);
      const meta = group.count + " lesson" + (group.count === 1 ? "" : "s") + " · " + Catalog.formatDuration(group.seconds) + " total";
      const body = open
        ? '<div class="group-body">' + group.items.map((lesson) => lessonArticle(lesson, { grouped: true, related: true })).join("") + "</div>"
        : "";
      return (
        '<section class="group' + (open ? " is-open" : "") + '">' +
          '<h3 class="group-head">' +
            '<span class="group-main">' +
              '<button type="button" class="chev-btn" data-action="group" data-group="' + esc(id) + '" aria-expanded="' + (open ? "true" : "false") + '" aria-label="' + (open ? "Collapse " : "Expand ") + esc(group.label) + '">' +
                '<span class="chev" aria-hidden="true">▸</span>' +
              "</button>" +
              titleHtml +
            "</span>" +
            '<button type="button" class="group-meta" data-action="group" data-group="' + esc(id) + '">' + esc(meta) + "</button>" +
          "</h3>" +
          body +
        "</section>"
      );
    }

    function appearsHtml(rows) {
      const found = Catalog.appearances(state.query, rows);
      if (!found.length) return "";
      return '<div class="appears">' + found.slice(0, 3).map((person) => {
        const shown = person.acts.slice(0, 12);
        const links = shown.map((place) => '<button type="button" class="act-link" data-action="search" data-query="' + esc(place) + '">' + esc(place) + "</button>").join('<span class="act-sep">, </span>');
        const more = person.acts.length > shown.length ? '<span class="act-sep">…</span>' : "";
        return "<p>" + searchButton(person.name, "name-link") + " appears on: " + links + more + "</p>";
      }).join("") + "</div>";
    }

    function emptyState(message) {
      return '<div class="empty"><p>' + esc(message) + '</p><button type="button" class="btn" data-action="clear">Clear filters</button></div>';
    }

    function pager(pages) {
      if (pages < 2) return "";
      const prev = state.page === 0 ? " disabled" : "";
      const next = state.page >= pages - 1 ? " disabled" : "";
      return '<nav class="pager" aria-label="Pagination"><button type="button" class="btn" data-action="prev"' + prev + ">Previous</button><button type=\"button\" class=\"btn\" data-action=\"next\"" + next + ">Next</button></nav>";
    }

    function renderLists() {
      const channelKey = state.query + "\0" + state.channel;
      if (channelKey !== channelStamp) {
        channelStamp = channelKey;
        const host = byId("channel-list");
        if (host) {
          host.innerHTML = index.channels.length
            ? index.channels.map((channel) => '<span class="chip">' + searchButton(channel.channel_name, "chip-btn") + '<span class="chip-count">' + (index.channelCount[channel.channel_id] || 0) + "</span></span>").join("")
            : "";
        }
      }
      const traditionKey = state.tradition;
      if (traditionKey !== traditionStamp) {
        traditionStamp = traditionKey;
        const host = byId("tradition-list");
        if (host) {
          host.innerHTML = index.traditions.map((tradition) => '<span class="chip">' + pivotButton("tradition", tradition, "chip-btn") + '<span class="chip-count">' + (index.traditionCount[tradition] || 0) + "</span></span>").join("");
        }
      }
      const styleKey = state.query + "\0" + state.inTheStyleOf;
      if (styleKey !== styleOfStamp) {
        styleOfStamp = styleKey;
        const host = byId("style-of-list");
        if (host) {
          host.innerHTML = index.styleArtists.map((name) => '<span class="chip">' + searchButton(name, "chip-btn") + '<span class="chip-count">' + (index.styleArtistCount[name] || 0) + "</span></span>").join("");
        }
      }
    }

    function render(scroll) {
      if (!index) return;
      const active = root.activeElement;
      const focusGroup = active && active.getAttribute && active.getAttribute("data-group");
      const rows = currentRows();
      const groups = currentGroups(rows);
      if (state.seedMode && state.mode !== "list" && groups.length) {
        const anyOpen = groups.some((group) => state.open[groupDomId(group.key)]);
        if (!anyOpen) state.open[groupDomId(groups[0].key)] = true;
        state.seedMode = false;
      }
      const totalUnits = state.mode === "list" ? rows.length : groups.length;
      const pages = Catalog.pageCount(totalUnits);
      if (state.page > pages - 1) state.page = pages - 1;
      if (state.page < 0) state.page = 0;
      const start = state.page * Catalog.PER_PAGE;
      const pageRows = rows.slice(start, start + Catalog.PER_PAGE);
      const pageGroups = groups.slice(start, start + Catalog.PER_PAGE);
      const units = {
        channel: ["channel", "channels"],
        instrument: ["instrument", "instruments"],
        style: ["style", "styles"],
        styleOf: ["artist", "artists"],
        tradition: ["tradition", "traditions"],
        topic: ["topic", "topics"],
        structure: ["structure", "structures"],
        level: ["level", "levels"],
      };
      const counted = rows.length === 1 ? "1 lesson" : rows.length + " lessons";
      const lessonLabel = rows.length === index.lessons.length ? counted : counted + " of " + index.lessons.length;
      const pair = units[state.mode] || ["group", "groups"];
      const groupLabel = state.mode === "list" ? "" : " · " + groups.length + " " + (groups.length === 1 ? pair[0] : pair[1]);
      byId("status").textContent = "Page " + (state.page + 1) + " of " + pages + " · " + lessonLabel + groupLabel;

      let results = "";
      if (!index.lessons.length && filtersAreClear()) {
        results = emptyState("No lessons in the catalog yet.");
      } else if (state.mode === "list") {
        results = rows.length
          ? pageRows.map((lesson) => lessonArticle(lesson, { related: true })).join("") + pager(pages)
          : emptyState("Nothing matches these filters.");
      } else if (!groups.length) {
        results = emptyState("Nothing matches these filters.");
      } else {
        results = pageGroups.map(groupBlock).join("") + pager(pages);
      }
      byId("results").innerHTML = appearsHtml(rows) + results;
      renderLists();

      const discoverBody = byId("discover-body");
      if (discoverBody && state.pickId !== discoverStamp) {
        discoverStamp = state.pickId;
        const pick = index.lessons.find((lesson) => lesson.id === state.pickId);
        if (!pick) {
          discoverBody.innerHTML = '<p class="section-note">No lessons in the catalog yet.</p>';
        } else {
          const similar = Catalog.related(pick, index.lessons, 5);
          const relatedHtml = similar.length
            ? '<h3 class="subhead">Related</h3>' + similar.map((item) => lessonArticle(item.lesson, { shared: Catalog.relatedReason(item, pick) })).join("")
            : '<p class="section-note">No related lessons yet.</p>';
          discoverBody.innerHTML = lessonArticle(pick, { feature: true }) + relatedHtml;
        }
      }

      syncControls(pages);
      if (focusGroup) {
        const again = [...root.querySelectorAll("[data-group]")].find((node) => node.getAttribute("data-group") === focusGroup);
        if (again) again.focus();
      }
      if (scroll) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        byId("results").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }
    }

    function formatLong(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (hours >= 24) return hours + "h " + String(minutes).padStart(2, "0") + "m";
      return Catalog.formatDuration(seconds);
    }

    function stat(label, value) {
      return "<div><dt>" + esc(label) + "</dt><dd>" + esc(value) + "</dd></div>";
    }

    function syncControls(pages) {
      const query = byId("q");
      if (query && query.value !== state.query) query.value = state.query;
      for (const [id, key] of SELECTS) {
        const el = byId(id);
        if (el && el.value !== state[key]) el.value = state[key];
      }
      root.querySelectorAll("[data-mode]").forEach((button) => {
        button.setAttribute("aria-pressed", button.getAttribute("data-mode") === state.mode ? "true" : "false");
      });
      root.querySelectorAll("[data-group-only]").forEach((button) => {
        button.hidden = state.mode === "list";
      });
      const note = byId("facet-note");
      if (note) {
        const bits = [];
        if (MODE_NOTES[state.mode]) bits.push(MODE_NOTES[state.mode]);
        const instrumentNote = Catalog.facetNote(index, "instruments", state.instrument);
        const traditionNote = Catalog.facetNote(index, "traditions", state.tradition);
        if (instrumentNote) bits.push(instrumentNote);
        if (traditionNote) bits.push(traditionNote);
        note.hidden = bits.length === 0;
        note.textContent = bits.join(" ");
      }
      root.querySelectorAll('[data-action="prev"]').forEach((button) => {
        button.disabled = state.page === 0;
      });
      root.querySelectorAll('[data-action="next"]').forEach((button) => {
        button.disabled = state.page >= pages - 1;
      });
      const theme = themeTarget.getAttribute("data-theme") === "light" ? "light" : "dark";
      const themeButton = byId("theme");
      if (themeButton) {
        themeButton.textContent = theme === "light" ? "Dark theme" : "Light theme";
        themeButton.setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
      }
    }

    function toggleTheme() {
      const next = themeTarget.getAttribute("data-theme") === "light" ? "dark" : "light";
      themeTarget.setAttribute("data-theme", next);
      if (persistTheme) {
        try { localStorage.setItem("ylf-theme", next); } catch (error) {}
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", next === "light" ? "#f4f0e7" : "#12100d");
      }
      render(false);
    }

    function applyCleared(next) {
      state.channel = next.channel;
      state.instrument = next.instrument;
      state.style = next.style;
      state.tradition = next.tradition;
      state.topic = next.topic;
      state.structure = next.structure;
      state.level = next.level;
      state.inTheStyleOf = next.inTheStyleOf;
    }

    function runSearch(query, scroll) {
      state.query = query;
      state.page = 0;
      state.seedMode = true;
      applyCleared(clearedFilters(index, state, query));
      render(Boolean(scroll));
    }

    function clearFilters() {
      state.channel = defaults.channel;
      state.instrument = defaults.instrument;
      state.style = defaults.style;
      state.tradition = defaults.tradition;
      state.topic = defaults.topic;
      state.structure = defaults.structure;
      state.level = defaults.level;
      state.inTheStyleOf = defaults.inTheStyleOf;
      state.query = "";
      state.page = 0;
      state.seedMode = true;
    }

    function pivot(key, value) {
      if (!PIVOT_KEYS.includes(key) || !value) return;
      state.channel = "All";
      state.instrument = "All";
      state.style = "All";
      state.tradition = "All";
      state.topic = "All";
      state.structure = "All";
      state.level = "All";
      state.inTheStyleOf = "All";
      state.query = "";
      state.page = 0;
      state.seedMode = true;
      state[key] = value;
    }

    function downloadCsv(filename, text) {
      const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function scrollToDiscover() {
      const discover = byId("discover");
      if (!discover) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      discover.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }

    function onClick(event) {
      const el = event.target.closest("[data-action]");
      if (!el || el.disabled) return;
      const action = el.getAttribute("data-action");
      if (action === "mode") {
        state.mode = el.getAttribute("data-mode");
        state.page = 0;
        state.seedMode = true;
        render(false);
      } else if (action === "group") {
        const id = el.getAttribute("data-group");
        state.open[id] = !state.open[id];
        render(false);
      } else if (action === "prev") {
        state.page -= 1;
        render(true);
      } else if (action === "next") {
        state.page += 1;
        render(true);
      } else if (action === "expand") {
        for (const group of currentGroups(currentRows())) state.open[groupDomId(group.key)] = true;
        render(false);
      } else if (action === "collapse") {
        state.open = {};
        state.seedMode = false;
        render(false);
      } else if (action === "search") {
        runSearch(el.getAttribute("data-query") || "", true);
      } else if (action === "clear") {
        clearFilters();
        render(false);
      } else if (action === "csv") {
        if (!index) return;
        downloadCsv("yt-music-lesson-finder.csv", Catalog.toCsv(currentRows()));
      } else if (action === "play") {
        const wrap = el.closest(".thumb-wrap");
        const id = el.getAttribute("data-id") || "";
        if (!wrap || !id) return;
        wrap.innerHTML = '<iframe class="player" title="YouTube video player" width="320" height="180" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1"></iframe>';
      } else if (action === "pivot") {
        pivot(el.getAttribute("data-key"), el.getAttribute("data-value"));
        render(false);
      } else if (action === "similar") {
        state.pickId = el.getAttribute("data-id");
        render(false);
        scrollToDiscover();
      } else if (action === "random") {
        const list = index.lessons;
        if (!list.length) return;
        let next = list[Math.floor(Math.random() * list.length)];
        let guard = 0;
        while (list.length > 1 && next.id === state.pickId && guard < 8) {
          next = list[Math.floor(Math.random() * list.length)];
          guard += 1;
        }
        state.pickId = next.id;
        render(false);
        scrollToDiscover();
      } else if (action === "theme") {
        toggleTheme();
      }
    }

    function bind() {
      root.addEventListener("click", onClick);
      root.addEventListener("error", (event) => {
        const img = event.target;
        if (img && img.classList && img.classList.contains("thumb")) img.classList.add("is-broken");
      }, true);
      byId("q").addEventListener("input", (event) => {
        state.query = event.target.value;
        state.page = 0;
        render(false);
      });
      for (const [id, key] of SELECTS) {
        byId(id).addEventListener("change", (event) => {
          state[key] = event.target.value;
          state.page = 0;
          state.seedMode = true;
          render(false);
        });
      }
      root.addEventListener("keydown", (event) => {
        if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
        const tag = event.target && event.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        event.preventDefault();
        byId("q").focus();
      });
    }

    const lessons = Array.isArray(opts.lessons) ? opts.lessons : null;
    if (!lessons) throw new Error("lessons");
    index = Catalog.buildIndex(lessons, opts.facets || {});
    defaults = presets(opts, index);
    state.channel = defaults.channel;
    state.instrument = defaults.instrument;
    state.style = defaults.style;
    state.tradition = defaults.tradition;
    state.topic = defaults.topic;
    state.structure = defaults.structure;
    state.level = defaults.level;
    state.inTheStyleOf = defaults.inTheStyleOf;
    state.pickId = lessons[0] ? lessons[0].id : "";
    bind();
    const channelSelect = byId("channel");
    channelSelect.innerHTML = '<option value="All">All</option>' + index.channels.map((channel) => {
      const count = index.channelCount[channel.channel_id] || 0;
      return '<option value="' + esc(channel.channel_id) + '">' + esc(channel.channel_name) + " · " + count + "</option>";
    }).join("");
    fillSelect("instrument", index.instruments, (value) => facetLabel(value, "instrument"), (value) => Catalog.facetNote(index, "instruments", value));
    fillSelect("style", index.styles, (value) => facetLabel(value, "style"));
    fillSelect("style-of", index.styleArtists);
    fillSelect("tradition", index.traditions, (value) => facetLabel(value, "tradition"), (value) => Catalog.facetNote(index, "traditions", value));
    fillSelect("topic", index.topics, (value) => facetLabel(value, "topic"));
    fillSelect("structure", index.structures, (value) => facetLabel(value, "structure"));
    fillSelect("level", index.levels, (value) => facetLabel(value, "level"));
    const seconds = lessons.reduce((sum, lesson) => sum + (lesson.duration_seconds || 0), 0);
    const stats = byId("stats");
    if (stats) {
      stats.innerHTML =
        stat("Lessons", String(lessons.length)) +
        stat("Channels", String(index.channels.length)) +
        stat("Listening time", formatLong(seconds)) +
        stat("Instruments", String(Object.keys(index.instrumentCount).length)) +
        stat("Traditions", String(Object.keys(index.traditionCount).length));
    }
    const summary = byId("summary");
    if (summary) {
      summary.textContent = lessons.length
        ? lessons.length + " online music lessons on YouTube. Browse by channel, instrument, style, tradition, topic, structure, and level."
        : "No lessons in the catalog yet. Instrument and tradition filters load from the facet list.";
    }
    const channelCount = byId("channel-count");
    if (channelCount) {
      const count = index.channels.length;
      channelCount.textContent = count + " channel" + (count === 1 ? "" : "s");
    }
    const traditionCount = byId("tradition-count");
    if (traditionCount) {
      const count = index.traditions.length;
      traditionCount.textContent = count + " tradition" + (count === 1 ? "" : "s");
    }
    const styleOfCount = byId("style-of-count");
    if (styleOfCount) {
      const count = index.styleArtists.length;
      styleOfCount.textContent = count + " artist" + (count === 1 ? "" : "s");
    }
    render(false);
    return { root };
  }

  return { mount, shellHtml, presets, clearedFilters };
});
