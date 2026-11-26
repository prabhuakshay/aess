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

## 4. Inserts, bases and caddies

| Part | Rule |
|---|---|
| **Insert clearance** | Cups and holders stand on the box floor, or on top of its floor ribs. They clear the widest point of the inner wall below their top by 0.4 mm, counting gussets. |
| **Tray ledge** | A ledge reaching 3.2 mm in from the outside, with a 45° underside, set `trayDepth` below the box's usable top (just under the lid ledge). |
| **Lift-out tray** | Outline inset 2.6 mm, which clears the lid lips (2.2 mm). It sits on the ledge with 0.6 mm overlap. |
| **Holder** | Deck 3 mm thick (8 mm for hex bits) with support ribs every ~20 mm. It prints deck-down. |
| **Base plate** | Flat bottom. One socket per stack: the stack's outline inset 1.2 mm and 5.3 mm deep, so feet seat exactly as on a bin. |
| **Caddy** | Wells 1 mm larger than a 1×1 bin and 16 mm deep, with a 3 mm handle plate between the rows. |
| **Drawer cabinet** | An AESS bin with its front open above the floor. Each side wall has one ledge per drawer: 2.5 mm deep, flat top, 45° underside. The first ledge sits 6.1 mm up, clear of the flare; the rest are evenly spaced up to 4.8 mm below the rim top. |
| **Drawer** | Width = inner width − 0.8 mm (the rim counts as wall), depth = cabinet depth − back wall − 0.6 mm, height = ledge pitch − 3.9 mm. Flat bottom; the front is flush with the cabinet. |
| **Counting tray** | Free-standing: grid footprint, 1.6 mm walls and floor. Its spout adds 24 mm at the front and opens to 14 mm at floor level. |

Inserts are sized from a host box, so the same settings must go to the box and its inserts. The generator's “+ Add the box” does that.

## 5. Free parameters (do not affect stacking)

| Parameter | Range | Default |
|---|---|---|
| Wall (sides and floor below the rim) | Lite 0.8, Standard 1.2, Heavy 1.6 mm | Standard |
| Floor | 0.8–3 mm | = wall |
| Wall pattern | none, diamond, hex, slots; hole 3–16 mm, bars 1.2–6 mm. Every hole top is ≥ 45° | none |
| Lid pattern | none, diamond, hex | none |
| Dividers | 0–30 each way, built into the cavity, stopping below the lid ledge (or the tray ledge) | 0 |
| Floor ribs | none, lengthwise or cross; 1.5–6 mm tall, 1.2 mm wide, on the half grid, with 45° tops | none |
| Wall ribs | vertical, 1.5 mm deep, on the half grid, up to the rim zone (not with wall patterns) | off |
| Gussets | 0–10 mm 45° fillet between the floor and walls | 0 |
| Hopper side slope | 0–50 % of the depth | 0 |
| Finger grips, thread-check holes | through the side walls, with 45° tops | off |
| Lid style | plain, window (0.5 mm rebate), label recess (12/18/24/36 mm), dispenser (4–40 mm hole) | plain |
| Scoop | 0–25 mm 45° ramp inside the front wall | 0 |
| Hopper front lip | 15–90 % of H | 40 % |
| Text | a label line plus a brand line on the front, engraved (≤ 0.6 mm) or raised 0.6 mm; brand raised 0.5 mm on solid lids | brand "Akshay Enterprises" |

## 6. Naming

```
AESS-<TYPE>-<size>[-G<grid>][-H<step>]-<WALL>[-OPEN]
TYPE   HOP | BOX | LID | CUP | TRAY | HOLD | BASE | CADDY | CNT | CAB | DRW   (inserts name their host)
size   grid: <nx>x<ny>x<nh>      exact: <W>x<D>x<H>MM  or  ...IN
grid   tag present only when it differs from the system default (imperial always shows G…IN)
WALL   LITE | STD | HEAVY | <mm>MM        lids have no wall tag; -S<snap> marks a non-standard lid snap
-OPEN  a box without lid rails
```
Examples: `AESS-HOP-2x3x7-STD`, `AESS-BOX-2x2x4-HEAVY`, `AESS-LID-2x3`, `AESS-BOX-2x3x8-G1.5IN-STD`, `AESS-BOX-100x60x40MM-LITE`.

## Versioning

A change to §2 or §3 breaks compatibility and bumps the major version. v2 removed v1's snap bead and groove between stacked bins, and replaced the 1-unit snap-on lid with the slide lid.
