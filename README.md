<div align="center">

<img src="web/favicon.svg" width="72" alt="AESS logo">

# AESS

**Snap-stacking storage bins on a 42 mm grid. Generate any size in your browser, then print.**

[![CI](https://github.com/prabhuakshay/aess/actions/workflows/ci.yml/badge.svg)](https://github.com/prabhuakshay/aess/actions/workflows/ci.yml)
[![Pages](https://github.com/prabhuakshay/aess/actions/workflows/pages.yml/badge.svg)](https://prabhuakshay.github.io/aess/)
[![License: MIT](https://img.shields.io/badge/license-MIT-f59e0b.svg)](LICENSE)

### [Open the generator →](https://prabhuakshay.github.io/aess/)

</div>

---

AESS started as storage for a hardware shop: screws, nuts, anchors and fittings, stacked on desks, counters, shelves or the floor. Every part shares one interface, so **any bin stacks on any other and clicks into place**. Stacks don't topple, and nothing needs a wall or a shelf.

- **Hoppers:** open-front pick bins. Stack them into a wall and grab parts from the front.
- **Boxes:** closed bins for anything that shouldn't spill.
- **Lids:** snap onto any box of the same footprint. A lid also takes another bin on top.
- **Built for printing:** fast, low-filament parts. No supports, no infill, and three wall weights.

## Use the generator

1. Open **[prabhuakshay.github.io/aess](https://prabhuakshay.github.io/aess/)**.
2. Pick a part, click a footprint on the 6×6 grid, and set the height.
3. **Download 3MF** (or STL). To print several parts at once, **Add to plate**, then download the whole plate as one 3MF.

Everything runs in your browser. Nothing is uploaded. Each part can be shared as a link.

**Print the fit test first** (*Load a preset → Fit test*, ~13 g). Then read [docs/PRINTING.md](docs/PRINTING.md).

## The standard in one table

| | |
|---|---|
| Footprint | `n × 42 mm − 0.5`, 1–6 units each way (fits a 256 mm bed) |
| Height | `nh × 7 mm + 4.3`. Each part adds exactly `nh × 7` to a stack |
| Interface | 4 mm foot, 45° flare, 1.2 mm rim, 0.6 mm snap bead and groove |
| Walls | Lite 0.8 · Standard 1.2 · Heavy 1.4 mm |

Full specification: [docs/STANDARD.md](docs/STANDARD.md). Ideas and planned parts: [docs/ROADMAP.md](docs/ROADMAP.md).

## Repository layout

```
web/          the generator: static site, deployed to GitHub Pages
  aess-core.js    geometry for every part (Manifold kernel)
  aess-export.js  3MF / STL / ZIP writers (no dependencies)
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
- **Drift check.** `test/core.test.js` compares the two models' volumes for ten parts, and CI fails if they differ by more than 0.5 %.

**CI and releases** (`.github/workflows/`):
- **ci.yml:** every push and pull request runs lint, the geometry tests and the browser smoke test, and builds the starter set.
- **pages.yml:** each push to `main` deploys `web/` to GitHub Pages, after the geometry tests pass.
- **release.yml:** pushing a tag like `v0.1.0` publishes a release with the starter set (individual 3MFs plus a full plate) and the CAD master.

## Contributing

New part types (dividers, cups, label clips…), fixes and print reports are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE): the code, the CAD model and every file the generators produce.
