/* La Grande Frise : une leçon d'histoire par jour, des dinosaures à aujourd'hui. */
(function () {
  "use strict";

  var STORE_KEY = "grande-frise:v1";
  // Intervalle (en jours) avant la prochaine révision, selon la boîte (1 à 5).
  var INTERVALS = [0, 1, 3, 7, 16, 35];

  var PERIODS = [], ERAS = [], byId = {}, N = 0;
  var all = [];        // toutes les leçons du fichier
  var lessons = [];    // leçons déjà publiées (date <= aujourd'hui)
  var selected = null; // numéro de la leçon affichée
  var followLatest = true;
  var revealed = {};
  var openPeriod = null;
  var progress = loadProgress();
  var review = { mode: "due", queue: [], flipped: false, done: 0 };
  var installPrompt = null;
  var loadedOn = null;

  /* ---------- Outils ---------- */
  function $(id) { return document.getElementById(id); }
  // Typographie française : espace insécable avant ? ! : ; » et après «, pour éviter les signes orphelins.
  function fr(s) { return String(s).replace(/ ([?!:;»])/g, " $1").replace(/« /g, "« "); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = fr(text);
    return e;
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function todayISO(d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return todayISO(d); }
  function fmtDate(iso, opts) {
    if (!iso) return "";
    var d = new Date(iso + "T12:00:00");
    if (isNaN(d)) return "";
    return d.toLocaleDateString("fr-FR", opts || { day: "numeric", month: "long", year: "numeric" });
  }
  function plural(n, one, many) { return n + " " + (n > 1 ? many : one); }

  function loadProgress() {
    try {
      var p = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (p && typeof p === "object") return { read: p.read || {}, cards: p.cards || {} };
    } catch (e) { /* stockage indisponible */ }
    return { read: {}, cards: {} };
  }
  function saveProgress() { try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) { /* ignoré */ } }

  /* ---------- Position sur la frise ---------- */
  function position(l) {
    var p = byId[l.period]; if (!p) return 0;
    var ago = typeof l.ago === "number" ? l.ago : p.start;
    var t = (p.start - ago) / (p.start - p.end);
    t = Math.max(0, Math.min(1, t));
    return (p.i + t) / N * 100;
  }
  // Tient compte des 4px d'écart entre les bandes.
  function leftCss(l) {
    var u = position(l) / 100 * N;
    var gaps = Math.min(Math.floor(u), N - 1);
    return "calc(" + (u / N * 100) + "% - " + (u / N * 4 * (N - 1)) + "px + " + (gaps * 4) + "px)";
  }
  function latest() { return lessons.length ? lessons[lessons.length - 1] : null; }
  function currentIndex() { var l = latest(); return l && byId[l.period] ? byId[l.period].i : -1; }

  /* ---------- Progression ---------- */
  function isRead(day) { return !!progress.read[day]; }
  function markRead(day) {
    var today = todayISO();
    progress.read[day] = today;
    if (!progress.cards[day]) progress.cards[day] = { box: 1, due: addDays(today, 1) };
    saveProgress();
    renderMeta(); renderLesson(); renderJournal(); renderBoxes();
  }
  function streak() {
    var days = {};
    Object.keys(progress.read).forEach(function (k) { days[progress.read[k]] = true; });
    var d = todayISO();
    if (!days[d]) d = addDays(d, -1);
    var n = 0;
    while (days[d]) { n++; d = addDays(d, -1); }
    return n;
  }
  function cardsList() {
    var known = {};
    lessons.forEach(function (l) { known[l.day] = l; });
    return Object.keys(progress.cards).map(Number).filter(function (d) { return known[d] && known[d].q; })
      .map(function (d) { return { day: d, lesson: known[d], box: progress.cards[d].box, due: progress.cards[d].due }; });
  }
  function dueCards() {
    var today = todayISO();
    return cardsList().filter(function (c) { return c.due <= today; })
      .sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : a.day - b.day; });
  }

  /* ---------- Frise ---------- */
  function buildFrise(root, compact) {
    root.textContent = "";
    root.classList.toggle("compact", !!compact);
    var ci = currentIndex();

    var eras = el("div", "eras");
    ERAS.forEach(function (e) {
      var count = PERIODS.filter(function (p) { return p.era === e.id; }).length;
      var d = el("div", "era", e.name);
      d.style.flexGrow = count; d.title = e.name;
      eras.appendChild(d);
    });
    root.appendChild(eras);

    var pins = el("div", "pins");
    lessons.forEach(function (l) {
      var t = el("button", "tick");
      t.type = "button";
      t.style.left = leftCss(l);
      t.title = "Leçon " + l.day + " · " + l.title;
      t.setAttribute("aria-label", t.title);
      if (l.day === selected) t.classList.add("sel");
      t.addEventListener("click", function () { go("#j" + l.day); });
      pins.appendChild(t);
    });
    var last = latest();
    if (last) {
      var h = el("div", "here");
      var pos = position(last);
      if (pos < 8) h.classList.add("start"); else if (pos > 92) h.classList.add("end");
      h.style.left = leftCss(last);
      h.appendChild(el("span", null, "Tu es ici · leçon " + last.day));
      h.appendChild(el("i"));
      pins.appendChild(h);
    }
    root.appendChild(pins);

    var bands = el("div", "bands");
    PERIODS.forEach(function (p) {
      var b = el("button", "band");
      b.type = "button";
      b.style.setProperty("--c", p.color);
      b.style.setProperty("--ink", p.ink);
      if (p.i > ci) b.classList.add("future");
      if (p.i === ci) b.classList.add("current");
      b.setAttribute("aria-label", p.name + ", " + p.range);
      b.appendChild(el("b", null, p.name));
      b.appendChild(el("small", null, p.range));
      b.addEventListener("click", function () { openPeriod = p.id; go("#frise"); scrollToPeriod(p.id); });
      bands.appendChild(b);
    });
    root.appendChild(bands);
  }
  function scrollCompactToCurrent() {
    var last = latest(); if (!last) return;
    var sc = document.querySelector("#view-aujourdhui .frise-scroll");
    if (!sc) return;
    var x = position(last) / 100 * sc.scrollWidth - sc.clientWidth / 2;
    sc.scrollLeft = Math.max(0, x);
  }

  /* ---------- Leçon ---------- */
  function renderLesson() {
    var box = $("lesson"); box.textContent = "";
    var l = lessons.filter(function (x) { return x.day === selected; })[0];
    if (!l) {
      var e = el("div", "empty");
      e.appendChild(el("p", "eyebrow", "Pas encore de leçon"));
      e.appendChild(el("h2", null, "La première leçon arrive bientôt"));
      var first = all[0];
      e.appendChild(el("p", null, first ? "Rendez-vous le " + fmtDate(first.date) + "." : "Les leçons apparaîtront ici, une par jour."));
      box.appendChild(e);
      return;
    }
    var p = byId[l.period] || PERIODS[0];

    var top = el("div", "lesson-top");
    var chip = el("span", "chip"); chip.style.setProperty("--c", p.color);
    chip.appendChild(el("i")); chip.appendChild(document.createTextNode(p.name));
    top.appendChild(chip);
    document.title = "Leçon " + l.day + " · " + l.title + " — La Grande Frise";
    top.appendChild(el("span", "day num", "Leçon " + l.day + " · " + fmtDate(l.date)));
    box.appendChild(top);

    box.appendChild(el("p", "when", l.when));
    box.appendChild(el("h2", null, l.title));
    if (l.place) box.appendChild(el("p", "place", l.place));

    var body = el("div", "body");
    (Array.isArray(l.body) ? l.body : [l.body]).forEach(function (par) { if (par) body.appendChild(el("p", null, par)); });
    box.appendChild(body);

    if (l.keep) {
      var k = el("div", "keep");
      k.appendChild(el("span", "eyebrow", "À retenir"));
      k.appendChild(el("p", null, l.keep));
      box.appendChild(k);
    }
    if (l.fact) {
      var f = el("div", "fact");
      f.appendChild(el("span", "eyebrow", "Le savais-tu ?"));
      f.appendChild(el("p", null, l.fact));
      box.appendChild(f);
    }
    if (l.q) {
      var qz = el("div", "quiz");
      qz.appendChild(el("span", "eyebrow", "Teste-toi"));
      qz.appendChild(el("p", "q", l.q));
      var ans = el("p", "a", l.a || "");
      ans.hidden = !revealed[l.day];
      var rb = el("button", "btn", revealed[l.day] ? "Masquer la réponse" : "Voir la réponse");
      rb.type = "button"; rb.id = "reveal-btn";
      rb.addEventListener("click", function () {
        revealed[l.day] = !revealed[l.day];
        ans.hidden = !revealed[l.day];
        rb.textContent = revealed[l.day] ? "Masquer la réponse" : "Voir la réponse";
      });
      qz.appendChild(rb); qz.appendChild(ans);
      box.appendChild(qz);
    }

    var act = el("div", "actions");
    if (isRead(l.day)) {
      act.appendChild(el("span", "done-note", "✓ Leçon lue · elle est dans tes révisions"));
    } else {
      var mb = el("button", "btn btn-primary", "J'ai lu cette leçon");
      mb.type = "button"; mb.id = "read-btn";
      mb.addEventListener("click", function () { markRead(l.day); });
      act.appendChild(mb);
    }
    box.appendChild(act);

    var idx = lessons.indexOf(l);
    var nav = el("div", "nav");
    var prev = el("button", "btn", "← Précédente"); prev.type = "button"; prev.id = "prev-btn";
    var next = el("button", "btn", "Suivante →"); next.type = "button"; next.id = "next-btn";
    prev.disabled = idx <= 0; next.disabled = idx >= lessons.length - 1;
    prev.addEventListener("click", function () { if (idx > 0) go("#j" + lessons[idx - 1].day); });
    next.addEventListener("click", function () { if (idx < lessons.length - 1) go("#j" + lessons[idx + 1].day); });
    nav.appendChild(prev); nav.appendChild(next);
    box.appendChild(nav);

    if (l === latest() && l.next) {
      var n = el("p", "next");
      n.appendChild(el("strong", null, "Demain : "));
      n.appendChild(document.createTextNode(fr(l.next)));
      box.appendChild(n);
    }
  }

  /* ---------- Périodes ---------- */
  function lessonItem(l) {
    var b = el("button", "jitem"); b.type = "button";
    b.appendChild(el("span", "d num", "J" + l.day));
    var mid = el("span");
    mid.appendChild(el("span", "t", l.title));
    mid.appendChild(el("span", "w", l.when));
    b.appendChild(mid);
    b.appendChild(el("span", "r", isRead(l.day) ? "lue" : ""));
    b.addEventListener("click", function () { go("#j" + l.day); });
    return b;
  }
  function renderPeriods() {
    var box = $("periods"); box.textContent = "";
    var ci = currentIndex();
    var counts = {};
    lessons.forEach(function (l) { counts[l.period] = (counts[l.period] || 0) + 1; });
    PERIODS.forEach(function (p) {
      var card = el("div", "period");
      card.id = "periode-" + p.id;
      card.style.setProperty("--c", p.color);
      var state;
      if (p.i > ci) { card.classList.add("future"); state = "à venir"; }
      else if (p.i === ci) { card.classList.add("current"); state = "en cours · " + plural(counts[p.id] || 0, "leçon", "leçons"); }
      else state = plural(counts[p.id] || 0, "leçon", "leçons");

      var head = el("button", "period-head"); head.type = "button";
      head.setAttribute("aria-expanded", String(openPeriod === p.id && p.i <= ci));
      head.appendChild(el("span", "swatch"));
      var mid = el("span");
      mid.appendChild(el("span", "pname", p.name));
      mid.appendChild(el("span", "range", p.range));
      mid.appendChild(el("span", "blurb", p.blurb));
      head.appendChild(mid);
      head.appendChild(el("span", "state num", state));
      if (p.i <= ci) head.addEventListener("click", function () { openPeriod = openPeriod === p.id ? null : p.id; renderPeriods(); });
      else head.setAttribute("aria-disabled", "true");
      card.appendChild(head);

      if (openPeriod === p.id && p.i <= ci) {
        var list = el("div", "period-lessons");
        lessons.filter(function (l) { return l.period === p.id; }).forEach(function (l) { list.appendChild(lessonItem(l)); });
        card.appendChild(list);
      }
      box.appendChild(card);
    });
  }
  function scrollToPeriod(id) {
    requestAnimationFrame(function () {
      var c = $("periode-" + id);
      if (c) c.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* ---------- Journal ---------- */
  function renderJournal() {
    var box = $("journal"); box.textContent = "";
    var q = ($("search").value || "").trim().toLowerCase();
    var list = lessons.filter(function (l) {
      if (!q) return true;
      var hay = [l.title, l.when, l.place, l.keep, l.fact].concat(l.body || []).join(" ").toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    $("journal-lede").textContent = lessons.length
      ? plural(lessons.length, "leçon apprise", "leçons apprises") + ", de la plus récente à la plus ancienne."
      : "Les leçons apparaîtront ici au fil des jours.";
    if (!list.length) { box.appendChild(el("p", "muted", q ? "Aucune leçon ne correspond à « " + q + " »." : "Aucune leçon pour l'instant.")); return; }
    var groups = [];
    list.forEach(function (l) {
      var g = groups[groups.length - 1];
      if (!g || g.period !== l.period) { g = { period: l.period, items: [] }; groups.push(g); }
      g.items.push(l);
    });
    groups.reverse().forEach(function (g) {
      var p = byId[g.period] || PERIODS[0];
      var wrap = el("div", "jgroup");
      var t = el("div", "jgroup-title"); t.style.setProperty("--c", p.color);
      t.appendChild(el("i")); t.appendChild(document.createTextNode(p.name));
      wrap.appendChild(t);
      g.items.slice().reverse().forEach(function (l) { wrap.appendChild(lessonItem(l)); });
      box.appendChild(wrap);
    });
  }

  /* ---------- Révision ---------- */
  function renderBoxes() {
    var box = $("boxes"); box.textContent = "";
    var cards = cardsList();
    var labels = ["chaque jour", "tous les 3 j", "tous les 7 j", "tous les 16 j", "maîtrisées"];
    for (var b = 1; b <= 5; b++) {
      var n = cards.filter(function (c) { return c.box === b; }).length;
      var d = el("div", "box");
      d.appendChild(el("span", "eyebrow", "Boîte " + b));
      d.appendChild(el("strong", "num", String(n)));
      d.appendChild(el("span", null, labels[b - 1]));
      var fill = el("div", "fill"); var i = el("i");
      i.style.width = (cards.length ? n / cards.length * 100 : 0) + "%";
      fill.appendChild(i); d.appendChild(fill);
      box.appendChild(d);
    }
    var due = dueCards().length;
    var badge = $("due-badge");
    badge.hidden = !due; badge.textContent = String(due);
  }
  function startReview(mode) {
    review.mode = mode;
    review.flipped = false;
    review.done = 0;
    if (mode === "due") review.queue = dueCards();
    else review.queue = cardsList().sort(function () { return Math.random() - 0.5; });
    renderReview();
  }
  function answer(knew) {
    var c = review.queue.shift();
    if (c && review.mode === "due") {
      var card = progress.cards[c.day];
      var today = todayISO();
      if (knew) { card.box = Math.min(5, card.box + 1); card.due = addDays(today, INTERVALS[card.box]); }
      else { card.box = 1; card.due = addDays(today, 1); }
      saveProgress();
      renderBoxes();
    }
    review.done++;
    review.flipped = false;
    renderReview();
  }
  function renderReview() {
    var box = $("review"); box.textContent = "";
    var cards = cardsList();
    var c = review.queue[0];

    if (!c) {
      var e = el("div", "card");
      if (!cards.length) {
        e.appendChild(el("p", "eyebrow", "Aucune carte"));
        e.appendChild(el("p", "q", "Lis ta première leçon pour créer ta première carte."));
        e.appendChild(el("p", "review-note", "Touche « J'ai lu cette leçon » en bas d'une leçon : sa question rejoint la boîte 1 et revient le lendemain."));
      } else {
        var due = dueCards().length;
        e.appendChild(el("p", "eyebrow", review.done ? "Session terminée" : "À jour"));
        e.appendChild(el("p", "q", review.done && review.mode === "due"
          ? "Bravo, " + plural(review.done, "carte révisée", "cartes révisées") + "."
          : due ? plural(due, "carte attend", "cartes attendent") + " ta révision." : "Rien à revoir aujourd'hui."));
        var next = cards.map(function (x) { return x.due; }).sort()[0];
        if (!due && next) e.appendChild(el("p", "review-note", "Prochaine révision le " + fmtDate(next, { weekday: "long", day: "numeric", month: "long" }) + "."));
        var act = el("div", "actions");
        if (due) {
          var sb = el("button", "btn btn-primary", "Commencer la révision"); sb.type = "button"; sb.id = "start-due";
          sb.addEventListener("click", function () { startReview("due"); });
          act.appendChild(sb);
        }
        var fb = el("button", "btn", "S'entraîner sur toutes les cartes"); fb.type = "button"; fb.id = "start-free";
        fb.addEventListener("click", function () { startReview("free"); });
        act.appendChild(fb);
        e.appendChild(act);
        if (!due) e.appendChild(el("p", "review-note", "L'entraînement libre ne change pas tes boîtes."));
      }
      box.appendChild(e);
      return;
    }

    var p = byId[c.lesson.period] || PERIODS[0];
    var card = el("div", "card");
    var meta = el("div", "card-meta");
    var chip = el("span", "chip"); chip.style.setProperty("--c", p.color);
    chip.appendChild(el("i")); chip.appendChild(document.createTextNode(p.name + " · J" + c.day));
    meta.appendChild(chip);
    meta.appendChild(el("span", "eyebrow num", (review.mode === "due" ? "Boîte " + c.box + " · " : "Entraînement · ") + "reste " + review.queue.length));
    card.appendChild(meta);
    card.appendChild(el("p", "q", c.lesson.q));

    var act = el("div", "actions");
    if (!review.flipped) {
      var fl = el("button", "btn btn-primary", "Voir la réponse"); fl.type = "button"; fl.id = "flip-btn";
      fl.addEventListener("click", function () { review.flipped = true; renderReview(); });
      act.appendChild(fl);
    } else {
      card.appendChild(el("p", "a", c.lesson.a));
      card.appendChild(el("p", "k", c.lesson.keep));
      var no = el("button", "btn btn-warn", "À revoir"); no.type = "button"; no.id = "no-btn";
      var yes = el("button", "btn btn-good", "Je savais"); yes.type = "button"; yes.id = "yes-btn";
      no.addEventListener("click", function () { answer(false); });
      yes.addEventListener("click", function () { answer(true); });
      act.appendChild(no); act.appendChild(yes);
    }
    card.appendChild(act);
    box.appendChild(card);
  }

  /* ---------- En-tête ---------- */
  function renderMeta() {
    var s = streak();
    $("streak").textContent = "Série : " + s + " j";
  }

  /* ---------- Navigation ---------- */
  var VIEWS = ["aujourdhui", "frise", "reviser", "journal"];
  function go(hash) {
    if (location.hash === hash) route(); else location.hash = hash;
  }
  function route() {
    var h = (location.hash || "").replace("#", "");
    var m = /^j(\d+)$/.exec(h);
    var view = VIEWS.indexOf(h) !== -1 ? h : "aujourdhui";
    if (m) {
      var day = parseInt(m[1], 10);
      if (lessons.some(function (l) { return l.day === day; })) {
        selected = day;
        var last = latest(); followLatest = !!last && last.day === day;
      }
    } else if (view === "aujourdhui" && latest()) {
      selected = latest().day; followLatest = true;
    }
    VIEWS.forEach(function (v) { $("view-" + v).hidden = v !== view; });
    document.querySelectorAll(".tabs a").forEach(function (a) {
      if (a.getAttribute("data-view") === view) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (view === "aujourdhui") {
      renderLesson();
      buildFrise($("frise-compact"), true);
      scrollCompactToCurrent();
      if (m) window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (view === "frise") { buildFrise($("frise-full"), false); renderPeriods(); }
    if (view === "reviser") { renderBoxes(); if (!review.queue.length) startReview("due"); else renderReview(); }
    if (view === "journal") renderJournal();
  }

  /* ---------- Données ---------- */
  function applyLessons() {
    var today = todayISO();
    loadedOn = today;
    lessons = all.filter(function (l) { return l && typeof l.day === "number" && l.date <= today; })
      .sort(function (a, b) { return a.day - b.day; });
    var last = latest();
    if (selected === null || followLatest || !lessons.some(function (l) { return l.day === selected; })) {
      selected = last ? last.day : null;
    }
    renderMeta();
    renderBoxes();
    route();
  }
  function fetchJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " : " + r.status);
      return r.json();
    });
  }
  function loadLessons() {
    return fetchJSON("data/lessons.json").then(function (d) { all = d.lessons || []; applyLessons(); });
  }
  function init() {
    fetchJSON("data/periods.json").then(function (d) {
      ERAS = d.eras; PERIODS = d.periods; N = PERIODS.length;
      PERIODS.forEach(function (p, i) { p.i = i; byId[p.id] = p; });
      return loadLessons();
    }).catch(function () {
      var box = $("lesson"); box.textContent = "";
      var e = el("div", "empty");
      e.appendChild(el("p", "eyebrow", "Hors connexion"));
      e.appendChild(el("h2", null, "Impossible de charger les leçons"));
      e.appendChild(el("p", null, "Vérifie ta connexion puis rouvre l'appli. Une fois chargées, les leçons restent disponibles hors connexion."));
      box.appendChild(e);
    });
  }

  window.addEventListener("hashchange", route);
  $("search").addEventListener("input", renderJournal);

  // Nouveau jour ou retour sur l'appli : on recharge pour faire apparaître la leçon du jour.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && PERIODS.length) {
      if (loadedOn !== todayISO()) loadLessons().catch(applyLessons);
      else renderMeta();
    }
  });

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    installPrompt = e;
    $("install-btn").hidden = false;
  });
  $("install-btn").addEventListener("click", function () {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.finally(function () { installPrompt = null; $("install-btn").hidden = true; });
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }

  renderMeta();
  init();
})();
