from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "docs" / "RELATORIO_TECNICO_FINAL_DOCX_SOURCE.html"
target = ROOT / "docs" / "RELATORIO_TECNICO_FINAL_WORD_SOURCE.html"

html = source.read_text(encoding="utf-8")
body_start = html.find("<body>")
body_end = html.rfind("</body>")
body = html[body_start + len("<body>"):body_end]

css = """<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title></title>
  <style>
    @page { size: A4; margin: 20mm 18mm 18mm 18mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #172033; font-size: 11pt; line-height: 1.45; margin: 0; }
    .cover { text-align: center; min-height: 900px; padding-top: 40px; page-break-after: always; }
    .institution { font-weight: bold; text-transform: uppercase; letter-spacing: .02em; }
    .course { font-weight: bold; margin-top: 8px; }
    .title { font-size: 20pt; line-height: 1.15; font-weight: bold; text-transform: uppercase; color: #102039; margin-top: 160px; margin-bottom: 34px; }
    .subtitle { font-size: 14pt; color: #31445f; margin-bottom: 60px; }
    .team { width: 430px; margin-left: auto; margin-right: auto; text-align: left; line-height: 1.6; }
    .place { margin-top: 90px; }
    h2 { font-size: 15pt; color: #102039; border-bottom: 1px solid #d7dfeb; padding-bottom: 6px; margin-top: 24px; margin-bottom: 12px; }
    h3 { font-size: 12.5pt; color: #102039; margin-top: 18px; margin-bottom: 8px; }
    p { text-align: justify; margin: 0 0 10px; }
    .abstract { border-left: 4px solid #1f6feb; background: #f1f6ff; padding: 18px; margin-bottom: 14px; }
    .keywords { font-weight: bold; margin-top: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 9.5pt; }
    th, td { border: 1px solid #d7dfeb; padding: 7px; vertical-align: top; }
    th { background: #eaf1fb; font-weight: bold; }
    .toc td { border: 0; border-bottom: 1px dotted #9aa8bb; padding: 6px 0; }
    .toc td:last-child { text-align: right; width: 50px; }
    .figure { margin: 16px 0; page-break-inside: avoid; }
    .figure img { width: 100%; border: 1px solid #d7dfeb; }
    .caption { text-align: center; color: #51627a; font-size: 9.5pt; margin-top: 6px; }
    pre { background: #0b1220; color: #eaf2ff; padding: 12px; font-family: Consolas, monospace; font-size: 8.5pt; white-space: pre-wrap; }
    .toc-heading, #referencias { page-break-before: always; }
  </style>
</head>
<body>
"""

target.write_text(css + body + "\n</body>\n</html>\n", encoding="utf-8")
print(target)
