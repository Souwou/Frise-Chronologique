#!/usr/bin/env python3
"""Génère les icônes de l'appli : des strates colorées (Trias → Néogène) sur fond sombre."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons"
BG = (27, 33, 30)
STRATA = ["#812B92", "#34B2C9", "#7FC64E", "#FD9A52", "#FFE619"]


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def draw(size, safe, rounded):
    scale = 4  # sur-échantillonnage pour des bords nets
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=BG)
    else:
        d.rectangle([0, 0, s, s], fill=BG)
    inner = s * safe
    x0 = (s - inner) / 2
    gap = inner * 0.045
    h = (inner - gap * (len(STRATA) - 1)) / len(STRATA)
    for i, c in enumerate(STRATA):
        y = x0 + i * (h + gap)
        # chaque strate un peu décalée, comme des couches de roche
        shift = inner * (0.06 if i % 2 else 0)
        d.rounded_rectangle([x0 + shift, y, x0 + inner - (inner * 0.06 - shift), y + h],
                            radius=int(h * 0.22), fill=hex_rgb(c))
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(exist_ok=True)
draw(192, 0.62, True).save(OUT / "icon-192.png")
draw(512, 0.62, True).save(OUT / "icon-512.png")
draw(512, 0.5, False).convert("RGB").save(OUT / "icon-maskable-512.png")
draw(180, 0.6, False).convert("RGB").save(OUT / "apple-touch-icon.png")
print("icônes générées dans", OUT)
