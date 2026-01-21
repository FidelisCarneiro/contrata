// Sistema de Admissão • Fidel
// legibility.js (global) - avalia legibilidade de imagem e PDF

(function(){
  async function scoreImage(file){
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();

      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      // Heurística simples: resolução + contraste aproximado
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const maxDim = 1200;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      canvas.width = Math.max(1, Math.floor(w * scale));
      canvas.height = Math.max(1, Math.floor(h * scale));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const data = ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let sum = 0;
      let sum2 = 0;
      const n = data.length / 4;
      for (let i=0; i<data.length; i+=4){
        // luminância aproximada
        const y = 0.2126*data[i] + 0.7152*data[i+1] + 0.0722*data[i+2];
        sum += y;
        sum2 += y*y;
      }
      const mean = sum / n;
      const varr = Math.max(0, (sum2 / n) - mean*mean);
      const std = Math.sqrt(varr);

      const resScore = Math.min(1, (w*h) / (1600*1200));
      const contrastScore = Math.min(1, std / 55);

      const score = Math.round((0.65*resScore + 0.35*contrastScore) * 100);
      return { score, details: { w, h, std: Math.round(std) } };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function scorePdf(file){
    if (!window.pdfjsLib){
      // Sem pdfjs: não bloqueia, apenas não avalia
      return { score: 100, details: { note: 'pdfjsLib não disponível' } };
    }

    // Worker (CDN) - evita erro ao abrir localmente
    try {
      if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/legacy/build/pdf.worker.min.js';
      }
    } catch(_){/*noop*/}

    const buf = await file.arrayBuffer();
    const task = window.pdfjsLib.getDocument({ data: buf });
    const pdf = await task.promise;

    // pega 1ª página e renderiza miniatura
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1, 1200 / Math.max(viewport.width, viewport.height));
    const vp = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);

    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    // trata como imagem
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const tmpFile = new File([blob], 'thumb.png', { type: 'image/png' });
    const imgScore = await scoreImage(tmpFile);

    // bônus por página grande (nítida)
    const area = viewport.width * viewport.height;
    const sizeBonus = Math.min(15, Math.round(area / (1400*1000) * 15));
    return { score: Math.min(100, imgScore.score + sizeBonus), details: { ...imgScore.details, sizeBonus } };
  }

  async function scoreFileLegibility(file){
    const type = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();

    if (type.includes('pdf') || name.endsWith('.pdf')) return scorePdf(file);
    if (type.startsWith('image/')) return scoreImage(file);

    // DOC/DOCX: não conseguimos avaliar bem no navegador sem libs - assume ok, mas não bloqueia
    if (name.endsWith('.doc') || name.endsWith('.docx')) {
      return { score: 100, details: { note: 'DOC/DOCX sem avaliação automática' } };
    }

    return { score: 100, details: { note: 'Tipo não avaliado' } };
  }

  window.FIDEL_LEGIBILITY = { scoreFileLegibility };
})();
