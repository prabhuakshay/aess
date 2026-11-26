# AESS roadmap

AESS started as stackable storage for a hardware shop and grew into an open system. ✅ = shipped, 🔜 = next, 💡 = idea.

## Foundations
- ✅ **Standard v2 (draft):**
  - metric (Gridfinity grid) or imperial base units
  - nesting stack interface
  - slide-lock lids
  - See [STANDARD.md](STANDARD.md).
- ✅ **SolidCraft reference model** and CLI exporter.
- ✅ **Browser generator:**
  - preview and stacked view
  - 3MF and STL downloads, plate export
  - presets and share links
- 🔜 **Fit test confirmed** on a real print, which settles the default lid snap (0.6 / 0.7 / 0.8).
- 💡 **Gridfinity base option:** per-cell Gridfinity feet, so metric bins also lock into Gridfinity baseplates.

## Containers
- ✅ **Hopper:** open-front pick bin, with an adjustable lip.
- ✅ **Box:** closed bin.
- ✅ **Slide lid:**
  - click lock and a pinch tab
  - zero added height
  - optional hole pattern and brand
- ✅ **Fixed dividers** (both directions) and a **front scoop**.
- ✅ **Wall patterns** (diamond, hex, slots) to save filament.
- 🔜 **Removable dividers:** slots in the walls and slide-in divider plates.
- ✅ **Drop-in cups**, sized from any box.
- ✅ **Lift-out tray** on a tray ledge.
- ✅ **Holders:** drill index, hex bits, tool grid; with a tall box they make a tool bin.
- ✅ **Strength:** floor ribs, wall ribs, gussets, floor-load estimate.
- ✅ **Hopper side slope, finger grips, thread-check holes.**
- 💡 **Long tray** presets (1×4, 1×5) for long bolts, hinges and threaded rod.
- 💡 **Drawer mode:** printed corner posts plus plywood sides turn a stack of bins into a drawer cabinet.

## Closing and structure
- ✅ **Lid pinch tab**, and the brand on lids.
- ✅ **Base plate:** links stacks so they don't tip, with rubber-foot or magnet pockets.
- ✅ **Carry caddy.**
- ✅ **Lid styles:** window, label recess, dispenser.
- 💡 **Top link clip** for the top bins of neighbouring stacks.
- 💡 **Hinged organizer case:** print-in-place hinge, snap latch, holds dividers.
- 💡 **Dust flap** for the hopper front.

## Next up (chosen, not built yet)
- 🔜 **Batch from a list:** paste a stock list → one labelled bin per line.
- 🔜 **Labels and icons:**
  - a tape label recess and card slot on bin fronts
  - hardware icons beside the text
  - Hindi / Marathi lettering
- 🔜 **Shelf / drawer planner and A1 plate packer.**

## Shop tools
- 🔜 **Label clip** for the hopper lip, with:
  - a card slot
  - a thread-check hole (M3–M10)
  - a length ruler
- 💡 **Sample window:** one screw clipped on the front to show what's inside.
- 💡 **Counting scoop** with a pour spout.
- 💡 **Counter caddy:** a carry tray for 1×1 and 1×2 bins.
- 💡 **Colour code** by category: one filament colour per kind of stock.
- 💡 **QR or index numbers** on labels, linked to a stock sheet.

## Generator
- ✅ Engraved or raised brand and label text, and printable paper labels.
- ✅ Filament, time and cost estimates, a library, undo/redo and a cut-away view.
- ✅ Offline / installable app, and Bambu Studio presets.
- 💡 Multi-colour 3MF (text as a separate part for the AMS).
- 💡 Per-object settings inside the 3MF. Bambu Studio ignored them in testing, so for now it's presets.
