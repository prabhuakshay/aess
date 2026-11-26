#!/usr/bin/env python3
"""AESS bin generator: any 42 mm grid size, exported via SolidCraft's CLI.

Examples:
  python aess_gen.py hopper 2 3 7                  # 2x3 grid, 7 height units, STD wall
  python aess_gen.py box 1 1 3 --wall lite
  python aess_gen.py lid 2 3                       # lids are always 1 height unit
  python aess_gen.py hopper 3 2 10 --front 0.3 --format stl
  python aess_gen.py --list ../sets/starter.txt       # one spec per line, e.g. "box 2 2 5 heavy"
  python aess_gen.py box 2 3 7 --estimate          # print grams only, no export

The AESS standard
  footprint : nx * 42 mm - 0.5 mm  (nx, ny = 1..6, so it fits the Bambu A1's 256 mm bed)
  height    : nh * 7 mm + 4.3 mm   (nh = 1..35; nh=1 is a lid)
              a stack of a 3-unit and a 4-unit bin is exactly as tall as one 7-unit bin
  interface : 4 mm foot, 45 deg flare, 1.2 mm rim, 0.6 mm snap bead at 2.4 mm + matching groove (fixed for every part)
  wall      : lite 0.8 / std 1.2 / heavy 1.4 mm (sides and floor; the rim stays 1.2)
"""
import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
MASTER = HERE.parent / "cad" / "aess_master.sc"
OUT_DIR = HERE.parent / "print"
PLA_DENSITY = 1.24  # g/cm3 (PETG ~1.27)

U, HU, LIP, FIT, BED = 42.0, 7.0, 4.0, 0.3, 256.0
WALLS = {"lite": 0.8, "std": 1.2, "heavy": 1.4}
TYPES = {"hopper": "HOP", "box": "BOX", "lid": "LID"}


def find_cli():
    for c in ("solidcraft-cli", r"C:\Program Files\SolidCraft\solidcraft-cli.exe"):
        p = shutil.which(c) or (c if Path(c).exists() else None)
        if p:
            return p
    sys.exit("solidcraft-cli not found (install SolidCraft or add it to PATH)")


def spec(kind, nx, ny, nh, wall, front, snap):
    if kind not in TYPES:
        raise ValueError(f"type must be one of {', '.join(TYPES)}")
    if kind == "lid":
        nh = 1
    for name, v, hi in (("nx", nx, 6), ("ny", ny, 6), ("nh", nh, 35)):
        if not (isinstance(v, int) and 1 <= v <= hi):
            raise ValueError(f"{name} must be a whole number 1..{hi} (got {v})")
    if kind == "hopper" and nh < 3:
        raise ValueError("a hopper needs nh >= 3 (lower is just a tray: use box)")
    wall_mm = WALLS.get(str(wall).lower()) if not isinstance(wall, float) else wall
    if wall_mm is None:
        wall_mm = float(wall)
    if not 0.8 <= wall_mm <= 1.4:
        raise ValueError("wall must be lite/std/heavy or 0.8..1.4 mm")
    wall_tag = next((k.upper() for k, v in WALLS.items() if abs(v - wall_mm) < 1e-6), f"{wall_mm:g}MM")
    front_ratio = front if kind == "hopper" else 1.0
    if not 0.1 <= front_ratio <= 1.0:
        raise ValueError("--front must be 0.1..1.0")
    H = nh * HU + LIP + FIT
    params = {
        "nx": str(nx), "ny": str(ny), "nh": str(nh),
        "wall": f"{wall_mm} mm", "front_ratio": str(front_ratio), "snap": f"{snap} mm",
    }
    hpart = "" if kind == "lid" else f"x{nh}"
    snap_tag = "" if abs(snap - 0.6) < 1e-9 else f"-S{snap:g}"
    name = f"AESS-{TYPES[kind]}-{nx}x{ny}{hpart}-{wall_tag}{snap_tag}"
    size = (nx * U - 0.5, ny * U - 0.5, H)
    return name, params, size


def run_cli(cli, params, out=None, json_out=None):
    cmd = [cli, "run" if out else "eval", "--in", str(MASTER), "--quiet"]
    for k, v in params.items():
        cmd += ["--param", f"{k}={v}"]
    if out:
        cmd += ["--out", str(out)]
    if json_out:
        cmd += ["--json-out", str(json_out)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout).strip()[-800:])


def estimate(cli, params):
    with tempfile.TemporaryDirectory() as d:
        j = Path(d) / "m.json"
        run_cli(cli, params, json_out=j)
        data = json.loads(j.read_text(encoding="utf-8"))
    vol = find_volume(data)
    return vol, (vol / 1000 * PLA_DENSITY if vol else None)


def find_volume(obj):
    """Total volume from SolidCraft's eval JSON, wherever the report keeps it."""
    if isinstance(obj, dict):
        tot = obj.get("total")
        if isinstance(tot, dict) and isinstance(tot.get("volume_mm3"), (int, float)):
            return tot["volume_mm3"]
        for v in obj.values():
            r = find_volume(v)
            if r:
                return r
    elif isinstance(obj, list):
        vols = [b.get("volume_mm3") for b in obj if isinstance(b, dict) and isinstance(b.get("volume_mm3"), (int, float))]
        if vols:
            return sum(vols)
        for v in obj:
            r = find_volume(v)
            if r:
                return r
    return None


def build(cli, a, fmt, outdir, est_only):
    name, params, size = spec(a["type"], a["nx"], a["ny"], a.get("nh", 1), a["wall"], a["front"], a["snap"])
    dims = f"{size[0]:.1f} x {size[1]:.1f} x {size[2]:.1f} mm"
    if est_only:
        vol, g = estimate(cli, params)
        print(f"{name:32s} {dims:28s} {vol:9.0f} mm3  ~{g:5.1f} g PLA")
        return
    out = outdir / f"{name}.{fmt}"
    run_cli(cli, params, out=out)
    print(f"OK  {out.name:36s} {dims}")


def parse_line(line, defaults):
    p = line.split("#")[0].split()
    if not p:
        return None
    kind = p[0].lower()
    nums = [int(x) for x in p[1:] if x.isdigit()]
    words = [x for x in p[1:] if not x.isdigit()]
    a = dict(defaults, type=kind, nx=nums[0], ny=nums[1], nh=nums[2] if len(nums) > 2 else 1)
    if words:
        a["wall"] = words[0]
    return a


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("type", nargs="?", choices=list(TYPES))
    ap.add_argument("nx", nargs="?", type=int)
    ap.add_argument("ny", nargs="?", type=int)
    ap.add_argument("nh", nargs="?", type=int, default=7, help="height units of 7 mm (default 7 = 53.3 mm)")
    ap.add_argument("--wall", default="std", help="lite | std | heavy | mm (default std)")
    ap.add_argument("--front", type=float, default=0.4, help="hopper front-lip height as a fraction of H (default 0.4)")
    ap.add_argument("--snap", type=float, default=0.6, help="snap bead in mm: 0.5 looser, 0.7 tighter (default 0.6)")
    ap.add_argument("--format", default="3mf", choices=["3mf", "stl", "step"])
    ap.add_argument("--out", type=Path, default=OUT_DIR)
    ap.add_argument("--list", type=Path, help="file with one spec per line: <type> <nx> <ny> [nh] [wall]")
    ap.add_argument("--estimate", action="store_true", help="print size and grams only, no export")
    args = ap.parse_args()

    if not MASTER.exists():
        sys.exit(f"master design missing: {MASTER}")
    cli = find_cli()
    args.out.mkdir(parents=True, exist_ok=True)
    defaults = {"wall": args.wall, "front": args.front, "snap": args.snap}

    jobs = []
    if args.list:
        for ln in args.list.read_text(encoding="utf-8").splitlines():
            a = parse_line(ln, defaults)
            if a:
                jobs.append(a)
    elif args.type and args.nx and args.ny:
        jobs.append(dict(defaults, type=args.type, nx=args.nx, ny=args.ny, nh=args.nh))
    else:
        ap.print_help()
        return

    failed = 0
    for a in jobs:
        try:
            build(cli, a, args.format, args.out, args.estimate)
        except Exception as e:  # keep going through a list
            failed += 1
            print(f"ERR {a['type']} {a['nx']}x{a['ny']}x{a.get('nh')}: {e}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
