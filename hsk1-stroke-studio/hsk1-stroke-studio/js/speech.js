/* speech.js — Mandarin pronunciation via the browser's Web Speech API.
 * No network, no dependency. Gracefully no-ops if no zh voice exists.
 * Exposes window.Speech.
 */
(function () {
  "use strict";

  var synth = window.speechSynthesis || null;
  var zhVoice = null;
  var ready = false;

  function pickVoice() {
    if (!synth) return;
    var voices = synth.getVoices() || [];
    // prefer a mainland Mandarin voice, then any Chinese voice
    zhVoice =
      voices.find(function (v) { return /zh[-_]CN/i.test(v.lang); }) ||
      voices.find(function (v) { return /^zh/i.test(v.lang); }) ||
      voices.find(function (v) { return /chinese|mandarin/i.test(v.name); }) ||
      null;
    ready = true;
  }

  if (synth) {
    pickVoice();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = pickVoice;
    }
    // some browsers populate voices a beat late
    setTimeout(pickVoice, 400);
  }

  var Speech = {
    supported: function () { return !!synth; },
    hasVoice: function () { return !!zhVoice; },
    speak: function (text, rate) {
      if (!synth || !text) return false;
      try {
        synth.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.lang = "zh-CN";
        if (zhVoice) u.voice = zhVoice;
        u.rate = rate || 0.85;
        u.pitch = 1.0;
        synth.speak(u);
        return true;
      } catch (e) {
        console.warn("Speech failed", e);
        return false;
      }
    }
  };

  window.Speech = Speech;
})();
