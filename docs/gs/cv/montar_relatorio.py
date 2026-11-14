"""Render the FIAP Applied Computer Vision report from verified run data."""

import argparse
from html import escape
import json
from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


HERE = Path(__file__).resolve().parent
FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
INK = colors.HexColor("#102A22")
MUTED = colors.HexColor("#4A6058")
ACCENT = colors.HexColor("#17664D")
FAINT = colors.HexColor("#E8F1EB")
BORDER = colors.HexColor("#CBDDD3")
REPO = "https://github.com/MachadONLY/patio-monitor-computer-vision"


def word_count(text):
    return len(re.findall(r"[^\W_]+(?:[-’'][^\W_]+)*", text))


def paragraph(text, style):
    return Paragraph(escape(text).replace("\n", "<br/>"), style)


def header_footer(canvas, doc):
    width, height = doc.pagesize
    canvas.setFillColor(ACCENT)
    canvas.setFont("CVSansBold", 9)
    canvas.drawString(20 * mm, height - 15 * mm, "PÁTIO MONITOR  /  FIAP GLOBAL SOLUTION 2026.2")
    canvas.setStrokeColor(BORDER)
    canvas.line(20 * mm, height - 18 * mm, width - 20 * mm, height - 18 * mm)
    canvas.line(20 * mm, 16 * mm, width - 20 * mm, 16 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("CVSans", 8)
    canvas.drawString(20 * mm, 10 * mm, "Applied Computer Vision  |  CitizenTech  |  Engenharia de Software")
    canvas.drawRightString(width - 20 * mm, 10 * mm, f"{doc.page:02d}")


def render(content, output):
    for family, font_file in {
        "CVSans": "DejaVuSans.ttf",
        "CVSansBold": "DejaVuSans-Bold.ttf",
    }.items():
        pdfmetrics.registerFont(TTFont(family, str(FONT_DIR / font_file)))

    styles = {}
    for tag, font, font_size, leading, color, after in [
        ("eyebrow", "CVSansBold", 9, 12, ACCENT, 8),
        ("title", "CVSansBold", 27, 31, INK, 10),
        ("subtitle", "CVSans", 11, 16, MUTED, 13),
        ("section", "CVSansBold", 16, 21, INK, 8),
        ("subsection", "CVSansBold", 11, 15, ACCENT, 5),
        ("body", "CVSans", 9.6, 15.2, INK, 8),
        ("caption", "CVSans", 8, 12, MUTED, 8),
        ("table", "CVSans", 8.5, 13, INK, 0),
        ("table_head", "CVSansBold", 8.5, 13, INK, 0),
    ]:
        styles[tag] = ParagraphStyle(
            tag, fontName=font, fontSize=font_size, leading=leading,
            textColor=color, spaceAfter=after, alignment=TA_LEFT,
            keepWithNext=tag in {"eyebrow", "section", "subsection"},
        )

    def p(text, style="body"):
        return paragraph(text, styles[style])

    def link(label, url):
        return Paragraph(
            f'<link href="{escape(url, quote=True)}" color="#17664D">{escape(label)}</link>',
            styles["caption"],
        )

    def table(rows, widths):
        head, *body = rows
        cells = [[p(item, "table_head") for item in head]]
        cells.extend([[p(item, "table") for item in row] for row in body])
        grid = Table(cells, colWidths=[width * mm for width in widths], hAlign="LEFT", repeatRows=1)
        grid.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), FAINT),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, BORDER),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        return grid

    if word_count(content["resumo"]) != 250 or word_count(content["objetivo"]) != 50:
        raise ValueError(
            f"Resumo tem {word_count(content['resumo'])} palavras e objetivo "
            f"tem {word_count(content['objetivo'])}. Use 250 e 50."
        )

    story = [
        p("RELATÓRIO TÉCNICO  /  DISCIPLINA 4 DE 7", "eyebrow"),
        p("Detecção de ônibus e cruzamentos por câmera", "title"),
        p("Componente de visão computacional do Pátio Monitor", "subtitle"),
        p("Integrantes", "subsection"),
        p("\n".join(content["integrantes"])),
        link("Repositório do projeto: github.com/MachadONLY/patio-monitor-computer-vision", REPO),
        Spacer(1, 4 * mm),
        p("Resumo", "section"),
    ]
    story.extend(p(block) for block in content["resumo"].split("\n\n"))
    story += [p("Objetivo", "section"), p(content["objetivo"]), PageBreak()]

    story += [p("Introdução", "section"), p(content["introducao"]), p("Ferramentas e arquitetura", "section")]
    story.extend(p(block) for block in content["ferramentas"])
    story += [p("Metodologia passo a passo", "section")]
    story.extend(p(f"{index}. {step}") for index, step in enumerate(content["metodologia"], 1))
    story.append(PageBreak())

    story += [
        p("Avaliação do detector", "section"),
        p(content["avaliacao"]),
        table(content["tabela_dados"], [52, 32, 28, 28, 30]),
        Spacer(1, 3 * mm),
        table(content["tabela_metricas"], [50, 60, 60]),
        Spacer(1, 3 * mm),
        p(content["explicacao_metricas"], "caption"),
        p("Passagens no vídeo", "section"),
        table(content["tabela_eventos"], [32, 79, 59]),
        Spacer(1, 2 * mm),
        p(content["explicacao_eventos"], "caption"),
        PageBreak(),
    ]

    story.append(p("Exemplos e conclusão", "section"))
    for example in content["exemplos"]:
        source = HERE / example["arquivo"]
        image = Image(str(source))
        scale = min((153 * mm) / image.imageWidth, (59 * mm) / image.imageHeight)
        image.drawWidth = image.imageWidth * scale
        image.drawHeight = image.imageHeight * scale
        image.hAlign = "LEFT"
        story += [image, Spacer(1, 2 * mm), p(example["legenda"], "caption")]
    story += [p("Conclusão", "section"), p(content["conclusao"]), p("Referências e reprodução", "subsection")]
    story.extend(link(entry["titulo"], entry["url"]) for entry in content["fontes"])
    story.append(p("Enunciado Desafio FIAP GS CitizenTech 4ES, pp. 24 e 43–44.", "caption"))

    doc = SimpleDocTemplate(
        str(output), topMargin=25 * mm, bottomMargin=22 * mm,
        leftMargin=20 * mm, rightMargin=20 * mm,
        title="Pátio Monitor | Detecção de ônibus e cruzamentos por câmera",
        author="Equipe Pátio Monitor",
        subject="Global Solution 2026.2 | Applied Computer Vision",
    )
    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("content", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    render(json.loads(args.content.read_text(encoding="utf-8")), args.output)
