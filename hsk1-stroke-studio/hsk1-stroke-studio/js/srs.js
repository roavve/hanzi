/* srs.js — spaced repetition scheduler
 * A compact SM-2 variant with short "learning steps" for new cards,
 * Anki-style grades: again | hard | good | easy.
 * Exposes window.SRS.
 */
(function () {
  "use strict";

  var DAY = 24 * 60 * 60 * 1000;
  // learning steps in minutes for a fresh / lapsed card
  var LEARN_STEPS = [1, 10];

  function now() { return Date.now(); }

  function freshCard(id) {
    return {
      id: id,
      status: "new",     // new | learning | review
      step: 0,           // index into LEARN_STEPS while learning
      ease: 2.5,
      interval: 0,       // days (review state)
      due: 0,            // timestamp; 0 = available now
      reps: 0,
      lapses: 0,
      seen: 0,           // total times shown
      correctStrokes: 0,
      mistakes: 0,
      lastGrade: null,
      introducedAt: null
    };
  }

  // Apply a grade. `mistakes` is how many stroke errors happened this rep.
  function grade(card, g) {
    card = card || freshCard(card && card.id);
    card.reps += 1;
    card.seen += 1;
    card.lastGrade = g;
    if (card.introducedAt == null) card.introducedAt = now();

    if (card.status === "new" || card.status === "learning") {
      handleLearning(card, g);
    } else {
      handleReview(card, g);
    }
    return card;
  }

  function handleLearning(card, g) {
    card.status = "learning";
    if (g === "again") {
      card.step = 0;
      card.due = now() + LEARN_STEPS[0] * 60 * 1000;
    } else if (g === "hard") {
      // stay on current step
      card.due = now() + LEARN_STEPS[Math.min(card.step, LEARN_STEPS.length - 1)] * 60 * 1000;
    } else if (g === "good") {
      card.step += 1;
      if (card.step >= LEARN_STEPS.length) {
        graduate(card, 1); // first review in 1 day
      } else {
        card.due = now() + LEARN_STEPS[card.step] * 60 * 1000;
      }
    } else if (g === "easy") {
      graduate(card, 4); // skip ahead
    }
  }

  function graduate(card, days) {
    card.status = "review";
    card.interval = days;
    card.due = now() + days * DAY;
  }

  function handleReview(card, g) {
    if (g === "again") {
      card.lapses += 1;
      card.ease = Math.max(1.3, card.ease - 0.2);
      card.status = "learning";
      card.step = 0;
      card.due = now() + LEARN_STEPS[0] * 60 * 1000;
      return;
    }
    var i = card.interval || 1;
    if (g === "hard") {
      card.ease = Math.max(1.3, card.ease - 0.15);
      card.interval = Math.max(1, Math.round(i * 1.2));
    } else if (g === "good") {
      card.interval = Math.max(1, Math.round(i * card.ease));
    } else if (g === "easy") {
      card.ease += 0.15;
      card.interval = Math.max(1, Math.round(i * card.ease * 1.3));
    }
    card.due = now() + card.interval * DAY;
  }

  function isDue(card) {
    if (!card) return false;
    return (card.due || 0) <= now();
  }

  // Human-readable preview of what each grade will do to a card.
  function previewIntervals(card) {
    function fmt(ms) {
      var min = ms / 60000;
      if (min < 60) return Math.round(min) + "m";
      var hr = min / 60;
      if (hr < 24) return Math.round(hr) + "h";
      var d = hr / 24;
      if (d < 30) return Math.round(d) + "d";
      return Math.round(d / 30) + "mo";
    }
    var out = {};
    ["again", "hard", "good", "easy"].forEach(function (g) {
      var c = JSON.parse(JSON.stringify(card || freshCard(0)));
      // simulate without committing reps side-effects we care about
      if (c.status === "new" || c.status === "learning") {
        c.status = c.status === "new" ? "new" : "learning";
        handleLearning(c, g);
      } else {
        handleReview(c, g);
      }
      out[g] = fmt(Math.max(0, (c.due || now()) - now()));
    });
    return out;
  }

  window.SRS = {
    fresh: freshCard,
    grade: grade,
    isDue: isDue,
    previewIntervals: previewIntervals
  };
})();
