"use strict";

(function () {
  const status = document.getElementById("status");
  if (typeof Catalog === "undefined" || typeof FinderView === "undefined") {
    if (status) status.textContent = "The page scripts did not load.";
    return;
  }
  const lessonsPromise = fetch("data/lessons.json").then((res) => {
    if (!res.ok) throw new Error("lessons");
    return res.json();
  });
  const facetsPromise = fetch("data/facets.json").then((res) => (res.ok ? res.json() : {})).catch(() => ({}));
  Promise.all([lessonsPromise, facetsPromise]).then(([lessons, facets]) => {
    FinderView.mount(document, {
      lessons,
      facets,
      themeTarget: document.documentElement,
      persistTheme: true,
    });
  }).catch(() => {
    if (status) status.textContent = "Could not load the lesson catalog. Serve this folder with a local web server so the JSON can be read.";
  });
})();
