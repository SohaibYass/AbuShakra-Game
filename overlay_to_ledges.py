"""Read the red collision line drawn on a *_terrain_overlay.png and turn it into
a DENSE surface heightmap (e.g. ZUG_SURF / GLOCK_SURF) for a natural level —
following the drawn line exactly (slopes and steps), not snapped to flat ledges.

Usage:  python overlay_to_ledges.py [overlay.png] [VAR_NAME] [check_out.png]
  default: terrain_overlay.png  ZUG_SURF  ledges_check.png
"""
import sys
from PIL import Image, ImageDraw

OVERLAY = sys.argv[1] if len(sys.argv) > 1 else "terrain_overlay.png"
VARNAME = sys.argv[2] if len(sys.argv) > 2 else "ZUG_SURF"
CHECK   = sys.argv[3] if len(sys.argv) > 3 else "ledges_check.png"

ov = Image.open(OVERLAY).convert("RGB")
W, H = ov.size
px = ov.load()
VIEW_H = 450
SCALE_Y = VIEW_H / H

def is_red(r, g, b):
    # strict: the drawn line is pure/bright red, not warm orange-brown rock
    return r > 165 and g < 90 and b < 90 and r - g > 95 and r - b > 95

# Red-line y per column. The stroke is THIN, so a thin red run IS the surface
# (this preserves high ledges). Pick the thin run nearest the previous column for
# continuity. Pure-vertical columns (only a tall run) are left blank and become
# interpolated ramps between ledges.
def runs_in_col(x):
    # strict is_red only matches the drawn line, so we can scan high up and still
    # capture tall ledges (without catching sunset sky / warm rock).
    reds = [y for y in range(int(0.15 * H), H) if is_red(*px[x, y])]
    if not reds:
        return []
    out = []
    s = p = reds[0]
    for y in reds[1:]:
        if y - p <= 5:
            p = y
        else:
            out.append((s, p)); s = p = y
    out.append((s, p))
    return out

# Per column take the TOP-most real stroke (captures high ledges; steps resolve
# cleanly). Thin spikes from steep cliff overlaps are removed by a median filter
# on the sampled surface further down.
line = [None] * W
for x in range(W):
    runs = [r for r in runs_in_col(x) if r[1] - r[0] >= 1]
    if not runs:
        continue
    s, e = min(runs, key=lambda r: r[0])
    line[x] = s + 2

known = [x for x in range(W) if line[x] is not None]
if not known:
    raise SystemExit("No red line found in terrain_overlay.png")
# extend ends, then linearly interpolate interior gaps
for x in range(0, known[0]):
    line[x] = line[known[0]]
for x in range(known[-1] + 1, W):
    line[x] = line[known[-1]]
for x in range(W):
    if line[x] is None:
        left = next(xx for xx in range(x, -1, -1) if line[xx] is not None)
        right = next(xx for xx in range(x, W) if line[xx] is not None)
        t = (x - left) / (right - left)
        line[x] = round(line[left] * (1 - t) + line[right] * t)

# light median de-noise (kills 1px stroke jitter, keeps real shape)
sm = line[:]
k = 3
for x in range(W):
    a = max(0, x - k); b = min(W, x + k + 1)
    sm[x] = sorted(line[a:b])[(b - a) // 2]
line = sm

# Sample a dense heightmap in GAME coords across one tile.
N = 226                                  # ~4px game spacing
tileW = W * SCALE_Y
surf = [line[round(i * (W - 1) / (N - 1))] * SCALE_Y for i in range(N)]

# Median filter to remove thin spikes (steep-cliff overlap artifacts) while
# preserving wide ledges and real step edges.
mk = 4
med = surf[:]
for i in range(N):
    a = max(0, i - mk); b = min(N, i + mk + 1)
    med[i] = sorted(surf[a:b])[(b - a) // 2]
surf = med

# Climb-rate cap: a wall taller than the player's jump (~144px) is impassable and
# would trap the player (and the tile repeats). Limit how fast the surface may
# RISE per sample so any too-steep cliff becomes an auto-walkable steep slope.
# Drops are left alone (you can always fall off a ledge). FORWARD-only so the
# climb ramps up *at* the cliff and follows the drawn line up to the top — a
# backward pass would ramp up early and create a false peak before the cliff.
MAX_RISE = 14.0          # px up per ~4px sample -> auto-walkable slope
for i in range(1, N):
    if surf[i] < surf[i - 1] - MAX_RISE:
        surf[i] = surf[i - 1] - MAX_RISE
surf = [round(v, 1) for v in surf]

# verification overlay: draw the EXACT sampled surface in bright green
chk = ov.copy()
d = ImageDraw.Draw(chk)
dx_img = (W - 1) / (N - 1)
for i in range(1, N):
    x0 = (i - 1) * dx_img; x1 = i * dx_img
    y0 = surf[i - 1] / SCALE_Y; y1 = surf[i] / SCALE_Y
    d.line([(x0, y0), (x1, y1)], fill=(0, 255, 0), width=3)
chk.save(CHECK)

print("TILE_W =", round(tileW))
print("N =", N, " game_y min/max =", min(surf), max(surf))
print("const %s = [" % VARNAME + ", ".join(str(v) for v in surf) + "];")
