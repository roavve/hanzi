/* storage.js — persistence layer (localStorage)
 * Namespaced under "inkstudio.v1". All reads are defensive so a corrupt
 * value never breaks the app. Exposes window.Store.
 */
(function () {
  "use strict";

  var KEY = "inkstudio.v1";

  var DEFAULTS = {
    settings: {
      theme: "paper",          // "paper" | "night"
      newPerSession: 8,        // new words introduced per session
      dailyGoal: 20,           // reviews per day target
      script: "simp",          // "simp" | "trad"
      leniency: 1.0,           // stroke matching strictness (0.5 strict .. 1.5 loose)
      showPinyinInQuiz: true,  // reveal pinyin while drawing
      hintAfterMisses: 3,      // auto-highlight stroke after N misses
      autoSpeak: true          // speak word on reveal
    },
    // per-word SRS + accuracy record, keyed by word id
    cards: {},
    // daily review counts, keyed by YYYY-MM-DD
    daily: {},
    stats: {
      totalStrokes: 0,         // correct strokes drawn
      totalMistakes: 0,
      totalReviews: 0,
      lastActive: null         // YYYY-MM-DD
    },
    createdAt: Date.now()
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function deepMerge(base, over) {
    var out = clone(base);
    if (!over || typeof over !== "object") return out;
    Object.keys(over).forEach(function (k) {
      if (over[k] && typeof over[k] === "object" && !Array.isArray(over[k]) &&
          base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
        out[k] = deepMerge(base[k], over[k]);
      } else {
        out[k] = over[k];
      }
    });
    return out;
  }

  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULTS);
      return deepMerge(DEFAULTS, JSON.parse(raw));
    } catch (e) {
      console.warn("Store: load failed, using defaults", e);
      return clone(DEFAULTS);
    }
  }

  var saveTimer = null;
  function persist() {
    // debounce writes a touch to avoid hammering localStorage during a quiz
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (e) { console.warn("Store: save failed", e); }
    }, 120);
  }

  function todayKey(d) {
    d = d || new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  var Store = {
    todayKey: todayKey,

    // ---- settings ----
    get settings() { return state.settings; },
    setSetting: function (k, v) { state.settings[k] = v; persist(); },

    // ---- cards ----
    getCard: function (id) { return state.cards[id] || null; },
    allCards: function () { return state.cards; },
    setCard: function (id, card) { state.cards[id] = card; persist(); },

    // ---- stats / daily ----
    get stats() { return state.stats; },
    bumpStrokes: function (n) { state.stats.totalStrokes += (n || 0); persist(); },
    bumpMistakes: function (n) { state.stats.totalMistakes += (n || 0); persist(); },

    recordReview: function () {
      var k = todayKey();
      state.daily[k] = (state.daily[k] || 0) + 1;
      state.stats.totalReviews += 1;
      state.stats.lastActive = k;
      persist();
    },

    reviewsToday: function () { return state.daily[todayKey()] || 0; },
    daily: function () { return state.daily; },

    // consecutive-day streak ending today (or yesterday if nothing yet today)
    streak: function () {
      var days = state.daily;
      var count = 0;
      var d = new Date();
      // if nothing today, streak can still stand if yesterday had activity
      if (!days[todayKey(d)]) d.setDate(d.getDate() - 1);
      while (days[todayKey(d)] && days[todayKey(d)] > 0) {
        count++;
        d.setDate(d.getDate() - 1);
      }
      return count;
    },

    // last N days of review counts, oldest -> newest
    history: function (n) {
      n = n || 30;
      var out = [];
      var d = new Date();
      d.setDate(d.getDate() - (n - 1));
      for (var i = 0; i < n; i++) {
        var k = todayKey(d);
        out.push({ date: k, count: state.daily[k] || 0 });
        d.setDate(d.getDate() + 1);
      }
      return out;
    },

    // ---- maintenance ----
    exportJSON: function () { return JSON.stringify(state, null, 2); },
    importJSON: function (raw) {
      var parsed = JSON.parse(raw);
      state = deepMerge(DEFAULTS, parsed);
      persist();
    },
    resetProgress: function () {
      var theme = state.settings.theme;
      state = clone(DEFAULTS);
      state.settings.theme = theme; // keep visual pref
      persist();
    }
  };

  window.Store = Store;
})();
