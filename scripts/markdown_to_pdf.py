#!/usr/bin/env python3
import html
import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, Preformatted, SimpleDocTemplate, Spacer, Table, TableStyle


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Title1", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22, leading=27, spaceAfter=14))
styles.add(ParagraphStyle(name="H1x", parent=styles["Heading1"], fontSize=17, leading=21, spaceBefore=12, spaceAfter=8))
styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"], fontSize=14, leading=18, spaceBefore=10, spaceAfter=6))
styles.add(ParagraphStyle(name="H3x", parent=styles["Heading3"], fontSize=12, leading=15, spaceBefore=8, spaceAfter=4))
styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontSize=9.2, leading=12, spaceAfter=5, alignment=TA_LEFT))
styles.add(ParagraphStyle(name="Bulletx", parent=styles["BodyText"], fontSize=9.2, leading=12, leftIndent=14, firstLineIndent=-8, spaceAfter=3))
styles.add(ParagraphStyle(name="Smallx", parent=styles["BodyText"], fontSize=7.5, leading=9, spaceAfter=2))
styles.add(
    ParagraphStyle(
        name="CodeBlockx",
        fontName="Courier",
        fontSize=6.8,
        leading=8.2,
        backColor=colors.HexColor("#f6f8fa"),
        borderColor=colors.HexColor("#d0d7de"),
        borderWidth=0.4,
        borderPadding=5,
        splitLongWords=True,
    )
)


def inline(text: str) -> str:
    text = html.escape(text)
    text = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    return text


def table_from(lines: list[str]):
    rows = []
    for line in lines:
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", cell or "") for cell in cells):
            continue
        rows.append([Paragraph(inline(cell), styles["Smallx"]) for cell in cells])

    if not rows:
        return []

    col_count = max(len(row) for row in rows)
    for row in rows:
        while len(row) < col_count:
            row.append(Paragraph("", styles["Smallx"]))

    usable_width = A4[0] - 3.2 * cm
    table = Table(rows, colWidths=[usable_width / col_count] * col_count, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e9eef7")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#111827")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#c9ced8")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return [table, Spacer(1, 7)]


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.grey)
    canvas.drawRightString(A4[0] - 1.6 * cm, 0.8 * cm, f"Pagina {doc.page}")
    canvas.restoreState()


def build(markdown_path: Path, pdf_path: Path):
    text = markdown_path.read_text(encoding="utf-8")
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        rightMargin=1.6 * cm,
        leftMargin=1.6 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        title=markdown_path.stem,
    )

    story = []
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        stripped = line.strip()

        if not stripped:
            story.append(Spacer(1, 4))
            i += 1
            continue

        if line.startswith("```"):
            block = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                block.append(lines[i])
                i += 1
            i += 1
            story.append(Preformatted("\n".join(block), styles["CodeBlockx"]))
            story.append(Spacer(1, 6))
            continue

        if line.startswith("|") and "|" in line[1:]:
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            story.extend(table_from(table_lines))
            continue

        heading = re.match(r"^(#{1,6})\s+(.*)", line)
        if heading:
            level = len(heading.group(1))
            text = inline(heading.group(2))
            if level == 1:
                story.append(Paragraph(text, styles["Title1"]))
            elif level == 2:
                story.append(Paragraph(text, styles["H1x"]))
            elif level == 3:
                story.append(Paragraph(text, styles["H2x"]))
            else:
                story.append(Paragraph(text, styles["H3x"]))
            i += 1
            continue

        if stripped == "---":
            story.append(Spacer(1, 8))
            i += 1
            continue

        if re.match(r"^\s*[-*]\s+", line):
            text = re.sub(r"^\s*[-*]\s+", "• ", line)
            story.append(Paragraph(inline(text), styles["Bulletx"]))
            i += 1
            continue

        if re.match(r"^\s*\d+\.\s+", line):
            story.append(Paragraph(inline(stripped), styles["Bulletx"]))
            i += 1
            continue

        paragraph = [stripped]
        i += 1
        while i < len(lines):
            nxt = lines[i]
            nxt_stripped = nxt.strip()
            if (
                not nxt_stripped
                or nxt.startswith("#")
                or nxt.startswith("```")
                or nxt_stripped.startswith("|")
                or nxt_stripped == "---"
                or re.match(r"^\s*[-*]\s+", nxt)
                or re.match(r"^\s*\d+\.\s+", nxt)
            ):
                break
            paragraph.append(nxt_stripped)
            i += 1
        story.append(Paragraph(inline(" ".join(paragraph)), styles["Bodyx"]))

    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def main():
    if len(sys.argv) != 3:
        raise SystemExit("uso: markdown_to_pdf.py entrada.md saida.pdf")
    build(Path(sys.argv[1]), Path(sys.argv[2]))


if __name__ == "__main__":
    main()
