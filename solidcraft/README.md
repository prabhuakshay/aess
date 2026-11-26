# SolidCraft exporter

`aess_gen.py` exports AESS parts straight from the CAD master (`../cad/aess_master.sc`) through `solidcraft-cli`. Use it when you want files built by the reference model itself. For everyday use, the web generator or `npm run build:set` is faster.

```
python aess_gen.py hopper 2 3 7                 # → ../print/AESS-HOP-2x3x7-STD.3mf
python aess_gen.py box 1 5 4 --wall lite --format step
python aess_gen.py lid 2 3 --snap 0.5
python aess_gen.py box 3 3 10 --estimate        # grams only
python aess_gen.py --list ../sets/starter.txt
```

**Requirements:**
- SolidCraft 0.49 or later, with `solidcraft-cli` on PATH or in `C:\Program Files\SolidCraft`.
- Python 3.9 or later.

Each part takes about a minute to build.
