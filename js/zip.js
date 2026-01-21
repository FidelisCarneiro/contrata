// Sistema de Admissão • Fidel
// zip.js (global) - monta ZIP com anexos e PDFs

(function(){
  function extFromFile(file){
    const name = (file?.name || "").toLowerCase();
    const idx = name.lastIndexOf(".");
    if (idx > -1) return name.slice(idx+1);
    return "bin";
  }

  async function buildZipFromUploads(baseName, uploads, docsOrder, pdfCadastroBlob, pdfPlanoBlob){
    if (!window.JSZip) throw new Error("JSZip não carregado.");
    const zip = new JSZip();

    // PDFs gerados
    if (pdfCadastroBlob) zip.file(`90 - ${baseName} - ficha cadastral.pdf`, pdfCadastroBlob);
    if (pdfPlanoBlob) zip.file(`91 - ${baseName} - plano de saude.pdf`, pdfPlanoBlob);

    // Anexos na ordem obrigatória
    for (const d of docsOrder){
      const file = uploads[d.key];
      if (!file) continue;
      const num = String(d.num).padStart(2, '0');
      const ext = extFromFile(file);
      const filename = `${num} - ${baseName} - ${d.label}.${ext}`;
      zip.file(filename, file);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    return blob;
  }

  window.FIDEL_ZIP = { buildZipFromUploads };
})();
