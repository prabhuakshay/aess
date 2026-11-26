# The AESS standard, v1 (draft)

AESS parts interlock because they all share one interface. Inside that interface, anything can change. This document is the contract. `cad/aess_master.sc` (SolidCraft) is its reference model, and `web/aess-core.js` is checked against that model in CI.

> **Status: draft.** The geometry is verified in CAD. The snap fit (0.3 mm interference) still needs confirming with a printed fit test. Until then, 0.5 / 0.6 / 0.7 mm beads are all offered.

## 1. Grid

| Name | Symbol | Value |
|---|---|---|
| Grid unit | `U` | 42 mm |
| Neighbour clearance | `gap` | 0.5 mm |
| Outer width / depth | `W`, `D` | `nx·U − gap`, `ny·U − gap`; nx, ny ∈ 1…6 |
| Outer corner radius | `r` | 4 mm |

Every part is centred on its footprint, so parts placed side by side on a 42 mm pitch leave 0.5 mm between them.

## 2. Height

| Name | Symbol | Value |
|---|---|---|
| Height unit | `hu` | 7 mm |
| Outer height | `H` | `nh·hu + lip + fit` = `nh·7 + 4.3` mm; nh ∈ 1…35 |
| Stack pitch | | `nh·7` mm: a stack's height is the sum of its parts' units (+4.3 mm for the bottom foot) |

`nh = 1` is a **lid**: it closes the part below it and takes the next part on top.

## 3. Stacking interface (the same on every part)

Measured inward from the outer wall (*inset*) and upward from the bottom (*z*):

| Feature | Value |
|---|---|
| Foot | z 0 → `lip` = 4 mm, inset `s = rim + fit` = 1.5 mm |
| Flare | 45° from inset 1.5 mm at z = 4 to the full wall at z = 5.5. Prints with no supports |
| Rim | the top `lip + fit + 1` = 5.3 mm of every part is exactly `rim` = 1.2 mm thick, whatever the wall class |
| Snap bead | a 45° ridge on the foot, crest at z = `zb` = 2.4 mm, standing out `snap` (default 0.6 mm) |
| Snap groove | a 45° V inside the rim at z = `H − lip − fit + zb`, `snap − fit + 0.1` deep (0.4 mm by default) |
| Seating | the upper part's flare rests on the lower rim; its foot reaches `lip + fit` = 4.3 mm down |

Interference is `snap − fit` = 0.3 mm per side by default. The groove leaves 0.1 mm of clearance at the bead's tip.

## 4. Free parameters (do not affect compatibility)

| Parameter | Range | Default |
|---|---|---|
| Wall class: floor and walls below the rim | Lite 0.8, Standard 1.2, Heavy 1.4 mm | Standard |
| Hopper front lip | 15–90 % of H | 40 % |
| Snap bead | 0.5 / 0.6 / 0.7 mm | 0.6 |

The wall tops out at 1.4 mm because the inside of the foot must clear the snap bead. Thicker walls also fail to build in the CAD master.

## 5. Naming

```
AESS-<TYPE>-<nx>x<ny>[x<nh>]-<WALL>[-S<snap>]
TYPE  HOP (hopper) | BOX | LID (lids leave out nh)
WALL  LITE | STD | HEAVY | <mm>MM
```
Examples: `AESS-HOP-2x3x7-STD`, `AESS-LID-2x3-LITE`, `AESS-BOX-1x1x3-STD-S0.5`.

## 6. Making new parts

A new part type is AESS-compatible when it:
1. has a footprint of `nx·42 − 0.5` mm with 4 mm corner radii,
2. uses the foot, flare and bead of §3 at its bottom, if it sits on other parts,
3. uses the 5.3 mm rim and groove of §3 at its top, if parts sit on it,
4. is `nh·7 + 4.3` mm tall.

Inserts that sit *inside* a part (dividers, cups) are free, but they should use the 21 mm half-grid so they line up.

## Versioning

Changing anything in §1–§3 breaks compatibility. Such a change bumps the standard's major version and the repository's major version.
