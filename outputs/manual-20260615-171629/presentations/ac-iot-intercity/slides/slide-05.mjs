import { C, slideBase, metric, card } from './theme.mjs';

export async function slide05(presentation, ctx) {
  const slide = slideBase(presentation, ctx, '04 | Painel operacional', 'Cockpit para operar salas, blocos e comandos em massa', 'web em tempo real');
  metric(ctx, slide, 62, 122, 150, 100, '1.000', 'salas online', C.blue);
  metric(ctx, slide, 230, 122, 150, 100, '40', 'blocos', C.teal);
  metric(ctx, slide, 398, 122, 150, 100, '25', 'salas/bloco', C.purple);
  metric(ctx, slide, 566, 122, 150, 100, '3-5%', 'temp critica alvo', C.red);
  ctx.addShape(slide, { x: 62, y: 270, w: 644, h: 290, fill: C.paper, line: ctx.line(C.line, 1) });
  ctx.addText(slide, { x: 86, y: 292, w: 280, h: 28, text: 'Blocos Operacionais', fontSize: 20, bold: true, color: C.ink, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  const colors = [C.blue, C.blue, C.red, C.blue, C.blue, C.blue, C.blue, C.red, C.blue, C.blue, C.blue, C.blue];
  colors.forEach((color, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 86 + col * 146;
    const y = 340 + row * 62;
    ctx.addShape(slide, { x, y, w: 126, h: 44, fill: color === C.red ? C.red2 : C.blue2, line: ctx.line(color, 1.5) });
    ctx.addText(slide, { x: x + 10, y: y + 8, w: 106, h: 18, text: `B${String(i + 1).padStart(2, '0')}`, fontSize: 13, bold: true, color, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
    ctx.addText(slide, { x: x + 10, y: y + 26, w: 106, h: 12, text: color === C.red ? '1 crit' : '0 crit', fontSize: 9, color: C.muted, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  });
  card(ctx, slide, 760, 126, 390, 120, 'Telemetria ao vivo', 'Busca por sala/bloco, filtros por estado, heartbeat, presenca, AC, luz e temperatura critica.', C.blue);
  card(ctx, slide, 760, 278, 390, 120, 'Comando em massa', 'Escopos: todas as salas, bloco selecionado, filtro atual, temperatura critica ou sala selecionada.', C.purple);
  card(ctx, slide, 760, 430, 390, 120, 'Sala selecionada', 'Detalhe operacional e consulta da ultima leitura no InterSCity sem confundir com o status global.', C.teal);
  return slide;
}
