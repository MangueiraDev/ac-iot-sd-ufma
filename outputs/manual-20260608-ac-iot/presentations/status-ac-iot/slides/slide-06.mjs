import { C, bg, footer, kicker, title } from "./common.mjs";

export async function slide06(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "EVIDÊNCIA 2");
  title(slide, ctx, "Node-RED executa a automação a partir dos sensores MQTT.");

  await ctx.addImage(slide, {
    path: `${ctx.workspaceDir}/assets/nodered.png`,
    x: 70, y: 238, w: 410, h: 270, fit: "cover",
    alt: "Captura da aba Automação AC no Node-RED",
  });
  ctx.addShape(slide, { x: 70, y: 526, w: 410, h: 74, fill: C.white, line: ctx.line(C.rule, 1) });
  ctx.addText(slide, { text: "Fluxo configurado", x: 94, y: 542, w: 340, h: 22, fontSize: 17, color: C.ink, bold: true });
  ctx.addText(slide, {
    text: "A tela mostra Sensores -> Automação AC/Luz -> Enviar Comando, com debug ativo.",
    x: 94, y: 568, w: 338, h: 24, fontSize: 12.5, color: C.muted,
  });

  ctx.addShape(slide, { x: 520, y: 226, w: 670, h: 390, fill: "#101828", line: ctx.line("#101828", 0) });
  ctx.addText(slide, { text: "Trechos essenciais do fluxo Node-RED", x: 546, y: 248, w: 560, h: 24, fontSize: 15, color: "#D1E9FF", bold: true });
  ctx.addText(slide, {
    text:
`// node-red/flows.json
{
  "type": "mqtt in",
  "name": "Sensores ac-iot/+/sensores",
  "topic": "ac-iot/+/sensores",
  "datatype": "json"
}

// função Automação AC/Luz
if (payload.modo_ac === 'desativado') return null;
var pres = payload.presenca === true;
var setTemp = Number(payload.setpoint_ac) || 22;

if (pres && temp > (setTemp + 1)) {
  setAc('ligar', 'condicao_acima_setpoint_liga_ac');
}
return { topic: 'ac-iot/' + id_sala + '/comando',
         payload: cmd };`,
    x: 546, y: 286, w: 610, h: 302, fontSize: 13, color: "#F9FAFB", typeface: ctx.fonts.mono,
  });
  footer(slide, ctx, 6);
  return slide;
}
