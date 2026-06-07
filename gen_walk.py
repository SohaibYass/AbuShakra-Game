"""Generate a 6-frame walk-cycle sprite sheet for Abu from the single static
character.png. Builds a tiny skeleton (torso + per-leg thigh & shin with a knee
joint) and poses it across 6 keyframes, then bakes a horizontal sprite sheet.

It's a front-view sprite, so this is a stylised marching walk (alternating knee
lifts with a shin tuck + body bob), not a true side-on stride — but it loops
cleanly as 6 real frames.
"""
import math
from PIL import Image

src = Image.open("character.png").convert("RGBA")
W, H = src.size

# --- geometry (from analysis) ---
CENTER   = 412
HIP_Y    = int(0.56 * H)     # legs hinge here
KNEE_Y   = int(0.78 * H)     # knee joint
TORSO_OVERLAP = int(0.04 * H)  # torso drops a touch past the hip to hide the seam

def crop(box):
    return src.crop(box)

# Segments (full-image coords)
torso = crop((0, 0, W, HIP_Y + TORSO_OVERLAP))
legL_thigh = crop((0, HIP_Y, CENTER, KNEE_Y))
legR_thigh = crop((CENTER, HIP_Y, W, KNEE_Y))
legL_shin  = crop((0, KNEE_Y, CENTER, H))
legR_shin  = crop((CENTER, KNEE_Y, W, H))

THIGH_LEN = KNEE_Y - HIP_Y
SHIN_LEN  = H - KNEE_Y

# horizontal centre of each leg (so rotations pivot through the limb)
def leg_center_x(half_img, x_offset):
    bb = half_img.getbbox()
    if not bb:
        return x_offset + half_img.size[0] // 2
    return x_offset + (bb[0] + bb[2]) // 2

LX = leg_center_x(legL_thigh, 0)
RX = leg_center_x(legR_thigh, CENTER)

def rotate_about(seg, pivot_local, angle_deg):
    """Return (rotated_img, pivot_xy_in_rotated) rotating seg about pivot_local."""
    w, h = seg.size
    R = int(2 * math.hypot(w, h)) + 4
    big = Image.new("RGBA", (R, R), (0, 0, 0, 0))
    ox, oy = R // 2 - pivot_local[0], R // 2 - pivot_local[1]
    big.alpha_composite(seg, (ox, oy))
    rot = big.rotate(angle_deg, resample=Image.BICUBIC, center=(R // 2, R // 2))
    return rot, (R // 2, R // 2)

def paste_pivot(canvas, seg, pivot_local, target, angle_deg):
    rot, piv = rotate_about(seg, pivot_local, angle_deg)
    canvas.alpha_composite(rot, (int(target[0] - piv[0]), int(target[1] - piv[1])))

def rotvec(dx, dy, deg):
    a = math.radians(deg)
    return (dx * math.cos(a) - dy * math.sin(a),
            dx * math.sin(a) + dy * math.cos(a))

# Padding so body bob / shoulder rock / sway never clip the head or sides.
PAD_X = int(0.12 * W)
PAD_Y = int(0.12 * H)        # headroom at the top
OX, OY = PAD_X, PAD_Y        # canvas offset added to every paste target

def pose_leg(canvas, thigh, shin, cx, thigh_deg, shin_deg, lift_px=0):
    """FK: thigh hinges at the (optionally raised) hip; shin hinges at the knee.
    lift_px raises the whole leg so the foot comes off the ground (a step)."""
    hip = (cx + OX, HIP_Y + OY - lift_px)
    half_start = 0 if cx < CENTER else CENTER
    thigh_piv = (cx - half_start, 0)
    paste_pivot(canvas, thigh, thigh_piv, hip, thigh_deg)
    kdx, kdy = rotvec(0, THIGH_LEN, thigh_deg)
    knee = (hip[0] + kdx, hip[1] + kdy)
    shin_piv = (cx - half_start, 0)
    paste_pivot(canvas, shin, shin_piv, knee, thigh_deg + shin_deg)

FRAMES   = 10
THIGH_AMP = 5.0          # deg: slight inward knee tilt while stepping
SHIN_AMP  = 30.0         # deg: knee tuck (foot folds up) on the lifting leg
LIFT_PX   = int(0.085 * H)   # how high the stepping foot rises
# --- body (torso) motion, synced to the steps ---
BOB_AMP   = int(0.022 * H)   # vertical bob of the whole upper body
ROCK_DEG  = 2.6          # shoulders rock side-to-side each step
SWAY_PX   = int(0.016 * W)   # weight shift toward the planted leg

frames = []
for i in range(FRAMES):
    ph = 2 * math.pi * i / FRAMES
    canvas = Image.new("RGBA", (W + 2 * PAD_X, H + PAD_Y), (0, 0, 0, 0))

    # per-leg lift factor (0..1): each leg steps on its half of the cycle
    liftR = max(0.0, math.sin(ph))
    liftL = max(0.0, math.sin(ph + math.pi))

    # Lifting leg: raise it, tilt the knee slightly inward, tuck the shin so the
    # foot kicks up. The planted leg stays put. (Inward tilt + tuck reads as a
    # marching step from the front, instead of the legs splaying outward.)
    pose_leg(canvas, legL_thigh, legL_shin, LX,
             +THIGH_AMP * liftL, +SHIN_AMP * liftL, int(LIFT_PX * liftL))
    pose_leg(canvas, legR_thigh, legR_shin, RX,
             -THIGH_AMP * liftR, -SHIN_AMP * liftR, int(LIFT_PX * liftR))

    # The upper body moves with the legs: bob up at mid-step, rock the shoulders
    # side-to-side, and sway toward the planted leg (weight shift). The torso is
    # rotated about the pelvis so the head/shoulders swing while the hips stay.
    bob  = -int(BOB_AMP * max(liftL, liftR))
    rock = ROCK_DEG * math.sin(ph)
    sway = int(SWAY_PX * (liftL - liftR))
    paste_pivot(canvas, torso, (CENTER, HIP_Y), (CENTER + OX + sway, HIP_Y + OY + bob), rock)

    frames.append(canvas)

# --- bake a downscaled horizontal sheet ---
CW, CHH = W + 2 * PAD_X, H + PAD_Y          # padded cell size (full res)
SCALE = 0.26
cw, chh = int(CW * SCALE), int(CHH * SCALE)
sheet = Image.new("RGBA", (cw * FRAMES, chh), (0, 0, 0, 0))
for i, f in enumerate(frames):
    fs = f.resize((cw, chh), Image.LANCZOS)
    sheet.paste(fs, (i * cw, 0), fs)
sheet.save("character_walk.png")
print("saved character_walk.png", sheet.size, "cell", (cw, chh), "frames", FRAMES)
print("geom CENTER", CENTER, "HIP_Y", HIP_Y, "KNEE_Y", KNEE_Y, "LX", LX, "RX", RX)
# The game must mirror these padding fractions to place the body correctly:
print("PAD_X_FRAC=%.4f PAD_Y_FRAC=%.4f" % (PAD_X / W, PAD_Y / H))
