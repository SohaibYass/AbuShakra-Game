"""Extract the foreground walkable surface (grass/rock tops) from Zugspitze.png
and save an overlay so we can verify it follows the painted ledges. Prints a
downsampled heightmap normalized to the game's 1:1 draw (imgH -> VIEW_H=450).
"""
from PIL import Image, ImageDraw

im = Image.open("Zugspitze.png").convert("RGB")
W, H = im.size
px = im.load()

VIEW_H = 450
SCALE_Y = VIEW_H / H            # image row -> game y when drawn 1:1 (imgH->VIEW_H)

def is_grass(r, g, b):
    return g > 95 and g > r * 1.12 and g > b * 1.05

def is_rock(r, g, b):
    br = (r + g + b) / 3
    return 55 < br < 175 and abs(r - g) < 26 and abs(g - b) < 30 and b < r + 20

# A real walkable ledge = grass with ROCK directly beneath it (grass-on-rock),
# which excludes tree foliage and the hazy distant valley. Scan the near-
# foreground band only.
def rock_below(x, y, depth=42):
    cnt = 0
    for yy in range(y + 3, min(y + depth, H)):
        if is_rock(*px[x, yy]):
            cnt += 1
    return cnt >= 12

top_y = [None] * W
y0 = int(0.55 * H)
for x in range(W):
    found = None
    # prefer a grass-on-rock ledge top
    for y in range(y0, H - 6):
        if is_grass(*px[x, y]) and rock_below(x, y):
            found = y
            break
    # fallback: a bare-rock surface (rock with rock below, none above nearby)
    if found is None:
        for y in range(int(0.62 * H), H - 6):
            if is_rock(*px[x, y]) and rock_below(x, y, 30):
                found = y
                break
    top_y[x] = found

# fill gaps (columns with no detection) by linear interpolation of neighbours
xs = [x for x in range(W) if top_y[x] is not None]
for x in range(W):
    if top_y[x] is None:
        # nearest known on each side
        left = next((xx for xx in range(x, -1, -1) if top_y[xx] is not None), None)
        right = next((xx for xx in range(x, W) if top_y[xx] is not None), None)
        if left is not None and right is not None:
            t = (x - left) / (right - left)
            top_y[x] = int(top_y[left] * (1 - t) + top_y[right] * t)
        elif left is not None:
            top_y[x] = top_y[left]
        elif right is not None:
            top_y[x] = top_y[right]
        else:
            top_y[x] = int(0.7 * H)

# smooth a little (moving average)
sm = top_y[:]
k = 9
for x in range(W):
    a = max(0, x - k); b = min(W, x + k + 1)
    sm[x] = sum(top_y[a:b]) // (b - a)
top_y = sm

# Downsample, convert to game coords, then clean: median-smooth out tree/cliff
# spikes and clamp into the walkable band so collision stays fair and climbable.
N = 120
pts_game = [top_y[int(i * (W - 1) / (N - 1))] * SCALE_Y for i in range(N)]

def median(seq, i, k):
    a = max(0, i - k); b = min(len(seq), i + k + 1)
    return sorted(seq[a:b])[(b - a) // 2]

clean = [median(pts_game, i, 4) for i in range(N)]      # median window 9
LO, HI = 318.0, 412.0
clean = [min(HI, max(LO, v)) for v in clean]
# limit slope between adjacent samples so there are no impossible walls
MAXD = 26.0
for i in range(1, N):
    d_ = clean[i] - clean[i - 1]
    if d_ > MAXD: clean[i] = clean[i - 1] + MAXD
    elif d_ < -MAXD: clean[i] = clean[i - 1] - MAXD
clean = [round(v, 1) for v in clean]

# overlay the CLEANED surface (converted back to image rows) for verification
ov = im.copy()
d = ImageDraw.Draw(ov)
sx = W / (N - 1)
for i in range(1, N):
    y0i = clean[i - 1] / SCALE_Y
    y1i = clean[i] / SCALE_Y
    d.line([((i - 1) * sx, y0i), (i * sx, y1i)], fill=(255, 0, 0), width=4)
ov.save("terrain_overlay.png")

tileW = W * SCALE_Y
# Quantize into flat LEDGES (snap heights to a grid, merge equal runs) so the
# player walks flat ground and steps/jumps between ledges of image-derived height.
GRID = 19.0
qy = [round(round(v / GRID) * GRID) for v in clean]
sx = tileW / (N - 1)
ledges = []
run_start = 0
for i in range(1, N + 1):
    if i == N or qy[i] != qy[run_start]:
        x0 = round((run_start - 0.5) * sx) if run_start > 0 else 0
        x1 = round((i - 0.5) * sx) if i < N else round(tileW)
        ledges.append((max(0, x0), x1, qy[run_start]))
        run_start = i
# JS-friendly output
js = ", ".join("{x0:%d,x1:%d,top:%d}" % (a, b, t) for (a, b, t) in ledges)
print("ZUG_TILE_W =", round(tileW))
print("ledge count =", len(ledges), " y min/max =", min(qy), max(qy))
print("ZUG_LEDGES = [" + js + "];")
