import { C, slideBase, card, bulletList } from './theme.mjs';

export async function slide02(presentation, ctx) {
  const slide = slideBase(presentation, ctx, '01 | Objetivo', 'O sistema transforma telemetria de salas em operacao acionavel', 'visao executiva');
  card(ctx, slide, 62, 122, 342, 190, 'Problema operacional', 'Ar-condicionado e iluminacao precisam responder a presenca, conforto termico e setpoints sem depender de acao manual sala a sala.', C.red);
  card(ctx, slide, 468, 122, 342, 190, 'Resposta do AC-IoT', 'Um cockpit monitora 1.000 salas, agrupa blocos, mostra alertas e envia comandos por MQTT para salas, blocos ou filtros.', C.blue);
  card(ctx, slide, 874, 122, 342, 190, 'Valor da integracao IC', 'A bridge publica dados no InterSCity para interoperabilidade urbana e consulta externa do historico de telemetria.', C.purple);
  ctx.addText(slide, { x: 70, y: 382, w: 380, h: 30, text: 'Principios do desenho', fontSize: 22, bold: true, color: C.ink, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  bulletList(ctx, slide, [
    'Tempo real local via MQTT e WebSocket.',
    'Automacao por presenca, temperatura, setpoint e sala vazia.',
    'Comandos em massa com escopo controlado.',
    'Transparencia do estado InterSCity: OK, instavel ou sem resposta.'
  ], 78, 430, 560, 48, C.blue);
  ctx.addShape(slide, { x: 735, y: 388, w: 430, h: 190, fill: C.paper, line: ctx.line(C.line, 1) });
  ctx.addText(slide, { x: 766, y: 420, w: 370, h: 40, text: 'Tese do sistema', fontSize: 18, bold: true, color: C.ink, align: 'center', insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  ctx.addText(slide, { x: 778, y: 470, w: 346, h: 70, text: 'O AC-IoT UFMA ja opera como plataforma distribuida local; a integracao externa depende da disponibilidade atual do InterSCity.', fontSize: 19, bold: true, color: C.blue, align: 'center', insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  return slide;
}
