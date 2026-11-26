# The AESS standard, v2 (draft)

AESS parts stack because they share one interface. Everything else is free to change. This document is the contract.
- **Bin body:** foot, flare, walls, rim and hopper opening. Its reference model is `cad/aess_master.sc` (SolidCraft).
- **Everything else:** slide-lid rails, lids, text, patterns and dividers are defined in `web/aess-core.js`.
- **CI checks both:** every build compares bin volumes against SolidCraft, and checks that lids and stacked bins never collide.

> **Status: draft.** The geometry is verified in CAD and by collision tests. The lid snap still needs confirming with a printed fit test, so three settings are offered.

## 1. Base-unit system

| System | Grid `U` | Height step `hu` | Notes |
|---|---|---|---|
| **Metric** (default) | 42 mm | 7 mm | The Gridfinity grid: AESS bins line up with Gridfinity bins on a shelf. The AESS foot does *not* lock into Gridfinity baseplates. |
| **Imperial** | 1½″ (1″ and 2″ offered) | ¼″ | Every unit adds exactly ¼″ to a stack. |

Custom grids and steps are allowed, in 1 mm or ¼″ increments. Only parts with the same footprint stack on each other.

| Size | Grid mode | Exact mode |
|---|---|---|
| Outer width / depth | `nx·U − 0.5 mm`, `ny·U − 0.5 mm` | any W, D (whole mm or ¼″) |
| Outer height | `nh·hu + 4.3 mm` | any H |
| Stack pitch | `H − 4.3 mm` = `nh·hu` | `H − 4.3 mm` |

The extra 4.3 mm is the foot, which sits inside the bin below.

## 2. Stacking interface (identical on every part)

Measured inward from the outer wall (*inset*) and up from the bottom (*z*). The outer corner radius is 4 mm.

| Feature | Value |
|---|---|
| Foot | z 0 → 4 mm, inset 1.5 mm, with an optional 0.4 mm 45° elephant-foot chamfer at the bottom edge |
| Flare | 45° from inset 1.5 mm (z = 4) to the full wall (z = 5.5); no supports needed |
| Rim | the top 5.3 mm (9.1 mm on boxes with lid rails) is exactly 1.2 mm thick, whatever the wall |
| Seating | the upper part's flare rests on the lower rim, and its foot reaches 4.3 mm down with 0.3 mm play per side |

There is no snap between stacked bins. The 4.3 mm-deep foot keeps a stack aligned, and gravity does the rest.

## 3. Slide lid

| Feature | Value |
|---|---|
| Lid plate | 1.2 mm thick; bottom at `H − 7.1 mm`, so it sits below where the next bin's foot reaches (`H − 4.3`), and lidded boxes stack |
| Rails (box) | 1.0 mm ledge under the lid with a 45° underside, and a 1.0 mm lip above with a 45° underside, on the sides and back |
| Clearance | 0.4 mm at the sides, 0.3 mm vertical |
| Front opening | the box's front 4.6 mm above the ledge is cut away; the lid's front cap rebuilds that wall and its corners |
| Snap lock | a bump on each side of the lid, 0.6 / 0.7 / 0.8 mm (Looser / Standard / Tighter), clicks into a 45° notch in the box wall 7.1 mm behind the front |
| Pull | a pinch tab (2 × 8 mm fin) or a finger notch on the front cap |
| Minimum box height | 18 mm |

A lid fits every box with the same footprint, whatever the box's height.

## 4. Free parameters (do not affect stacking)

| Parameter | Range | Default |
|---|---|---|
| Wall (sides and floor below the rim) | Lite 0.8, Standard 1.2, Heavy 1.6 mm | Standard |
| Floor | 0.8–3 mm | = wall |
| Wall pattern | none, diamond, hex, slots; hole 3–16 mm, bars 1.2–6 mm. Every hole top is ≥ 45° | none |
| Lid pattern | none, diamond, hex | none |
| Dividers | 0–9 each way, built into the cavity, stopping below the lid ledge | 0 |
| Scoop | 0–25 mm 45° ramp inside the front wall | 0 |
| Hopper front lip | 15–90 % of H | 40 % |
| Text | a label line plus a brand line on the front, engraved (≤ 0.6 mm) or raised 0.6 mm; brand raised 0.5 mm on solid lids | brand "Akshay Enterprises" |

## 5. Naming

```
AESS-<TYPE>-<size>[-G<grid>][-H<step>]-<WALL>[-OPEN]
TYPE   HOP | BOX | LID
size   grid: <nx>x<ny>x<nh>      exact: <W>x<D>x<H>MM  or  ...IN
grid   tag present only when it differs from the system default (imperial always shows G…IN)
WALL   LITE | STD | HEAVY | <mm>MM        lids have no wall tag; -S<snap> marks a non-standard lid snap
-OPEN  a box without lid rails
```
Examples: `AESS-HOP-2x3x7-STD`, `AESS-BOX-2x2x4-HEAVY`, `AESS-LID-2x3`, `AESS-BOX-2x3x8-G1.5IN-STD`, `AESS-BOX-100x60x40MM-LITE`.

## Versioning

A change to §2 or §3 breaks compatibility and bumps the major version. v2 removed v1's snap bead and groove between stacked bins, and replaced the 1-unit snap-on lid with the slide lid.
