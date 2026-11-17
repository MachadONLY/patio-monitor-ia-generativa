"""Assemble the reproducible Computer Vision demonstration from tested artifacts."""

import argparse
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
VIDEO = ROOT / "services/vision/artifacts/annotated.mp4"
SCREEN = ROOT / "docs/qa/gs-visao-camera.png"
OUTPUT = ROOT / "docs/gs/cv/Patio-Monitor-Demonstracao-Visao.mp4"
BG = "#F6F8F4"
INK = "#17392D"
MUTED = "#50675E"
GREEN = "#237858"


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)


def font(size, bold=False):
    for name in (["DejaVuSans-Bold.ttf"] if bold else ["DejaVuSans.ttf"]):
        path = Path("/usr/share/fonts/truetype/dejavu") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default(size=size)


def page(kicker, title, detail=(), footer="", picture=None):
    image = Image.new("RGB", (1280, 720), BG)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((55, 40, 1225, 680), radius=26, fill="#FFFFFF", outline="#DCE9DF", width=2)
    draw.rounded_rectangle((78, 65, 92, 120), radius=6, fill=GREEN)
    draw.text((117, 69), kicker.upper(), font=font(18, True), fill=GREEN)
    draw.line((92, 139, 1188, 139), fill="#E5EEE7", width=2)
    if picture:
        preview = Image.open(picture).convert("RGB")
        preview.thumbnail((1040, 470), Image.Resampling.LANCZOS)
        image.paste(preview, ((1280 - preview.width)//2, 169 + (465 - preview.height)//2))
        draw.text((102, 642), title[0], font=font(19, True), fill=INK)
    else:
        y = 183
        for line in title:
            draw.text((102, y), line, font=font(47, True), fill=INK)
            y += 70
        y += 21
        for line in detail:
            draw.text((105, y), line, font=font(23), fill=MUTED)
            y += 47
        draw.text((102, 615), footer, font=font(16), fill=MUTED)
    return image


def make_video(destination):
    if not VIDEO.is_file() or not SCREEN.is_file():
        raise FileNotFoundError("Annotated footage or documented camera UI missing")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as folder:
        temp = Path(folder)
        crossing = temp / "crossing.png"
        run("ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-ss", "7.44", "-i", str(VIDEO), "-frames:v", "1", str(crossing))
        camera = temp / "camera.png"
        Image.open(SCREEN).convert("RGB").crop((181, 132, 1090, 683)).save(camera)
        scenes = [
            (6, page("FIAP 2026.2 / COMPUTER VISION",
                ["Pátio Monitor", "Detecção e rastreamento de ônibus"],
                ["Prova de funcionamento com gravação real.",
                 "Cruzamentos detectados e evidência conferível."],
                "Gabriel Machado · RM551570  |  Felipe Bressani · RM97688  |  Camila do Prado Padalino · RM98316")),
            (6, page("ARQUITETURA / DETECTOR CUSTOMIZADO",
                ["YOLOX + classificação própria", "Rastreamento por linha virtual"],
                ["A YOLOX propõe regiões e duas cabeças são treinadas.",
                 "A direção é extraída dos quadros da gravação."],
                "Fonte: ŠJů / Wikimedia Commons · CC BY 4.0")),
            (8, page("SISTEMA / INTERFACE NAVEGÁVEL",
                ["A gravação está ligada à ocorrência"], picture=camera)),
            (12, None),
            (8, page("EVENTO DETECTADO / 00:07,44",
                ["Passagem esquerda → direita"], picture=crossing)),
            (9, page("AVALIAÇÃO / DADOS REPRODUZÍVEIS",
                ["33 quadros de treino", "10 de validação · F1 70,6%",
                 "11 de teste · F1 100% na amostra"],
                ["O teste é uma gravação sem quadros negativos.",
                 "Resultados não comprovam generalização em terminais."],
                "Métricas, anotações e pesos estão versionados no GitHub.")),
            (8, page("TESTE EM UM CLIQUE",
                ["1. Abra Câmera do portão", "2. Reproduza a gravação",
                 "3. Selecione o evento em 00:07,4"],
                ["O player abre o instante e mostra a confiança.",
                 "É uma gravação de referência, não uma câmera ao vivo."],
                "github.com/MachadONLY/patio-monitor-computer-vision")),
        ]
        segments = []
        for index, (seconds, still) in enumerate(scenes):
            out = temp / f"part-{index:02d}.mp4"
            if still:
                image = temp / f"slide-{index:02d}.png"
                still.save(image)
                run("ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-loop", "1", "-framerate", "25", "-i", str(image),
                    "-t", str(seconds), "-vf", "fps=25,format=yuv420p",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", str(out))
            else:
                run("ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-i", str(VIDEO), "-vf",
                    "scale=1280:720:force_original_aspect_ratio=decrease,"
                    "pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0E2119,setsar=1,fps=25",
                    "-t", str(seconds), "-an", "-c:v", "libx264",
                    "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", str(out))
            segments.append(out)
        manifest = temp / "concat.txt"
        manifest.write_text("".join(f"file '{part}'\n" for part in segments), encoding="utf-8")
        run("ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "concat", "-safe", "0", "-i", str(manifest), "-c", "copy",
            "-movflags", "+faststart", str(destination))
    print(f"Demonstration: {destination} ({destination.stat().st_size} bytes)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=OUTPUT)
    make_video(parser.parse_args().output)
