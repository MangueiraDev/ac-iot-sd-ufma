export const C = {
  paper: "#F7F4ED",
  ink: "#17202A",
  muted: "#667085",
  rule: "#D7D2C8",
  blue: "#2563EB",
  green: "#16A34A",
  amber: "#D97706",
  red: "#DC2626",
  slate: "#334155",
  white: "#FFFFFF",
  paleBlue: "#E8F0FE",
  paleGreen: "#EAF7EF",
  paleAmber: "#FFF3DA",
  paleRed: "#FDECEC",
};

export function bg(slide, ctx) {
  ctx.addShape(slide, { x: 0, y: 0, w: 1280, h: 720, fill: C.paper });
}

export function footer(slide, ctx, n) {
  ctx.addText(slide, {
    text: "AC-IoT UFMA | Status do prototipo",
    x: 64, y: 680, w: 420, h: 18, fontSize: 11, color: C.muted,
  });
  ctx.addText(slide, {
    text: String(n).padStart(2, "0"),
    x: 1168, y: 676, w: 48, h: 22, fontSize: 12, color: C.muted, align: "right",
  });
}

export function kicker(slide, ctx, text, x = 64, y = 46) {
  ctx.addShape(slide, { x, y: y + 10, w: 34, h: 3, fill: C.blue });
  ctx.addText(slide, {
    text,
    x: x + 48, y, w: 420, h: 28, fontSize: 13, color: C.blue, bold: true,
    valign: "middle",
  });
}

export function title(slide, ctx, text, sub) {
  ctx.addText(slide, {
    text,
    x: 64, y: 82, w: 980, h: 88, fontSize: 40, color: C.ink, bold: true,
    typeface: ctx.fonts.title,
  });
  if (sub) {
    ctx.addText(slide, {
      text: sub,
      x: 66, y: 165, w: 900, h: 50, fontSize: 18, color: C.muted,
    });
  }
}

export function pill(slide, ctx, text, x, y, w, fill, color = C.ink) {
  ctx.addShape(slide, { x, y, w, h: 34, fill, line: ctx.line(fill, 0) });
  ctx.addText(slide, {
    text,
    x: x + 12, y: y + 5, w: w - 24, h: 24, fontSize: 13, color, bold: true,
    align: "center", valign: "middle",
  });
}

export function metric(slide, ctx, value, label, x, y, w, accent) {
  ctx.addShape(slide, { x, y, w, h: 116, fill: C.white, line: ctx.line(C.rule, 1) });
  ctx.addShape(slide, { x, y, w: 5, h: 116, fill: accent });
  ctx.addText(slide, { text: value, x: x + 22, y: y + 20, w: w - 36, h: 42, fontSize: 34, color: C.ink, bold: true });
  ctx.addText(slide, { text: label, x: x + 22, y: y + 66, w: w - 36, h: 34, fontSize: 14, color: C.muted });
}

export function node(slide, ctx, label, detail, x, y, w, h, fill = C.white, accent = C.blue) {
  ctx.addShape(slide, { x, y, w, h, fill, line: ctx.line(C.rule, 1) });
  ctx.addShape(slide, { x, y, w, h: 5, fill: accent });
  ctx.addText(slide, { text: label, x: x + 16, y: y + 18, w: w - 32, h: 26, fontSize: 18, color: C.ink, bold: true });
  ctx.addText(slide, { text: detail, x: x + 16, y: y + 50, w: w - 32, h: h - 62, fontSize: 13, color: C.muted });
}

export function line(slide, ctx, x1, y1, x2, y2, color = C.slate, width = 2) {
  const w = Math.max(1, Math.abs(x2 - x1));
  const h = Math.max(1, Math.abs(y2 - y1));
  if (Math.abs(y2 - y1) <= 1) ctx.addShape(slide, { x: Math.min(x1, x2), y: y1, w, h: width, fill: color });
  else if (Math.abs(x2 - x1) <= 1) ctx.addShape(slide, { x: x1, y: Math.min(y1, y2), w: width, h, fill: color });
}

export function bullet(slide, ctx, text, x, y, w, color = C.ink) {
  ctx.addShape(slide, { x, y: y + 8, w: 7, h: 7, fill: C.blue });
  ctx.addText(slide, { text, x: x + 18, y, w, h: 42, fontSize: 17, color });
}
