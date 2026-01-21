// Sistema de Admissão • Fidel
// pdf.js (global) - gera PDFs (Ficha Cadastral e Plano de Saúde)

(function(){
  function ddmmyyyy(dateStr){
    if (!dateStr) return "";
    // aceita "YYYY-MM-DD" ou já no formato dd/mm/aaaa
    if (dateStr.includes("/")) return dateStr;
    const [y,m,d] = dateStr.split("-");
    if (!y || !m || !d) return dateStr;
    return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
  }

  async function loadImageAsDataUrl(fileOrBlob){
    if (!fileOrBlob) return null;
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(fileOrBlob);
    });
  }

  function addFooter(doc, footerText){
    const pageCount = doc.getNumberOfPages();
    for (let i=1; i<=pageCount; i++){
      doc.setPage(i);
      doc.setFontSize(9);
      doc.text(footerText || "", 12, 290);
    }
  }

  async function makeCadastroPDF(formData, fotoFileOrBlob, assinaturaDataUrl, footerUser){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    doc.setFontSize(16);
    doc.text("Ficha de Cadastro - Sistema de Admissão Fidel", 12, 14);

    // Foto (quadrado)
    const foto = await loadImageAsDataUrl(fotoFileOrBlob);
    if (foto){
      try {
        doc.rect(170, 18, 28, 28);
        doc.addImage(foto, "JPEG", 170, 18, 28, 28);
      } catch(e){
        // tenta PNG
        try { doc.addImage(foto, "PNG", 170, 18, 28, 28); } catch(_){/*ignore*/}
      }
    }

    let y = 26;
    doc.setFontSize(11);

    function line(label, value){
      if (value === undefined || value === null || value === "") return;
      doc.text(`${label}: ${String(value)}`, 12, y);
      y += 6;
      if (y > 270){ doc.addPage(); y = 18; }
    }

    line("Nome", formData.nome);
    line("CPF", formData.cpf);
    line("Data de nascimento", ddmmyyyy(formData.data_nasc));
    line("Estado civil", formData.estado_civil);
    if ((formData.estado_civil || "").toLowerCase().includes("cas")){
      line("Data de casamento", ddmmyyyy(formData.data_casamento));
    }
    line("E-mail", formData.email);
    line("Telefone", formData.telefone);
    line("Nome da mãe", formData.nome_mae);
    line("Nome do pai", formData.nome_pai);
    line("Naturalidade", `${formData.naturalidade_cidade || ""}${formData.naturalidade_uf ? " - " + formData.naturalidade_uf : ""}`);
    line("RG", `${formData.rg_numero || ""} ${formData.rg_orgao ? "- " + formData.rg_orgao : ""}${formData.rg_uf ? " / " + formData.rg_uf : ""}`);
    line("RG (emissão)", ddmmyyyy(formData.rg_emissao));
    line("CNH", `${formData.cnh_numero || ""}${formData.cnh_categoria ? " / " + formData.cnh_categoria : ""}`);
    line("CNH (vencimento)", ddmmyyyy(formData.cnh_vencimento));

    // Endereço
    line("Endereço", `${formData.logradouro || ""}, ${formData.numero || ""}${formData.complemento ? " - " + formData.complemento : ""}`);
    line("Bairro", formData.bairro);
    line("Cidade/UF", `${formData.cidade || ""}${formData.end_uf ? " - " + formData.end_uf : ""}`);
    line("CEP", formData.cep);
    line("Referência", formData.referencia);

    // Banco
    line("Banco", "Itaú");
    line("Agência", formData.banco_ag);
    line("Conta", formData.banco_cc);

    // Indicação / Emergência
    if (formData.indicacao_nome || formData.indicacao_tel){
      line("Indicação", `${formData.indicacao_nome || ""}${formData.indicacao_tel ? " - " + formData.indicacao_tel : ""}`);
    }
    line("Contato emergência", `${formData.emerg_nome || ""}${formData.emerg_tel ? " - " + formData.emerg_tel : ""}`);

    // Dependentes (resumo)
    if (Array.isArray(formData.dependentes_irpf) && formData.dependentes_irpf.length){
      doc.text("Dependentes (IRPF):", 12, y); y += 6;
      formData.dependentes_irpf.forEach((d, idx)=>{
        doc.text(`${idx+1}. ${d.nome || ""} | CPF: ${d.cpf || ""} | Nasc.: ${ddmmyyyy(d.nasc)}`, 14, y);
        y += 6;
        if (y > 270){ doc.addPage(); y = 18; }
      });
    }
    if (Array.isArray(formData.dependentes_plano) && formData.dependentes_plano.length){
      doc.text("Dependentes (Plano de Saúde):", 12, y); y += 6;
      formData.dependentes_plano.forEach((d, idx)=>{
        doc.text(`${idx+1}. ${d.nome || ""} | Grau: ${d.grau || ""} | CPF: ${d.cpf || ""}`, 14, y);
        y += 6;
        if (y > 270){ doc.addPage(); y = 18; }
      });
    }

    // Assinatura
    if (assinaturaDataUrl){
      doc.addPage();
      doc.setFontSize(12);
      doc.text("Assinatura", 12, 30);
      try {
        doc.rect(12, 34, 100, 30);
        doc.addImage(assinaturaDataUrl, "PNG", 12, 34, 100, 30);
      } catch(e){/*ignore*/}
    }

    addFooter(doc, footerUser || "");
    return doc.output("blob");
  }

  async function makePlanoPDF(formData, fotoFileOrBlob, assinaturaDataUrl, footerUser){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    doc.setFontSize(16);
    doc.text("Plano de Saúde - Sistema de Admissão Fidel", 12, 14);

    // Foto
    const foto = await loadImageAsDataUrl(fotoFileOrBlob);
    if (foto){
      try {
        doc.rect(170, 18, 28, 28);
        doc.addImage(foto, "JPEG", 170, 18, 28, 28);
      } catch(e){
        try { doc.addImage(foto, "PNG", 170, 18, 28, 28); } catch(_){/*ignore*/}
      }
    }

    doc.setFontSize(11);
    let y = 28;

    function line(label, value){
      if (value === undefined || value === null || value === "") return;
      doc.text(`${label}: ${String(value)}`, 12, y);
      y += 6;
      if (y > 270){ doc.addPage(); y = 18; }
    }

    // Dados do titular
    line("Titular (Nome)", formData.nome);
    line("CPF", formData.cpf);
    line("Data de nascimento", ddmmyyyy(formData.data_nasc));
    line("Telefone", formData.telefone);
    line("E-mail", formData.email);
    line("Endereço", `${formData.logradouro || ""}, ${formData.numero || ""}${formData.complemento ? " - " + formData.complemento : ""}`);
    line("Cidade/UF", `${formData.cidade || ""}${formData.end_uf ? " - " + formData.end_uf : ""}`);

    // Dependentes plano (detalhado)
    doc.text("Dependentes do Plano:", 12, y); y += 6;
    const deps = Array.isArray(formData.dependentes_plano) ? formData.dependentes_plano : [];
    if (!deps.length){
      doc.text("(Sem dependentes)", 14, y); y += 6;
    } else {
      deps.forEach((d, idx)=>{
        doc.text(`${idx+1}. ${d.nome || ""} | Grau: ${d.grau || ""} | CPF: ${d.cpf || ""} | Nasc.: ${ddmmyyyy(d.nasc)}`, 14, y);
        y += 6;
        if (y > 270){ doc.addPage(); y = 18; }
      });
    }

    // Declaração final
    doc.addPage();
    doc.setFontSize(12);
    doc.text("DECLARAÇÃO", 12, 24);
    doc.setFontSize(11);
    const decl = "Declaro que as informações acima são verdadeiras e autorizo a utilização dos dados para fins de adesão/gestão do plano de saúde.";
    const lines = doc.splitTextToSize(decl, 180);
    doc.text(lines, 12, 34);
    doc.text(`Data: ${ddmmyyyy(new Date().toISOString().slice(0,10))}`, 12, 60);
    doc.text("Assinatura:", 12, 74);
    doc.line(12, 80, 120, 80);

    if (assinaturaDataUrl){
      try {
        doc.addImage(assinaturaDataUrl, "PNG", 12, 82, 100, 30);
      } catch(e){/*ignore*/}
    }

    addFooter(doc, footerUser || "");
    return doc.output("blob");
  }

  window.FIDEL_PDF = { ddmmyyyy, makeCadastroPDF, makePlanoPDF };
})();
