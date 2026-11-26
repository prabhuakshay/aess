# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/). A change to the stacking interface (§1–§3 of the standard) is always a major version.

## [Unreleased]

## [0.1.0] - 2026-11-26
### Added
- AESS standard v1 (draft):
  - 42 mm grid and 7 mm height units.
  - Snap-stack interface: foot, 45° flare, fixed 1.2 mm rim, 0.6 mm bead and groove.
  - Three wall classes: Lite, Standard, Heavy.
- Part types: hopper (open-front pick bin), box, and lid (a box at nh = 1).
- SolidCraft reference model `cad/aess_master.sc`, and `solidcraft/aess_gen.py` to export from it.
- Browser generator:
  - live 3D preview with a stacked view
  - 3MF and STL downloads
  - multi-part plate export, plus a ZIP of STLs
  - presets and shareable links
- Node batch exporter (`npm run build:set`) and the starter set.
- Geometry tests checked against the CAD master, a browser smoke test, CI, GitHub Pages deployment and tagged releases.
