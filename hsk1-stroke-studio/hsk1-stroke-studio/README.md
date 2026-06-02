# 墨 Ink Studio — HSK 1 Stroke Practice

A polished, offline-friendly web app for learning to **write the 150 HSK 1 words
(178 unique hanzi)** with correct stroke order. Trace each character, get
real-time stroke validation, and let a built-in spaced-repetition scheduler
decide what you review and when.

No build step, no framework, no backend — just open it.

---

## Features

- **Trace-and-validate quiz** — draw each stroke with mouse or finger; wrong
  strokes are rejected, and a hint appears after a few misses (Hanzi Writer).
- **Correct stroke order** for every character, with replayable animations.
- **Spaced repetition** (SM-2 variant with learning steps + Again/Hard/Good/Easy
  grading) so reviews surface exactly when you're about to forget.
- **The 米字格 practice grid** behind every character, like real练字 paper.
- **Dashboard** — progress ring, due count, mastery breakdown, daily goal,
  streak, and a 30-day activity sparkline.
- **Browse** all 150 words with search + status filters; **detail pages** show
  animations, related words, and your memory stats per word.
- **Mandarin audio** via the browser's built-in speech synthesis (no network).
- **Light "paper" & dark "night ink" themes.**
- **Local progress** saved in your browser; export/import as JSON.

---

## Run it

The app talks to a CDN for the stroke-order data, so you need an internet
connection the first time each character is shown.

**Easiest — VS Code Live Server:**
1. Open this folder in VS Code.
2. Install the *Live Server* extension (if you haven't).
3. Right-click `index.html` → **Open with Live Server**.

**Or just open the file:** double-click `index.html`. (Live Server is smoother,
but opening directly works too.)

**Or any static server:**
```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

---

## Project structure

```
hsk1-stroke-studio/
├── index.html          # shell: fonts, Hanzi Writer CDN, layout regions
├── css/
│   └── styles.css      # the entire "Ink Studio" theme (light + dark)
├── js/
│   ├── data.js         # the 150 HSK 1 words (simplified, traditional,
│   │                   #   pinyin, meanings) + character→word index
│   ├── storage.js      # localStorage layer: settings, cards, stats, streak
│   ├── srs.js          # spaced-repetition scheduler (window.SRS)
│   ├── speech.js       # Mandarin pronunciation (window.Speech)
│   ├── writer.js       # Hanzi Writer wrapper + practice grid (window.Writer)
│   └── app.js          # router + all views + the practice session controller
└── README.md
```

The scripts use plain globals and load in order — no bundler required. Each file
has a single clear job, so it's easy to extend.

---

## Make it yours

- **Add more words / other HSK levels:** append objects to the array in
  `js/data.js`. Shape:
  ```js
  { "id": 150, "simp": "学习", "trad": "學習",
    "pinyin": "xuéxí", "meaning": ["to study", "to learn"], "pos": ["v"] }
  ```
  Stroke data is fetched automatically per character, so any common hanzi works.
- **Tune the scheduler:** `js/srs.js` — `LEARN_STEPS`, ease changes, graduation
  intervals.
- **Restyle:** every color lives in CSS variables at the top of `css/styles.css`
  (`--paper`, `--ink`, `--cinnabar`, `--jade`, …) for both themes.
- **Default settings** (new cards/session, daily goal, leniency, etc.) live in
  `DEFAULTS` in `js/storage.js`.

---

## Credits

- Stroke order, animation, and quiz validation:
  [Hanzi Writer](https://hanziwriter.org/) (MIT) + its character data.
- HSK 1 vocabulary derived from the open
  [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary)
  dataset.
- Type: Fraunces, Spectral, Noto Serif SC, Ma Shan Zheng (Google Fonts).

Your progress never leaves your browser.
