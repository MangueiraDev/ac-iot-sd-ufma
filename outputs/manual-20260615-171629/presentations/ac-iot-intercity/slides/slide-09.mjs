import { C, slideBase, card, bulletList, statusPill } from './theme.mjs';

export async function slide09(presentation, ctx) {
  const slide = slideBase(presentation, ctx, '08 | Status e proximos passos', 'O sistema local esta operacional; a disponibilidade remota do InterSCity deve ser monitorada', 'fechamento');
  statusPill(ctx, slide, 72, 130, 'LOCAL OK', C.green2, C.green);
  statusPill(ctx, slide, 246, 130, 'MQTT AO VIVO', C.green2, C.green);
  statusPill(ctx, slide, 420, 130, 'IC INSTAVEL', C.amber2, C.amber);
  card(ctx, slide, 72, 192, 330, 140, 'Concluido', 'Painel para 1.000 salas, filtros, blocos, temperatura critica, dashboard de metricas e link externo para o InterSCity.', C.green);
  card(ctx, slide, 474, 192, 330, 140, 'Evidencia atual', 'Containers ativos, sensores MQTT chegando, bridge publicando metricas e historico de 61.330 envios ao InterSCity.', C.blue);
  card(ctx, slide, 876, 192, 330, 140, 'Risco operacional', 'No momento da verificacao, a API remota InterSCity retornou timeout/last_ok=false. O sistema local segue operando.', C.amber);
  ctx.addText(slide, { x: 86, y: 404, w: 420, h: 30, text: 'Proximos passos sugeridos', fontSize: 22, bold: true, color: C.ink, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  bulletList(ctx, slide, [
    'Registrar janela de evidencias quando o InterSCity remoto voltar a responder.',
    'Adicionar alarme visual para fila alta ou sent_per_sec zerado por periodo prolongado.',
    'Executar teste de carga com multiplas replicas do simulador e bridge.',
    'Anexar prints do dashboard e logs ao relatorio final.'
  ], 92, 456, 760, 42, C.blue);
  ctx.addShape(slide, { x: 896, y: 420, w: 260, h: 116, fill: C.paper, line: ctx.line(C.line, 1) });
  ctx.addText(slide, { x: 922, y: 446, w: 210, h: 30, text: 'Mensagem-chave', fontSize: 18, bold: true, color: C.ink, align: 'center', insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  ctx.addText(slide, { x: 922, y: 488, w: 210, h: 34, text: 'Sistema distribuido local pronto; integracao externa observavel e resiliente.', fontSize: 15, bold: true, color: C.blue, align: 'center', insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  return slide;
}
