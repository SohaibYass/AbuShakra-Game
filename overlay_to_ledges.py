"""Read the red collision line drawn on terrain_overlay.png and turn it into a
DENSE surface heightmap (ZUG_SURF) for Level 1 — following the drawn line exactly
(slopes and steps), not snapped to flat ledges. Edit the red line in
terrain_overlay.png and re-run to update the in-game terrain.
"""
from PIL import Image, ImageDraw

ov = Image.open("terrain_overlay.png").convert("RGB")
W, H = ov.size
px = ov.load()
VIEW_H = 450
SCALE_Y = VIEW_H / H

def is_red(r, g, b):
    return r > 150 and g < 110 and b < 110 and r - g > 60 and r - b > 60

# Red-line y per column. The stroke is THIN, so a thin red run IS the surface
# (this preserves high ledges). Pick the thin run nearest the previous column for
# continuity. Pure-vertical columns (only a tall run) are left blank and become
# interpolated ramps between ledges.
def runs_in_col(x):
    reds = [y for y in range(int(0.50 * H), H) if is_red(*px[x, y])]
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

line = [None] * W
for x in range(W):
    runs = [r for r in runs_in_col(x) if r[1] - r[0] >= 1]   # ignore 1px specks
    if not runs:
        continue
    s, e = min(runs, key=lambda r: r[0])    # TOP-most stroke = highest surface here
    line[x] = s + 2                          # ~centre of the thin stroke

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
surf = [round(line[round(i * (W - 1) / (N - 1))] * SCALE_Y, 1) for i in range(N)]

# verification overlay: draw the EXACT sampled surface in bright green
chk = ov.copy()
d = ImageDraw.Draw(chk)
dx_img = (W - 1) / (N - 1)
for i in range(1, N):
    x0 = (i - 1) * dx_img; x1 = i * dx_img
    y0 = surf[i - 1] / SCALE_Y; y1 = surf[i] / SCALE_Y
    d.line([(x0, y0), (x1, y1)], fill=(0, 255, 0), width=3)
chk.save("ledges_check.png")

print("ZUG_TILE_W =", round(tileW))
print("N =", N, " game_y min/max =", min(surf), max(surf))
print("ZUG_SURF = [" + ", ".join(str(v) for v in surf) + "];")
