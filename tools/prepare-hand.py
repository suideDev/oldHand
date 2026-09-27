"""Cut the grabbing hand out of the stock photo and turn it into the module's hand image.

Usage: python tools/prepare-hand.py <photo> [output]

- Removes the light grey studio background (gaps between fingers go transparent too).
- Rotates it so the arm is at the top and the fingers point down (the module turns it over
  on screen so it reaches up from below).
- Fades the cut-off end of the arm so it looks like it reaches in from the dark.
"""

import sys

from PIL import Image

from cutout import cut_out, fade_edge

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else "grasping-hand/images/hand.webp"

cut = cut_out(Image.open(src))
# Arm on the left, fingers pointing right -> arm at the top, fingers pointing down.
cut = cut.rotate(-90, expand=True)
cut = fade_edge(cut, "top")

# Plenty for a card-sized hand, even on high-DPI displays.
target_w = 520
cut = cut.resize((target_w, round(cut.height * target_w / cut.width)), Image.LANCZOS)
cut.save(out, "WEBP", quality=88, method=6)
print(f"saved {out} {cut.size}")
