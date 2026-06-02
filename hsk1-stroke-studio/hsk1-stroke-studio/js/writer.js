/* writer.js — thin wrapper over the Hanzi Writer library.
 * Handles theming (reads CSS vars), the 米字格 practice grid, and exposes
 * promise-friendly animate / quiz helpers. Exposes window.Writer.
 */
(function () {
  "use strict";

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function palette() {
    return {
      stroke: cssVar("--ink", "#211d18"),
      radical: cssVar("--cinnabar", "#b83a2e"),
      outline: cssVar("--hw-outline", "#d9d0bf"),
      drawing: cssVar("--cinnabar", "#b83a2e"),
      highlight: cssVar("--gold", "#b08d57")
    };
  }

  // Inject the traditional practice grid (border, cross, diagonals) as an SVG
  // sitting *behind* the Hanzi Writer SVG.
  function gridSVG(size) {
    var c = cssVar("--grid-line", "rgba(184,58,46,0.28)");
    var s = size;
    return (
      '<svg class="tzg" width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + ' ' + s + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect x="1" y="1" width="' + (s - 2) + '" height="' + (s - 2) + '" fill="none" stroke="' + c + '" stroke-width="1.5"/>' +
      '<line x1="' + s / 2 + '" y1="0" x2="' + s / 2 + '" y2="' + s + '" stroke="' + c + '" stroke-width="1" stroke-dasharray="5 5"/>' +
      '<line x1="0" y1="' + s / 2 + '" x2="' + s + '" y2="' + s / 2 + '" stroke="' + c + '" stroke-width="1" stroke-dasharray="5 5"/>' +
      '<line x1="0" y1="0" x2="' + s + '" y2="' + s + '" stroke="' + c + '" stroke-width="1" stroke-dasharray="5 5"/>' +
      '<line x1="' + s + '" y1="0" x2="0" y2="' + s + '" stroke="' + c + '" stroke-width="1" stroke-dasharray="5 5"/>' +
      "</svg>"
    );
  }

  /* Mount a character into a host element. Returns an object with the
   * live HanziWriter instance plus helpers. `opts.mode` = "demo" | "quiz".
   */
  function mount(host, char, opts) {
    opts = opts || {};
    var size = opts.size || 300;
    host.classList.add("hw-host");
    host.style.width = size + "px";
    host.style.height = size + "px";
    host.innerHTML = gridSVG(size);

    var target = document.createElement("div");
    target.className = "hw-target";
    host.appendChild(target);

    var pal = palette();
    var settings = (window.Store && window.Store.settings) || {};

    var writer = HanziWriter.create(target, char, {
      width: size,
      height: size,
      padding: Math.round(size * 0.06),
      showOutline: opts.showOutline !== false,
      showCharacter: opts.mode === "demo",
      strokeColor: pal.stroke,
      radicalColor: opts.colorRadical ? pal.radical : pal.stroke,
      outlineColor: pal.outline,
      drawingColor: pal.drawing,
      highlightColor: pal.highlight,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 180,
      strokeFadeDuration: 300,
      charDataLoader: undefined // default jsDelivr loader
    });

    var api = {
      writer: writer,
      host: host,
      destroy: function () {
        try { writer.cancelQuiz(); } catch (e) {}
        host.innerHTML = "";
      },
      animate: function () {
        return new Promise(function (res) {
          writer.animateCharacter({ onComplete: res });
        });
      },
      showOutline: function () { writer.showOutline(); },
      hideOutline: function () { writer.hideOutline(); },
      // Run a quiz; resolves with { mistakes } when the character is complete.
      quiz: function (cb) {
        cb = cb || {};
        var mistakes = 0;
        api._curStroke = 0; // index of the stroke the learner is working on
        writer.quiz({
          leniency: settings.leniency || 1.0,
          showHintAfterMisses: settings.hintAfterMisses || 3,
          highlightOnComplete: true,
          onCorrectStroke: function (info) {
            api._curStroke = (info && typeof info.strokeNum === "number")
              ? info.strokeNum + 1 : api._curStroke + 1;
            if (cb.onCorrectStroke) cb.onCorrectStroke(info);
          },
          onMistake: function (info) {
            mistakes++;
            if (cb.onMistake) cb.onMistake(info, mistakes);
          },
          onComplete: function (summary) {
            if (cb.onComplete) cb.onComplete({ mistakes: mistakes, summary: summary });
          }
        });
      },
      hint: function () {
        // animate just the stroke the learner is currently stuck on
        try { writer.animateStroke(api._curStroke || 0); }
        catch (e) { try { writer.animateCharacter(); } catch (e2) {} }
      }
    };

    return api;
  }

  window.Writer = { mount: mount, palette: palette };
})();
