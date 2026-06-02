/* app.js — orchestration: routing + views + practice session.
 * Depends on data.js, storage.js, srs.js, speech.js, writer.js (all globals).
 */
(function () {
  "use strict";

  var DATA = window.HSK_DATA || [];
  var CHARS = window.HSK_CHARS || {};
  var byId = {};
  DATA.forEach(function (w) { byId[w.id] = w; });

  var MASTERED_INTERVAL = 21; // days of interval to count as "mastered"

  /* ---------- tiny DOM helper ---------- */
  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k.slice(0, 2) === "on" && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
      });
    }
    (kids || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* ---------- derived card helpers ---------- */
  function statusOf(id) {
    var c = Store.getCard(id);
    if (!c || c.status === "new" || c.introducedAt == null) return "new";
    if (c.status === "review" && c.interval >= MASTERED_INTERVAL) return "mastered";
    if (c.status === "review") return "review";
    return "learning";
  }

  function dueQueue(limitNew) {
    var due = [];
    var fresh = [];
    DATA.forEach(function (w) {
      var c = Store.getCard(w.id);
      if (!c || c.introducedAt == null) {
        fresh.push(w.id);
      } else if (SRS.isDue(c)) {
        due.push(w.id);
      }
    });
    // due cards first (oldest due first), then a budget of new ones in list order
    due.sort(function (a, b) {
      return (Store.getCard(a).due || 0) - (Store.getCard(b).due || 0);
    });
    var newBudget = fresh.slice(0, limitNew);
    return { due: due, fresh: newBudget };
  }

  function counts() {
    var c = { total: DATA.length, neu: 0, learning: 0, review: 0, mastered: 0, dueNow: 0 };
    DATA.forEach(function (w) {
      var s = statusOf(w.id);
      if (s === "new") c.neu++;
      else if (s === "learning") c.learning++;
      else if (s === "mastered") c.mastered++;
      else c.review++;
      var card = Store.getCard(w.id);
      if (card && card.introducedAt != null && SRS.isDue(card)) c.dueNow++;
    });
    c.introduced = c.total - c.neu;
    return c;
  }

  /* ---------- SVG bits ---------- */
  function progressRing(pct, size) {
    size = size || 120;
    var r = (size - 14) / 2, cx = size / 2, c = 2 * Math.PI * r;
    var off = c * (1 - pct);
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", size); svg.setAttribute("height", size);
    svg.setAttribute("class", "ring");
    function circle(cls) {
      var el = document.createElementNS(ns, "circle");
      el.setAttribute("cx", cx); el.setAttribute("cy", cx); el.setAttribute("r", r);
      el.setAttribute("class", cls); return el;
    }
    var bg = circle("ring-bg");
    var fg = circle("ring-fg");
    fg.setAttribute("stroke-dasharray", c);
    fg.setAttribute("stroke-dashoffset", c);
    requestAnimationFrame(function () { fg.setAttribute("stroke-dashoffset", off); });
    svg.appendChild(bg); svg.appendChild(fg);
    var label = document.createElementNS(ns, "text");
    label.setAttribute("x", cx); label.setAttribute("y", cx + 1);
    label.setAttribute("class", "ring-label");
    label.textContent = Math.round(pct * 100) + "%";
    svg.appendChild(label);
    return svg;
  }

  function sparkline(history) {
    var max = Math.max(1, history.reduce(function (m, d) { return Math.max(m, d.count); }, 0));
    var wrap = el("div", { class: "spark" });
    history.forEach(function (d) {
      var h = Math.round((d.count / max) * 100);
      var bar = el("span", {
        class: "spark-bar" + (d.count ? " on" : ""),
        title: d.date + " · " + d.count + " reviews"
      });
      bar.style.height = Math.max(4, h) + "%";
      wrap.appendChild(bar);
    });
    return wrap;
  }

  /* ===================================================================
   * HOME / DASHBOARD
   * =================================================================== */
  function renderHome(view) {
    var c = counts();
    var s = Store.stats;
    var acc = (s.totalStrokes + s.totalMistakes) > 0
      ? Math.round((s.totalStrokes / (s.totalStrokes + s.totalMistakes)) * 100) : 100;
    var goal = Store.settings.dailyGoal;
    var done = Store.reviewsToday();

    var hero = el("section", { class: "hero reveal" }, [
      el("div", { class: "hero-left" }, [
        el("p", { class: "eyebrow", text: greeting() + " · " + niceDate() }),
        el("h1", { class: "hero-title", html: "Write the<br><em>one hundred fifty</em>." }),
        el("p", { class: "hero-lede", text:
          "The foundation characters of Mandarin, one confident stroke at a time. " +
          "Trace, correct, repeat — until the order lives in your hand." }),
        el("div", { class: "hero-cta" }, [
          el("button", { class: "btn btn-primary", onclick: function () { go("#/practice"); } }, [
            (c.dueNow > 0 || c.neu > 0)
              ? "Begin session · " + (c.dueNow + Math.min(Store.settings.newPerSession, c.neu)) + " cards"
              : "Free practice"
          ]),
          el("button", { class: "btn btn-ghost", onclick: function () { go("#/browse"); } }, ["Browse all 150"])
        ])
      ]),
      el("div", { class: "hero-right" }, [
        el("div", { class: "ring-wrap" }, [
          progressRing(c.introduced / c.total, 150),
          el("p", { class: "ring-cap", html: c.introduced + " <span>/ " + c.total + " seen</span>" })
        ])
      ])
    ]);

    var stats = el("section", { class: "stat-row reveal", style: "--d:.05s" }, [
      statCard("Due now", c.dueNow, c.dueNow ? "ready to review" : "inbox zero", "cinnabar"),
      statCard("Mastered", c.mastered, "long-interval", "jade"),
      statCard("Learning", c.learning + c.review, "in rotation", "ink"),
      statCard("Stroke accuracy", acc + "%", s.totalStrokes + " clean strokes", "gold")
    ]);

    var today = el("section", { class: "panel reveal", style: "--d:.1s" }, [
      el("div", { class: "panel-head" }, [
        el("h2", { text: "Today" }),
        el("span", { class: "streak", html: "🔥 " + Store.streak() + " day streak" })
      ]),
      el("div", { class: "goal" }, [
        el("div", { class: "goal-bar" }, [
          (function () {
            var f = el("div", { class: "goal-fill" });
            f.style.width = Math.min(100, (done / goal) * 100) + "%";
            return f;
          })()
        ]),
        el("p", { class: "goal-cap", html: "<strong>" + done + "</strong> / " + goal + " reviews today" })
      ]),
      el("div", { class: "panel-head", style: "margin-top:22px" }, [
        el("h2", { text: "Last 30 days" }), el("span", { class: "muted", text: s.totalReviews + " total" })
      ]),
      sparkline(Store.history(30))
    ]);

    // distribution / mini legend
    var dist = el("section", { class: "panel reveal", style: "--d:.15s" }, [
      el("h2", { text: "Your collection" }),
      el("div", { class: "dist" }, [
        distSeg("New", c.neu, "new"),
        distSeg("Learning", c.learning, "learning"),
        distSeg("Reviewing", c.review, "review"),
        distSeg("Mastered", c.mastered, "mastered")
      ]),
      (function () {
        var bar = el("div", { class: "dist-bar" });
        [["new", c.neu], ["learning", c.learning], ["review", c.review], ["mastered", c.mastered]]
          .forEach(function (p) {
            if (!p[1]) return;
            var seg = el("span", { class: "ds ds-" + p[0] });
            seg.style.flex = p[1];
            bar.appendChild(seg);
          });
        return bar;
      })()
    ]);

    view.appendChild(el("div", { class: "wrap home" }, [hero, stats,
      el("div", { class: "two-col" }, [today, dist])]));
  }

  function statCard(label, val, sub, tone) {
    return el("div", { class: "stat stat-" + tone }, [
      el("div", { class: "stat-val", text: String(val) }),
      el("div", { class: "stat-label", text: label }),
      el("div", { class: "stat-sub", text: sub })
    ]);
  }
  function distSeg(label, n, cls) {
    return el("div", { class: "dist-item" }, [
      el("span", { class: "dot dot-" + cls }),
      el("span", { class: "dist-n", text: String(n) }),
      el("span", { class: "dist-l", text: label })
    ]);
  }

  /* ===================================================================
   * PRACTICE SESSION
   * =================================================================== */
  var Session = null;

  function renderPractice(view) {
    var q = dueQueue(Store.settings.newPerSession);
    var queue = q.due.concat(q.fresh);
    if (queue.length === 0) {
      // nothing scheduled — offer free practice over everything
      view.appendChild(emptyPractice());
      return;
    }
    Session = makeSession(queue);
    var stage = el("div", { class: "wrap" });
    view.appendChild(stage);
    Session.mountInto(stage);
  }

  function emptyPractice() {
    return el("div", { class: "wrap" }, [
      el("section", { class: "panel center reveal" }, [
        el("div", { class: "big-seal", text: "閑" }),
        el("h2", { text: "Nothing due — well done." }),
        el("p", { class: "muted", text: "Your reviews are all caught up. Practice freely, or come back later." }),
        el("div", { class: "hero-cta center" }, [
          el("button", { class: "btn btn-primary", onclick: function () { startFree(); } }, ["Free practice (all 150)"]),
          el("button", { class: "btn btn-ghost", onclick: function () { go("#/browse"); } }, ["Browse"])
        ])
      ])
    ]);
  }

  function startFree() {
    var ids = DATA.map(function (w) { return w.id; });
    shuffle(ids);
    Session = makeSession(ids, { free: true });
    var view = document.getElementById("view");
    clear(view);
    var stage = el("div", { class: "wrap" });
    view.appendChild(stage);
    Session.mountInto(stage);
  }

  function makeSession(queue, cfg) {
    cfg = cfg || {};
    var idx = 0;
    var charIdx = 0;
    var wordMistakes = 0;
    var live = null;       // current Writer instance
    var refs = {};
    var total = queue.length;
    var completedCount = 0;

    function curWord() { return byId[queue[idx]]; }
    function charsOf(w) {
      return w.simp.split("").filter(function (ch) { return /[\u4e00-\u9fff]/.test(ch); });
    }

    function mountInto(stage) {
      var root = el("section", { class: "session" });
      // top progress
      refs.bar = el("div", { class: "sess-fill" });
      var prog = el("div", { class: "sess-prog" }, [refs.bar]);
      refs.count = el("span", { class: "sess-count" });

      refs.pinyin = el("div", { class: "sess-pinyin" });
      refs.meaning = el("div", { class: "sess-meaning" });
      refs.dots = el("div", { class: "char-dots" });

      refs.stageBox = el("div", { class: "stage-box" });
      refs.seal = el("div", { class: "seal", text: "好" });
      refs.stageBox.appendChild(refs.seal);

      var controls = el("div", { class: "stage-controls" }, [
        iconBtn("Animate", "↻", function () { if (live) live.animate(); }),
        iconBtn("Hint", "?", function () { if (live) live.hint(); }),
        iconBtn("Outline", "◎", function () { toggleOutline(); }),
        iconBtn("Speak", "♪", function () { speakCur(); })
      ]);

      refs.grading = el("div", { class: "grading hidden" });

      root.appendChild(el("div", { class: "sess-top" }, [
        el("button", { class: "link-quiet", onclick: function () { go("#/"); } }, ["← End session"]),
        refs.count
      ]));
      root.appendChild(prog);
      root.appendChild(el("div", { class: "sess-card" }, [
        refs.pinyin, refs.meaning, refs.dots,
        refs.stageBox, controls, refs.grading
      ]));
      stage.appendChild(root);
      loadWord();
    }

    function loadWord() {
      charIdx = 0;
      wordMistakes = 0;
      refs.grading.classList.add("hidden");
      clear(refs.grading);
      var w = curWord();
      var card = Store.getCard(w.id);
      var isNew = !card || card.introducedAt == null;

      refs.count.textContent = (completedCount) + " / " + total +
        (isNew ? "  ·  new" : "  ·  review");
      refs.bar.style.width = (completedCount / total * 100) + "%";

      var showPinyin = Store.settings.showPinyinInQuiz || isNew;
      refs.pinyin.innerHTML = showPinyin
        ? '<span class="py">' + w.pinyin + "</span>"
        : '<button class="reveal-py">tap to reveal pinyin</button>';
      if (!showPinyin) {
        refs.pinyin.querySelector(".reveal-py").addEventListener("click", function () {
          refs.pinyin.innerHTML = '<span class="py">' + w.pinyin + "</span>";
        });
      }
      refs.meaning.textContent = (w.meaning || []).slice(0, 2).join(" · ");

      // char position dots
      clear(refs.dots);
      var chs = charsOf(w);
      chs.forEach(function (_, i) {
        refs.dots.appendChild(el("span", { class: "cd" + (i === 0 ? " active" : "") }));
      });
      if (Store.settings.autoSpeak) setTimeout(speakCur, 250);

      loadChar();
    }

    function loadChar() {
      var w = curWord();
      var chs = charsOf(w);
      var ch = chs[charIdx];
      // mark active dot
      Array.prototype.forEach.call(refs.dots.children, function (d, i) {
        d.classList.toggle("active", i === charIdx);
        d.classList.toggle("done", i < charIdx);
      });

      if (live) live.destroy();
      var box = el("div");
      // clear stage but keep seal
      Array.prototype.slice.call(refs.stageBox.querySelectorAll(".hw-host")).forEach(function (n) { n.remove(); });
      refs.stageBox.insertBefore(box, refs.seal);

      var size = stageSize();
      live = Writer.mount(box, ch, {
        mode: "quiz",
        size: size,
        showOutline: true,
        colorRadical: false
      });
      refs.outlineOn = true;

      live.quiz({
        onCorrectStroke: function () { Store.bumpStrokes(1); },
        onMistake: function () { wordMistakes++; Store.bumpMistakes(1); },
        onComplete: function (res) {
          charIdx++;
          if (charIdx < chs.length) {
            // brief beat, then next character of the word
            setTimeout(loadChar, 420);
          } else {
            finishWord();
          }
        }
      });
    }

    function finishWord() {
      // seal stamp
      refs.seal.classList.remove("stamp");
      void refs.seal.offsetWidth;
      refs.seal.classList.add("stamp");
      setTimeout(showGrading, 520);
    }

    function showGrading() {
      var w = curWord();
      var card = Store.getCard(w.id) || SRS.fresh(w.id);
      var prev = SRS.previewIntervals(card);
      var suggested = wordMistakes === 0 ? "good" : (wordMistakes <= 2 ? "hard" : "again");

      clear(refs.grading);
      refs.grading.appendChild(el("p", { class: "grade-q",
        text: wordMistakes === 0 ? "Clean! How did that feel?"
          : wordMistakes + (wordMistakes === 1 ? " mistake" : " mistakes") + " — how did that feel?" }));

      var row = el("div", { class: "grade-row" });
      [["again", "Again"], ["hard", "Hard"], ["good", "Good"], ["easy", "Easy"]]
        .forEach(function (g) {
          var b = el("button", {
            class: "grade-btn g-" + g[0] + (g[0] === suggested ? " suggested" : ""),
            onclick: function () { gradeAndNext(g[0]); }
          }, [
            el("span", { class: "g-label", text: g[1] }),
            el("span", { class: "g-int", text: prev[g[0]] })
          ]);
          row.appendChild(b);
        });
      refs.grading.appendChild(row);
      refs.grading.classList.remove("hidden");
    }

    function gradeAndNext(g) {
      var w = curWord();
      var card = Store.getCard(w.id) || SRS.fresh(w.id);
      card.correctStrokes = (card.correctStrokes || 0);
      card.mistakes = (card.mistakes || 0) + wordMistakes;
      var updated = SRS.grade(card, g);
      Store.setCard(w.id, updated);
      Store.recordReview();

      refs.seal.classList.remove("stamp");
      completedCount++;
      idx++;
      if (idx >= queue.length) {
        sessionDone();
      } else {
        loadWord();
      }
    }

    function sessionDone() {
      var stage = document.querySelector(".session");
      var c = counts();
      clear(stage);
      stage.appendChild(el("div", { class: "done reveal" }, [
        el("div", { class: "big-seal", text: "畢" }),
        el("h2", { text: "Session complete" }),
        el("p", { class: "muted", text: "You reviewed " + total + (total === 1 ? " card." : " cards.") }),
        el("div", { class: "done-stats" }, [
          miniStat(c.dueNow, "still due"),
          miniStat(c.mastered, "mastered"),
          miniStat(Store.streak(), "day streak")
        ]),
        el("div", { class: "hero-cta center" }, [
          el("button", { class: "btn btn-primary", onclick: function () { go("#/"); } }, ["Back to studio"]),
          (c.dueNow > 0
            ? el("button", { class: "btn btn-ghost", onclick: function () { go("#/practice"); } }, ["Keep going"])
            : null)
        ])
      ]));
    }

    function toggleOutline() {
      if (!live) return;
      refs.outlineOn = !refs.outlineOn;
      if (refs.outlineOn) live.showOutline(); else live.hideOutline();
    }
    function speakCur() { if (window.Speech) Speech.speak(curWord().simp); }

    return { mountInto: mountInto };
  }

  function miniStat(v, l) {
    return el("div", { class: "mini" }, [
      el("div", { class: "mini-v", text: String(v) }),
      el("div", { class: "mini-l", text: l })
    ]);
  }
  function iconBtn(label, glyph, fn) {
    return el("button", { class: "icon-btn", title: label, onclick: fn }, [
      el("span", { class: "ib-glyph", text: glyph }),
      el("span", { class: "ib-label", text: label })
    ]);
  }
  function stageSize() {
    var w = Math.min(window.innerWidth - 64, 340);
    return Math.max(220, w);
  }

  /* ===================================================================
   * BROWSE
   * =================================================================== */
  var browseState = { filter: "all", q: "" };

  function renderBrowse(view) {
    var wrap = el("div", { class: "wrap" });
    var head = el("section", { class: "browse-head reveal" }, [
      el("div", {}, [
        el("h1", { class: "page-title", text: "The 150" }),
        el("p", { class: "muted", text: "Every HSK 1 word. Tap any to study its strokes." })
      ]),
      (function () {
        var search = el("input", {
          class: "search", type: "search", placeholder: "search hanzi, pinyin, meaning…",
          value: browseState.q
        });
        search.addEventListener("input", function () {
          browseState.q = search.value.toLowerCase();
          paint();
        });
        return search;
      })()
    ]);

    var filters = el("div", { class: "filters reveal", style: "--d:.05s" });
    [["all", "All"], ["new", "New"], ["learning", "Learning"], ["review", "Reviewing"], ["mastered", "Mastered"]]
      .forEach(function (f) {
        var b = el("button", {
          class: "chip" + (browseState.filter === f[0] ? " on" : ""),
          onclick: function () { browseState.filter = f[0]; paint(); }
        }, [f[1]]);
        b.dataset.f = f[0];
        filters.appendChild(b);
      });

    var grid = el("div", { class: "grid" });

    function paint() {
      Array.prototype.forEach.call(filters.children, function (b) {
        b.classList.toggle("on", b.dataset.f === browseState.filter);
      });
      clear(grid);
      var q = browseState.q.trim();
      var list = DATA.filter(function (w) {
        var s = statusOf(w.id);
        if (browseState.filter !== "all" && s !== browseState.filter) return false;
        if (!q) return true;
        return w.simp.indexOf(q) >= 0 ||
          (w.pinyin || "").toLowerCase().indexOf(q) >= 0 ||
          (w.meaning || []).join(" ").toLowerCase().indexOf(q) >= 0;
      });
      if (!list.length) {
        grid.appendChild(el("p", { class: "muted center", text: "No matches." }));
        return;
      }
      list.forEach(function (w, i) {
        var s = statusOf(w.id);
        var card = el("button", {
          class: "tile reveal", style: "--d:" + (i % 12) * 0.012 + "s",
          onclick: function () { go("#/word/" + w.id); }
        }, [
          el("span", { class: "tile-dot dot-" + s, title: s }),
          el("span", { class: "tile-han " + (Store.settings.script === "trad" ? "" : ""),
            text: Store.settings.script === "trad" ? w.trad : w.simp }),
          el("span", { class: "tile-py", text: w.pinyin }),
          el("span", { class: "tile-mean", text: (w.meaning || [])[0] || "" })
        ]);
        grid.appendChild(card);
      });
    }

    wrap.appendChild(head);
    wrap.appendChild(filters);
    wrap.appendChild(grid);
    view.appendChild(wrap);
    paint();
  }

  /* ===================================================================
   * WORD DETAIL
   * =================================================================== */
  function renderDetail(view, id) {
    var w = byId[id];
    if (!w) { go("#/browse"); return; }
    var chs = w.simp.split("").filter(function (ch) { return /[\u4e00-\u9fff]/.test(ch); });
    var status = statusOf(w.id);
    var card = Store.getCard(w.id);

    var wrap = el("div", { class: "wrap detail" });
    wrap.appendChild(el("button", { class: "link-quiet", onclick: function () { history.back(); } }, ["← Back"]));

    var header = el("section", { class: "detail-head reveal" }, [
      el("div", {}, [
        el("h1", { class: "detail-han", text: Store.settings.script === "trad" ? w.trad : w.simp }),
        el("p", { class: "detail-py", text: w.pinyin }),
        el("p", { class: "detail-mean", text: (w.meaning || []).join("; ") }),
        el("div", { class: "detail-tags" }, [
          el("span", { class: "tag dot-" + status, text: status }),
          w.trad !== w.simp ? el("span", { class: "tag tag-ghost", text: "trad " + w.trad }) : null,
          (w.pos && w.pos.length) ? el("span", { class: "tag tag-ghost", text: w.pos.join(" / ") }) : null
        ]),
        el("div", { class: "hero-cta" }, [
          el("button", { class: "btn btn-primary", onclick: function () { studyOne(id); } }, ["Practice strokes"]),
          el("button", { class: "btn btn-ghost", onclick: function () { if (window.Speech) Speech.speak(w.simp); } }, ["♪ Hear it"])
        ])
      ])
    ]);
    wrap.appendChild(header);

    // animated demo of each character
    var demoRow = el("section", { class: "demo-row reveal", style: "--d:.08s" });
    wrap.appendChild(demoRow);
    view.appendChild(wrap);

    var instances = [];
    chs.forEach(function (ch, i) {
      var box = el("div");
      var cell = el("div", { class: "demo-cell" }, [box,
        el("button", { class: "demo-replay", text: "↻ replay" })]);
      demoRow.appendChild(cell);
      var inst = Writer.mount(box, ch, { mode: "demo", size: 200, showOutline: true, colorRadical: true });
      instances.push(inst);
      cell.querySelector(".demo-replay").addEventListener("click", function () { inst.animate(); });
      // stagger the intro animations
      setTimeout(function () { inst.writer.hideCharacter(); inst.animate(); }, 350 + i * 700);
    });

    // related words sharing a character
    var related = relatedWords(w);
    if (related.length) {
      var rel = el("section", { class: "panel reveal", style: "--d:.12s" }, [
        el("h2", { text: "Shares a character with" }),
        (function () {
          var row = el("div", { class: "rel-row" });
          related.slice(0, 12).forEach(function (rw) {
            row.appendChild(el("button", {
              class: "rel-pill", onclick: function () { go("#/word/" + rw.id); }
            }, [
              el("span", { class: "rel-han", text: rw.simp }),
              el("span", { class: "rel-py", text: rw.pinyin })
            ]));
          });
          return row;
        })()
      ]);
      wrap.appendChild(rel);
    }

    if (card && card.introducedAt != null) {
      wrap.appendChild(el("section", { class: "panel reveal", style: "--d:.16s" }, [
        el("h2", { text: "Memory" }),
        el("div", { class: "memory" }, [
          memItem(card.reps, "reviews"),
          memItem(card.lapses, "lapses"),
          memItem(card.interval + "d", "interval"),
          memItem(dueLabel(card), "next due")
        ])
      ]));
    }
  }
  function memItem(v, l) {
    return el("div", { class: "mem" }, [
      el("div", { class: "mem-v", text: String(v) }),
      el("div", { class: "mem-l", text: l })
    ]);
  }
  function dueLabel(card) {
    var ms = (card.due || 0) - Date.now();
    if (ms <= 0) return "now";
    var d = ms / 86400000;
    if (d < 1) return Math.round(ms / 3600000) + "h";
    return Math.round(d) + "d";
  }

  function relatedWords(w) {
    var set = {};
    w.simp.split("").forEach(function (ch) {
      (CHARS[ch] || []).forEach(function (id) { if (id !== w.id) set[id] = true; });
    });
    return Object.keys(set).map(function (id) { return byId[id]; }).filter(Boolean);
  }

  function studyOne(id) {
    Session = makeSession([id], { free: true });
    var view = document.getElementById("view");
    clear(view);
    var stage = el("div", { class: "wrap" });
    view.appendChild(stage);
    Session.mountInto(stage);
  }

  /* ===================================================================
   * SETTINGS
   * =================================================================== */
  function renderSettings(view) {
    var st = Store.settings;
    var wrap = el("div", { class: "wrap settings" });
    wrap.appendChild(el("h1", { class: "page-title reveal", text: "Settings" }));

    var p = el("section", { class: "panel reveal", style: "--d:.05s" });

    p.appendChild(rangeRow("New words per session", "newPerSession", st.newPerSession, 1, 20, 1,
      function (v) { return v + " new"; }));
    p.appendChild(rangeRow("Daily review goal", "dailyGoal", st.dailyGoal, 5, 60, 5,
      function (v) { return v + " / day"; }));
    p.appendChild(rangeRow("Stroke leniency", "leniency", Math.round(st.leniency * 100), 50, 150, 10,
      function (v) { return v < 90 ? "strict" : v > 110 ? "relaxed" : "balanced"; },
      function (v) { return v / 100; }));
    p.appendChild(rangeRow("Hint after N misses", "hintAfterMisses", st.hintAfterMisses, 1, 8, 1,
      function (v) { return v + " misses"; }));

    p.appendChild(toggleRow("Show pinyin while drawing", "showPinyinInQuiz", st.showPinyinInQuiz));
    p.appendChild(toggleRow("Speak word automatically", "autoSpeak", st.autoSpeak));
    p.appendChild(choiceRow("Character set", "script", st.script,
      [["simp", "Simplified"], ["trad", "Traditional"]]));

    wrap.appendChild(p);

    var voiceNote = window.Speech && Speech.supported()
      ? (Speech.hasVoice() ? "Mandarin voice detected — audio ready."
        : "No Mandarin voice installed in this browser; audio may be silent.")
      : "This browser has no speech synthesis.";

    wrap.appendChild(el("section", { class: "panel reveal", style: "--d:.1s" }, [
      el("h2", { text: "Data" }),
      el("p", { class: "muted small", text: voiceNote }),
      el("div", { class: "hero-cta" }, [
        el("button", { class: "btn btn-ghost", onclick: exportData }, ["Export progress"]),
        el("button", { class: "btn btn-ghost", onclick: importData }, ["Import progress"]),
        el("button", { class: "btn btn-danger", onclick: resetData }, ["Reset everything"])
      ])
    ]));

    view.appendChild(wrap);
  }

  function rangeRow(label, key, val, min, max, step, fmt, transform) {
    var out = el("div", { class: "set-row" });
    var cap = el("span", { class: "set-val", text: fmt(val) });
    var input = el("input", { type: "range", min: min, max: max, step: step, value: val });
    input.addEventListener("input", function () {
      var v = Number(input.value);
      cap.textContent = fmt(v);
      Store.setSetting(key, transform ? transform(v) : v);
    });
    out.appendChild(el("label", { class: "set-label", text: label }));
    out.appendChild(el("div", { class: "set-control" }, [input, cap]));
    return out;
  }
  function toggleRow(label, key, val) {
    var input = el("input", { type: "checkbox" });
    if (val) input.checked = true;
    input.addEventListener("change", function () { Store.setSetting(key, input.checked); });
    var sw = el("label", { class: "switch" }, [input, el("span", { class: "slider" })]);
    return el("div", { class: "set-row" }, [el("label", { class: "set-label", text: label }), sw]);
  }
  function choiceRow(label, key, val, opts) {
    var seg = el("div", { class: "seg" });
    opts.forEach(function (o) {
      var b = el("button", {
        class: "seg-btn" + (val === o[0] ? " on" : ""),
        onclick: function () {
          Store.setSetting(key, o[0]);
          Array.prototype.forEach.call(seg.children, function (c) { c.classList.remove("on"); });
          b.classList.add("on");
        }
      }, [o[1]]);
      seg.appendChild(b);
    });
    return el("div", { class: "set-row" }, [el("label", { class: "set-label", text: label }), seg]);
  }

  function exportData() {
    var blob = new Blob([Store.exportJSON()], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ink-studio-progress.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function importData() {
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json";
    inp.onchange = function () {
      var f = inp.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try { Store.importJSON(r.result); applyTheme(); reroute(); }
        catch (e) { alert("Could not read that file."); }
      };
      r.readAsText(f);
    };
    inp.click();
  }
  function resetData() {
    if (confirm("Reset all progress, stats, and scheduling? This cannot be undone.")) {
      Store.resetProgress();
      reroute();
    }
  }

  /* ===================================================================
   * ROUTER + CHROME
   * =================================================================== */
  function go(hash) { if (location.hash === hash) reroute(); else location.hash = hash; }

  function reroute() {
    var view = document.getElementById("view");
    if (Session) Session = null;
    clear(view);
    window.scrollTo(0, 0);
    var hash = location.hash || "#/";
    var parts = hash.replace(/^#\//, "").split("/");
    var route = parts[0] || "home";

    setActiveNav(route || "home");

    if (route === "" || route === "home") renderHome(view);
    else if (route === "practice") renderPractice(view);
    else if (route === "browse") renderBrowse(view);
    else if (route === "word") renderDetail(view, Number(parts[1]));
    else if (route === "settings") renderSettings(view);
    else renderHome(view);
  }

  function setActiveNav(route) {
    document.querySelectorAll("#nav a").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-route") === route);
    });
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", Store.settings.theme);
  }

  function greeting() {
    var h = new Date().getHours();
    if (h < 5) return "Late night";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }
  function niceDate() {
    return new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- boot ---------- */
  function boot() {
    applyTheme();

    document.getElementById("themeToggle").addEventListener("click", function () {
      var next = Store.settings.theme === "paper" ? "night" : "paper";
      Store.setSetting("theme", next);
      applyTheme();
    });
    document.getElementById("navBurger").addEventListener("click", function () {
      document.getElementById("nav").classList.toggle("open");
    });
    document.querySelectorAll("#nav a").forEach(function (a) {
      a.addEventListener("click", function () { document.getElementById("nav").classList.remove("open"); });
    });

    window.addEventListener("hashchange", reroute);
    window.addEventListener("resize", function () {
      // keep stage square if a session is live and viewport changes a lot
    });
    reroute();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
