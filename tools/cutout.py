"""Shared helpers for cutting hands out of light-grey studio photos."""

import numpy as np
from PIL import Image, ImageFilter


def _grow(seed, allowed):
    """Region-grow `seed` through 4-connected `allowed` pixels until it stops changing."""
    region = seed & allowed
    while True:
        grown = region.copy()
        grown[1:, :] |= region[:-1, :]
        grown[:-1, :] |= region[1:, :]
        grown[:, 1:] |= region[:, :-1]
        grown[:, :-1] |= region[:, 1:]
        grown &= allowed
        if np.array_equal(grown, region):
            return region
        region = grown


def cut_out(im, keep_largest=False):
    """Return an RGBA image with the neutral grey background made transparent (soft, fringe-free edge)."""
    im = im.convert("RGB")
    rgb = np.asarray(im).astype(np.int16)

    # Background = bright and neutral grey. Skin is noticeably more saturated.
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    lum = rgb.mean(axis=2)
    bg_like = (chroma < 22) & (lum > 175)

    # Only background connected to the border counts (so nothing inside the hand gets punched out).
    border = np.zeros_like(bg_like)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    background = _grow(border, bg_like)
    hand = ~background

    if keep_largest:
        # Drop stray bits (e.g. the edge of another hand) by keeping the blob that holds the centre-most hand pixel.
        ys, xs = np.nonzero(hand)
        cy, cx = hand.shape[0] / 2, hand.shape[1] / 2
        i = np.argmin((ys - cy) ** 2 + (xs - cx) ** 2)
        seed = np.zeros_like(hand)
        seed[ys[i], xs[i]] = True
        hand = _grow(seed, hand)

    radius = max(1, round(min(im.size) / 700))
    alpha = Image.fromarray(np.where(hand, 255, 0).astype(np.uint8))
    alpha = alpha.filter(ImageFilter.MinFilter(2 * radius + 1))  # pull the edge in to lose the grey fringe
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.8 * radius + 0.4))  # soft edge

    out = im.convert("RGBA")
    out.putalpha(alpha)
    return out.crop(alpha.getbbox())


def fade_edge(im, edge="top", amount=0.22):
    """Fade the cut-off end of the arm to transparent."""
    a = np.asarray(im.getchannel("A")).astype(np.float32)
    n = int(im.height * amount)
    ramp = np.ones(im.height, dtype=np.float32)
    ramp[:n] = np.linspace(0, 1, n) ** 1.6
    if edge == "bottom":
        ramp = ramp[::-1]
    im = im.copy()
    im.putalpha(Image.fromarray((a * ramp[:, None]).astype(np.uint8)))
    return im


def match_skin(im, reference):
    """Shift `im`'s skin colours to match `reference` (per-channel mean/spread over opaque pixels)."""
    src = np.asarray(im).astype(np.float32)
    ref = np.asarray(reference.convert("RGBA")).astype(np.float32)
    src_skin = src[src[..., 3] > 200][:, :3]
    ref_skin = ref[ref[..., 3] > 200][:, :3]
    out = src.copy()
    for c in range(3):
        s_mean, s_std = src_skin[:, c].mean(), src_skin[:, c].std() + 1e-6
        r_mean, r_std = ref_skin[:, c].mean(), ref_skin[:, c].std()
        out[..., c] = (src[..., c] - s_mean) * (r_std / s_std) + r_mean
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")
