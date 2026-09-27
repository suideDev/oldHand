"""Cut the peace-sign hand out of its photo and colour-match it to the grabbing hand.

Usage: python tools/prepare-peace.py <photo> [reference hand] [output]

- Removes the light grey background and any stray bits of other hands.
- Fades the cut-off end of the arm (at the bottom; fingers already point up).
- Shifts the skin tone to match the grabbing hand so the two read as the same person.
"""

import sys

from PIL import Image

from cutout import cut_out, fade_edge, match_skin

src = sys.argv[1]
ref = sys.argv[2] if len(sys.argv) > 2 else "grasping-hand/images/hand.webp"
out = sys.argv[3] if len(sys.argv) > 3 else "grasping-hand/images/peace.webp"

cut = cut_out(Image.open(src), keep_largest=True)
cut = match_skin(cut, Image.open(ref))
cut = fade_edge(cut, "bottom", 0.25)
cut.save(out, "WEBP", quality=90, method=6)
print(f"saved {out} {cut.size}")
