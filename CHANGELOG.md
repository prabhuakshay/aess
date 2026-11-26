# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/). A change to the stacking interface (§1–§3 of the standard) is always a major version.

## [Unreleased]

## [0.3.0] - 2026-11-26
### Added
- **New parts:**
  - **Cups:** drop-in cups sized to a box, printed as a set.
  - **Lift-out tray:** rests on a new tray ledge in the box, with optional dividers.
  - **Holder insert:** a drill index (engraved sizes, metric or fractional), a ¼″ hex-bit holder, or a tool hole grid. It prints deck-down, with no supports.
  - **Base plate:** links 1–6 stacks; rubber-foot or magnet pockets underneath.
  - **Carry caddy:** wells for 1×1 bins and a handle.
- **Strength:**
  - ribbed floors, lengthwise or cross, with 45° tops
  - inside wall ribs
  - corner gussets
  - a floor-load estimate in the stats
- **Hopper and bin options:** side slope, finger grips, thread-check holes (M3–M12 or #6–½″) with engraved sizes.
- **Lid styles:** window (rebate for a PET sheet), label recess (12–36 mm tape), dispenser (hole with collar).
- **Presets:** nut cups, drill index, bit case, tall tool bin, toolbox, counter riser set, sheet sorter, wire dispenser.
- **Offline:** an installable app (PWA); the generator works without internet after the first visit.
- **Bambu Studio presets** (Lite / Standard / Heavy): the stock A1 0.20 mm profile with AESS walls, 0% infill and the seam at the back. The site says which preset each part needs.
- Tests: inserts fit their box without touching it, the tray sits on its ledge and clears the lid, lid variants still fit, and bins seat in bases and caddies. Rib stiffness is checked too.

### Changed
- Dividers: up to 30 each way.
- Part picker: 8 types in one grid, with shortcuts 1–8.

## [0.2.0] - 2026-11-26
### Changed (breaking: standard v2)
- Bins no longer snap together. The foot bead and rim groove are gone, and bins nest on the 4.3 mm foot alone.
- The 1-unit snap-on lid is replaced by a **slide lid**:
  - a 1.2 mm plate in rails inside the box
  - a click lock: side bumps into wall notches
  - a pinch tab or finger notch to pull it out
  - it adds no height, so lidded boxes still stack
- The Heavy wall is now 1.6 mm.
- Height steps: every unit works.
- The UI says "units", with a stepper and a slider.

### Added
- **Base-unit systems:** metric (42 × 7 mm, the Gridfinity grid) or imperial (inch grid, ¼″ heights), with custom grids and steps. Exact-size mode in whole mm or ¼″.
- **Branding:** "Akshay Enterprises" engraved on every bin front, auto-sized; an optional label line; engraved, raised or off; brand on lids.
- **Configuration:**
  - separate floor thickness
  - elephant-foot chamfer
  - wall patterns (diamond, hex, slots) and lid patterns
  - dividers both ways, a front scoop
  - lid snap strength
- **Website:**
  - an ⓘ tooltip on every setting
  - mm/in switch, light/dark theme
  - undo/redo and keyboard shortcuts
  - saved-parts library
  - cut-away view, lid-in-place view, spin, PNG snapshot
  - filament, time, cost and parts-per-plate estimates; filament price in settings
  - printable paper labels for a plate
  - presets, reset to defaults, back/forward through links
- Collision tests: lid in box, and a bin stacked on a lidded box.

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
