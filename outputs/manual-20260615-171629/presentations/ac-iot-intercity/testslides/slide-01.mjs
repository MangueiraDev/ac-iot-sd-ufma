export async function slide01(presentation, ctx) { const slide = presentation.slides.add(); ctx.addText(slide,{x:100,y:100,w:400,h:80,text:'Teste',fontSize:32}); return slide; }
