# Printing AESS parts

Tuned for a Bambu Lab A1 (256 mm bed). Any 0.4 mm FDM printer works.

## Settings
| Setting | Value |
|---|---|
| Nozzle | 0.4 mm |
| Layer height | 0.2 mm (0.28 mm for speed) |
| Wall loops | 2 for Lite, 3 for Standard, 4 for Heavy |
| Infill | 0 % (the walls are the part) |
| Top / bottom shells | enough to fill the floor (the defaults are fine) |
| Supports | none |
| Orientation | as exported: bins foot down, lids flat (the plate on the bed) |
| Material | PLA for storage; PETG for lids that get opened all day (it flexes rather than cracks) |

## Bambu Studio presets
In the generator, open ⚙ and download the **AESS Lite / Standard / Heavy** presets. Import them once (File → Import → Import Configs…). Each is the stock *0.20mm Standard @BBL A1* with the AESS wall count, 0% infill and the seam at the back, away from the branding. The site says which one each part needs.

Exceptions:
- **Base plates:** print with the stock profile (15% infill).
- **Holders:** print deck-down, exactly as exported.

## Fit test first
Print `AESS-BOX-1x1x3-STD` and `AESS-LID-1x1` (about 10 g; *Add a preset → Fit test* in the generator). Slide the lid in.
- **Clicks shut at the end and pulls out with the tab:** keep *Standard* (0.7).
- **Hard to push in or pull out:** use *Looser* (0.6).
- **Slides out on its own:** use *Tighter* (0.8).

The lid snap is set on the **box** (the notch depth) and the **lid** (the bump), so use the same setting for both.
Stacking needs no tuning. If bins jam together, your printer over-extrudes, or the first layer is squished: keep the elephant-foot chamfer on.

## Bambu Studio tips
- **Plate files:** open the 3MF and press **A** to auto-arrange.
- **Batch printing:** a full A1 plate fits, for example, four 2×3 hoppers or nine 2×2 parts.
- **Colour by category:** one filament colour per kind of stock (screws, nuts, electrical…) costs nothing extra.
