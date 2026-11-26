# `aess_master.sc`: the SolidCraft reference model

One parametric design builds every AESS part. Open it in SolidCraft (0.49 or later) and change the user parameters:

| Parameter | Meaning | Default |
|---|---|---|
| `nx`, `ny` | footprint in 42 mm units (whole numbers 1–6) | 2, 3 |
| `nh` | height in 7 mm units (1–35) | 7 |
| `wall` | floor and wall thickness below the rim (0.8–1.4 mm) | 1.2 mm |
| `front_ratio` | hopper front lip as a share of H. **1 = closed box** | 0.4 |

- **Lid:** `nh = 1`, `front_ratio = 1`.
- **Fixed parameters:** `U`, `gap`, `hu`, `lip`, `fit`, `r`, `rim` and `zb` define the [standard](../docs/STANDARD.md). Changing them breaks compatibility.

**Timeline:**
1. Foot
2. Flare
3. Walls
4. Shell, 1 × `wall` thick
5. RimFill and RimBore, which make the fixed 1.2 mm rim
6. FrontOpening

The v1 snap bead and groove (`BeadLo`, `BeadHi`, `GrooveLo`, `GrooveHi`) are kept in the timeline but suppressed.

This model holds the **bin body**. Slide-lid rails, slide lids, text, patterns and dividers are built by `web/aess-core.js`.

## Exporting from the command line
`solidcraft/aess_gen.py` drives `solidcraft-cli` to export any size from this file:
```
cd solidcraft
python aess_gen.py hopper 2 3 7
python aess_gen.py --list ../sets/starter.txt
```
The web generator rebuilds the same geometry in the browser. `test/core.test.js` holds this model's measured volumes and fails CI if the two drift apart by more than 0.5 %.
