#!/usr/bin/env python3
"""Recreate the Terminal Alvorada aerial assets (requires Python and Pillow).

Source: Instituto Pereira Passos / Prefeitura da Cidade do Rio de Janeiro.
Mosaico 2019, licensed CC BY 4.0. Changes: georeferenced crop, resampling,
feathered edges and WebP conversion. Run from any directory.
"""

from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

from PIL import Image


IMAGE_SERVICE = "https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Imagens/Mosaico_2019/ImageServer/exportImage"
TARGET_DIR = Path(__file__).resolve().parents[1] / "src"
CENTER_EAST, CENTER_NORTH = 667457.8656, 7455334.2807
PIXELS = 2048
CROPS = [("context", 3200, 400), ("detail", 1200, 140)]


def edge_mask(size, fade):
    def opacity(index):
        distance = min(index, PIXELS - 1 - index) * size / PIXELS
        phase = min(1, distance / fade)
        return round(phase * phase * (3 - 2 * phase) * 255)

    ramp = bytes(opacity(index) for index in range(PIXELS))
    return Image.frombytes("L", (PIXELS, PIXELS), b"".join(
        bytes(min(vertical, horizontal) for horizontal in ramp) for vertical in ramp
    ))


def export_crop(crop):
    name, size, fade = crop
    radius = size / 2
    extent = [CENTER_EAST - radius, CENTER_NORTH - radius, CENTER_EAST + radius, CENTER_NORTH + radius]
    query = urlencode({
        "bbox": ",".join(f"{coordinate:.4f}" for coordinate in extent),
        "bboxSR": 31983,
        "imageSR": 31983,
        "size": f"{PIXELS},{PIXELS}",
        "format": "jpg",
        "compressionQuality": 93,
        "interpolation": "RSP_BilinearInterpolation",
        "f": "image",
    })
    with urlopen(f"{IMAGE_SERVICE}?{query}", timeout=90) as response:
        image = Image.open(BytesIO(response.read())).convert("RGBA")
    if image.size != (PIXELS, PIXELS):
        raise ValueError(f"Tamanho inesperado no recorte {name}: {image.size}")

    image.putalpha(edge_mask(size, fade))
    target = TARGET_DIR / f"alvorada-ipp-2019-{name}.webp"
    temporary = target.with_suffix(".webp.part")
    try:
        image.save(temporary, format="WEBP", quality=84, method=6)
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)
    return target


if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=2) as executor:
        for saved in executor.map(export_crop, CROPS):
            print(saved)
