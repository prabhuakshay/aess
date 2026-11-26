<div align="center">

<img src="web/favicon.svg" width="72" alt="AESS logo">

# AESS

**Stackable storage bins with slide-lock lids, on a 42 mm (Gridfinity) or inch grid. Generate any size in your browser, then print.**

[![CI](https://github.com/prabhuakshay/aess/actions/workflows/ci.yml/badge.svg)](https://github.com/prabhuakshay/aess/actions/workflows/ci.yml)
[![Pages](https://github.com/prabhuakshay/aess/actions/workflows/pages.yml/badge.svg)](https://prabhuakshay.github.io/aess/)
[![License: MIT](https://img.shields.io/badge/license-MIT-f59e0b.svg)](LICENSE)

### [Open the generator →](https://prabhuakshay.github.io/aess/)

</div>

---

AESS started as storage for a hardware shop: screws, nuts, anchors and fittings, stacked on desks, counters, shelves or the floor. Every part shares one stacking interface, so **any bin nests securely on any other bin with the same footprint**.

- **Hoppers:** open-front pick bins. Stack them into a wall and grab parts from the front.
- **Boxes:** closed bins with built-in rails for a slide lid.
- **Slide lids:** a 1.2 mm plate that slides in and clicks shut. It adds **no height**, so lidded boxes still stack. Pull it out by the pinch tab.
- **Inserts:**
  - drop-in cups
  - a lift-out tray
  - holders: a drill index with engraved sizes, hex bits, a tool grid
- **Structure:**
  - base plates that link stacks so they don't tip
  - a drawer cabinet that stacks like any bin, with matching drawers
  - a carry caddy
- **Counter tools:** a counting tray with a pour spout and count lines.
- **Configurable:**
  - wall weights, floor thickness
  - ribbed floors and walls, corner gussets
  - wall patterns that save filament
  - dividers and a front scoop
  - hopper side slope, finger grips, thread-check holes
  - window, label and dispenser lids
  - engraved or raised branding plus a label line
  - metric or imperial grid
- **Built for printing:** no supports, no infill.

## Use the generator

1. Open **[prabhuakshay.github.io/aess](https://prabhuakshay.github.io/aess/)**.
2. Pick a part, click a footprint on the grid, and set the height. Every setting has an ⓘ explaining it.
3. **Download 3MF** (or STL). To print several parts at once, **Add to plate**, then download the whole plate as one 3MF, a zip of STLs or printable paper labels.

Everything runs in your browser. Nothing is uploaded.

Other conveniences:
- undo/redo, keyboard shortcuts and a saved-parts library
- a cut-away view, with the lid shown in place
- filament, time, cost and floor-load estimates
- share links for any part
- it works offline as an installable app
- Bambu Studio presets

**Print the fit test first** (*Add a preset → Fit test*, ~10 g). Then read [docs/PRINTING.md](docs/PRINTING.md).

## The standard in one table

| | |
|---|---|
| Grid | Metric: 42 mm × 7 mm steps (Gridfinity grid). Imperial: 1½″ × ¼″ steps. Or any exact size |
| Footprint | `n × grid − 0.5 mm` |
| Height | `units × step + 4.3 mm`. Each part adds exactly `units × step` to a stack |
| Stacking | 4 mm foot, 45° flare, fixed 1.2 mm rim; 0.3 mm play |
| Slide lid | 1.2 mm plate 7.1 mm below the rim; click lock; adds no height |
| Walls | Lite 0.8 · Standard 1.2 · Heavy 1.6 mm |

Full specification: [docs/STANDARD.md](docs/STANDARD.md). Ideas and planned parts: [docs/ROADMAP.md](docs/ROADMAP.md).

## Repository layout

```
web/          the generator: static site, deployed to GitHub Pages
  aess-core.js    geometry for every part (Manifold kernel)
  aess-export.js  3MF / STL / ZIP writers (no dependencies)
  fonts/          Barlow Condensed Bold (SIL OFL) for engraved text
cad/          aess_master.sc: the SolidCraft reference model
solidcraft/   aess_gen.py: export any size from the CAD master via solidcraft-cli
scripts/      build-set.js (batch export with Node), serve.js (local server)
sets/         part lists for batch builds (starter.txt)
test/         geometry checked against the CAD master; browser smoke test
docs/         standard, printing guide, roadmap
```

## Development

Requires Node 20 or newer.

```bash
npm ci
npm run dev            # http://localhost:8080
npm run check          # lint + geometry tests
npm run test:e2e       # browser smoke test (needs Chrome or `npx playwright install chromium`)
npm run build:starter  # write the starter set to dist/starter-set
npm run build:set -- sets/starter.txt out/ --stl
```

How the pieces fit together:
- **Reference model.** `cad/aess_master.sc` (SolidCraft) defines the standard.
- **Browser geometry.** `web/aess-core.js` rebuilds the same shapes with [Manifold](https://github.com/elalish/manifold), loaded from a CDN at a pinned version.
- **Drift check.** `test/core.test.js` compares the two models' volumes for eleven parts, and CI fails if they differ by more than 0.5 %.
- **Collision checks.** The tests also prove that every lid fits its box, and that a bin stacked on a lidded box touches neither the lid nor the box.

**CI and releases** (`.github/workflows/`):
- **ci.yml:** every push and pull request runs lint, the geometry tests and the browser smoke test, and builds the starter set.
- **pages.yml:** each push to `main` deploys `web/` to GitHub Pages, after the geometry tests pass.
- **release.yml:** pushing a tag like `v0.1.0` publishes a release with the starter set (individual 3MFs plus a full plate) and the CAD master.

## Contributing

New part types (dividers, cups, label clips…), fixes and print reports are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE): the code, the CAD model and every file the generators produce. The bundled font is Barlow Condensed, under the [SIL Open Font License](web/fonts/OFL.txt).
