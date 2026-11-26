# Printing AESS parts

Tuned for a Bambu Lab A1 (256 mm bed). Any 0.4 mm FDM printer works.

## Settings
| Setting | Value |
|---|---|
| Nozzle | 0.4 mm |
| Layer height | 0.2 mm (0.28 mm for speed) |
| Wall loops | 2 for Lite, 3 for Standard and Heavy |
| Infill | 0 % (the walls are the part) |
| Top / bottom shells | enough to fill the floor (the defaults are fine) |
| Supports | none |
| Orientation | as exported: foot down |
| Material | PLA for storage; PETG for lids that get opened all day (it flexes rather than cracks) |

## Fit test first
Print `AESS-BOX-1x1x3-STD` and `AESS-LID-1x1-STD` (about 13 g; *Load a preset → Fit test* in the generator).
- **Clicks on, pulls off by hand:** keep *Standard* (0.6).
- **Too hard to press or remove:** use *Looser* (0.5).
- **Falls off or rattles:** use *Tighter* (0.7).

Every part you print from then on uses the same setting. Mixing settings works, but the fit falls between them.

## Bambu Studio tips
- **Plate files:** open the 3MF and press **A** to auto-arrange.
- **Batch printing:** a full A1 plate fits, for example, four 2×3 hoppers or nine 2×2 parts.
- **Colour by category:** one filament colour per kind of stock (screws, nuts, electrical…) costs nothing extra.
