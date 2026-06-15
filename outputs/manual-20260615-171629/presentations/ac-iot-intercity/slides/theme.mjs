export const C = {
  bg: '#F7FAFC',
  paper: '#FFFFFF',
  ink: '#132033',
  muted: '#5F7087',
  line: '#D6DEE8',
  blue: '#2563EB',
  blue2: '#DBEAFE',
  teal: '#0F766E',
  teal2: '#CCFBF1',
  green: '#15803D',
  green2: '#DCFCE7',
  red: '#DC2626',
  red2: '#FEE2E2',
  amber: '#D97706',
  amber2: '#FEF3C7',
  purple: '#7C3AED',
  purple2: '#EDE9FE',
  slate: '#334155',
};

export function slideBase(presentation, ctx, kicker, title, subtitle = '') {
  const slide = presentation.slides.add();
  ctx.addShape(slide, { x: 0, y: 0, w: ctx.W, h: ctx.H, fill: C.bg });
  ctx.addShape(slide, { x: 0, y: 0, w: ctx.W, h: 74, fill: C.paper, line: ctx.line(C.line, 1) });
  ctx.addText(slide, { x: 54, y: 20, w: 270, h: 22, text: kicker, fontSize: 13, bold: true, color: C.blue, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  ctx.addText(slide, { x: 54, y: 42, w: 760, h: 26, text: title, fontSize: 23, bold: true, color: C.ink, typeface: ctx.fonts.title, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  if (subtitle) {
    ctx.addText(slide, { x: 820, y: 30, w: 400, h: 24, text: subtitle, fontSize: 12, color: C.muted, align: 'right', insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  }
  ctx.addText(slide, { x: 54, y: 682, w: 360, h: 18, text: 'AC-IoT UFMA | Sistema distribuido IoT + InterSCity', fontSize: 9, color: C.muted, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  return slide;
}

export function titleBlock(ctx, slide, text, x, y, w, h, size = 42) {
  return ctx.addText(slide, { x, y, w, h, text, fontSize: size, bold: true, color: C.ink, typeface: ctx.fonts.title, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
}

export function bodyText(ctx, slide, text, x, y, w, h, size = 18, color = C.slate) {
  return ctx.addText(slide, { x, y, w, h, text, fontSize: size, color, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
}

export function card(ctx, slide, x, y, w, h, title, text, accent = C.blue) {
  ctx.addShape(slide, { x, y, w, h, fill: C.paper, line: ctx.line(C.line, 1) });
  ctx.addShape(slide, { x, y, w: 7, h, fill: accent });
  ctx.addText(slide, { x: x + 20, y: y + 18, w: w - 36, h: 28, text: title, fontSize: 17, bold: true, color: C.ink, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  ctx.addText(slide, { x: x + 20, y: y + 52, w: w - 36, h: h - 62, text, fontSize: 13.5, color: C.muted, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
}

export function metric(ctx, slide, x, y, w, h, value, label, color = C.blue, note = '') {
  ctx.addShape(slide, { x, y, w, h, fill: C.paper, line: ctx.line(C.line, 1) });
  ctx.addText(slide, { x: x + 16, y: y + 15, w: w - 32, h: 34, text: value, fontSize: 28, bold: true, color, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  ctx.addText(slide, { x: x + 16, y: y + 51, w: w - 32, h: 20, text: label, fontSize: 10.5, bold: true, color: C.muted, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  if (note) ctx.addText(slide, { x: x + 16, y: y + 76, w: w - 32, h: 30, text: note, fontSize: 10, color: C.muted, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
}

export function node(ctx, slide, x, y, w, h, title, detail, fill = C.blue2, stroke = C.blue) {
  ctx.addShape(slide, { x, y, w, h, fill, line: ctx.line(stroke, 1.6) });
  ctx.addText(slide, { x: x + 14, y: y + 14, w: w - 28, h: 24, text: title, fontSize: 15, bold: true, color: C.ink, align: 'center', insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  ctx.addText(slide, { x: x + 14, y: y + 43, w: w - 28, h: h - 48, text: detail, fontSize: 10.5, color: C.muted, align: 'center', insets: { left: 0, right: 0, top: 0, bottom: 0 } });
}

export function connector(ctx, slide, x1, y1, x2, y2, color = C.blue) {
  const horizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
  if (horizontal) {
    const x = Math.min(x1, x2);
    const y = y1 - 2;
    ctx.addShape(slide, { x, y, w: Math.abs(x2 - x1), h: 4, fill: color });
    ctx.addText(slide, { x: x2 - 14, y: y1 - 13, w: 24, h: 24, text: x2 >= x1 ? '>' : '<', fontSize: 18, bold: true, color, align: 'center', insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  } else {
    const x = x1 - 2;
    const y = Math.min(y1, y2);
    ctx.addShape(slide, { x, y, w: 4, h: Math.abs(y2 - y1), fill: color });
    ctx.addText(slide, { x: x1 - 11, y: y2 - 14, w: 22, h: 22, text: 'v', fontSize: 16, bold: true, color, align: 'center', insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  }
}

export function bulletList(ctx, slide, items, x, y, w, gap = 42, color = C.blue) {
  items.forEach((item, i) => {
    const yy = y + i * gap;
    ctx.addShape(slide, { geometry: 'ellipse', x, y: yy + 4, w: 13, h: 13, fill: color });
    ctx.addText(slide, { x: x + 24, y: yy, w: w - 24, h: 36, text: item, fontSize: 15, color: C.slate, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  });
}

export function statusPill(ctx, slide, x, y, text, fill, color) {
  ctx.addShape(slide, { x, y, w: 150, h: 30, fill, line: ctx.line(color, 1) });
  ctx.addText(slide, { x: x + 10, y: y + 7, w: 130, h: 16, text, fontSize: 10.5, bold: true, color, align: 'center', insets: { left: 0, right: 0, top: 0, bottom: 0 } });
}
