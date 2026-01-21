// Sistema de Admissão • Fidel
// form.js (global) - Ficha de Admissão (rascunho, anexos, assinatura, PDFs, ZIP e envio)

(function(){
  const supabase = window.FIDEL_SUPABASE;
  const cfg = window.FIDEL_CONFIG;
  const { makeCadastroPDF, makePlanoPDF, ddmmyyyy } = window.FIDEL_PDF || {};
  const { buildZipFromUploads } = window.FIDEL_ZIP || {};
  const { scoreFileLegibility } = window.FIDEL_LEGIBILITY || {};

  if (!supabase || !cfg) {
    console.error('Supabase/config não carregados.');
    return;
  }

  const SUPERADMIN_CPF = "05717864647";

  // Ordem obrigatória dos anexos (1..25)
  const DOCS_ORDER = [
    { num: 1, key: "foto", label: "Foto 3x4" },
    { num: 2, key: "rg", label: "RG" },
    { num: 3, key: "cpf", label: "CPF" },
    { num: 4, key: "titulo", label: "Título de Eleitor" },
    { num: 5, key: "pis", label: "PIS/PASEP" },
    { num: 6, key: "reservista", label: "Reservista" },
    { num: 7, key: "nascimento", label: "Certidão de Nascimento" },
    { num: 8, key: "casamento", label: "Certidão de Casamento" },
    { num: 9, key: "residencia", label: "Comprovante de Residência" },
    { num: 10, key: "escolaridade", label: "Escolaridade" },
    { num: 11, key: "ctps", label: "CTPS" },
    { num: 12, key: "vacinacao", label: "Cartão de Vacinação" },
    { num: 13, key: "sus", label: "Cartão do SUS" },
    { num: 14, key: "curriculo", label: "Currículo" },
    { num: 15, key: "certificado", label: "Certificado" },
    { num: 16, key: "cursos", label: "Cursos" },
    { num: 17, key: "dados_bancarios", label: "Dados Bancários" },
    { num: 18, key: "cartao_transporte", label: "Cópia do Cartão de Transporte" },
    { num: 19, key: "cnh", label: "CNH" },
    { num: 20, key: "cert_nascimento_filhos", label: "Certidão de Nascimento dos Filhos" },
    { num: 21, key: "sus_dependentes", label: "Cartão do SUS dos Dependentes" },
    { num: 22, key: "rg_cpf_conjuge_filhos", label: "RG e CPF (cônjuge + filhos)" },
    { num: 23, key: "caderneta_vac_filhos_menor7", label: "Caderneta de Vacinação (filhos < 7)" },
    { num: 24, key: "comprovante_escolar_7a14", label: "Comprovante Escolar (7 a 14)" },
    { num: 25, key: "conselho_profissional", label: "Registro em Conselho Profissional" },
  ];

  const UF_LIST = [
    { uf: 'AC', nome: 'Acre' },
    { uf: 'AL', nome: 'Alagoas' },
    { uf: 'AP', nome: 'Amapá' },
    { uf: 'AM', nome: 'Amazonas' },
    { uf: 'BA', nome: 'Bahia' },
    { uf: 'CE', nome: 'Ceará' },
    { uf: 'DF', nome: 'Distrito Federal' },
    { uf: 'ES', nome: 'Espírito Santo' },
    { uf: 'GO', nome: 'Goiás' },
    { uf: 'MA', nome: 'Maranhão' },
    { uf: 'MT', nome: 'Mato Grosso' },
    { uf: 'MS', nome: 'Mato Grosso do Sul' },
    { uf: 'MG', nome: 'Minas Gerais' },
    { uf: 'PA', nome: 'Pará' },
    { uf: 'PB', nome: 'Paraíba' },
    { uf: 'PR', nome: 'Paraná' },
    { uf: 'PE', nome: 'Pernambuco' },
    { uf: 'PI', nome: 'Piauí' },
    { uf: 'RJ', nome: 'Rio de Janeiro' },
    { uf: 'RN', nome: 'Rio Grande do Norte' },
    { uf: 'RS', nome: 'Rio Grande do Sul' },
    { uf: 'RO', nome: 'Rondônia' },
    { uf: 'RR', nome: 'Roraima' },
    { uf: 'SC', nome: 'Santa Catarina' },
    { uf: 'SP', nome: 'São Paulo' },
    { uf: 'SE', nome: 'Sergipe' },
    { uf: 'TO', nome: 'Tocantins' },
  ];

  const ACCEPT_DOCS = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx";

  // Estado do formulário
  let currentUser = null;
  let currentProject = null;
  let currentSubmissionId = null; // para atualizar rascunho

  // anexos e scores
  const uploads = {}; // key -> File
  const legibilityScores = {}; // key -> score

  // dependentes
  let depIRPF = [];
  let depPlano = [];

  function $(sel){ return document.querySelector(sel); }
  function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

  function setMsg(text, type=""){
    const el = $("#formMsg");
    if (!el) return;
    el.textContent = text || "";
    el.className = `msg ${type}`.trim();
  }

  // CPF (somente números + validação)
  function normalizeCPF(v){ return (v||"").replace(/\D/g, "").slice(0,11); }
  function isValidCPF(cpf){
    cpf = normalizeCPF(cpf);
    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false;
    let sum = 0;
    for (let i=0; i<9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
    let rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    if (rest !== parseInt(cpf.charAt(9))) return false;
    sum = 0;
    for (let i=0; i<10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
    rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    return rest === parseInt(cpf.charAt(10));
  }

  function enforceOnlyDigits(input, maxLen){
    input.addEventListener('input', () => {
      const digits = (input.value||"").replace(/\D/g, "");
      input.value = maxLen ? digits.slice(0, maxLen) : digits;
    });
  }

  function fillUfSelect(selectEl){
    if (!selectEl) return;
    const current = selectEl.value;
    selectEl.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = 'Selecione';
    selectEl.appendChild(opt0);
    UF_LIST.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.uf;
      opt.textContent = `${s.uf} — ${s.nome}`;
      selectEl.appendChild(opt);
    });
    if (current) selectEl.value = current;
  }

  async function requireLogin(){
    const { data } = await supabase.auth.getSession();
    if (!data?.session) {
      window.location.href = './login.html';
      return;
    }
    currentUser = data.session.user;
  }

  async function loadProject(){
    // se houver projetos, pega o primeiro ativo. (admin cria multi-projeto)
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      console.warn('projects:', error.message);
      return;
    }
    currentProject = projects?.[0] || null;
  }

  function renderHeader(){
    const header = $('#projectHeader');
    if (!header) return;

    const title = currentProject?.name || 'Sistema de Admissão • Fidel';
    header.querySelector('h1').textContent = title;
    header.querySelector('.sub').textContent = 'Preencha com atenção. Você pode salvar como rascunho e concluir depois.';

    // logo opcional do projeto
    const logo = $('#projectLogo');
    if (logo) {
      if (currentProject?.logo_url) {
        logo.src = currentProject.logo_url;
        logo.alt = title;
        logo.style.display = '';
      } else {
        logo.style.display = 'none';
      }
    }
  }

  // Estado civil => data casamento
  function wireEstadoCivil(){
    const sel = $('#estadoCivil');
    const wrap = $('#wrapDataCasamento');
    const inp = $('input[name="data_casamento"]');
    if (!sel || !wrap || !inp) return;

    function update(){
      const v = (sel.value||'').toLowerCase();
      const isCasado = v.includes('casad');
      wrap.style.display = isCasado ? '' : 'none';
      inp.required = isCasado;
      if (!isCasado) inp.value = '';
    }
    sel.addEventListener('change', update);
    update();
  }

  function wireCpfValidation(){
    const cpf = $('input[name="cpf"]');
    const hint = $('#cpfHint');
    if (!cpf) return;

    enforceOnlyDigits(cpf, 11);

    function validate(){
      const v = normalizeCPF(cpf.value);
      cpf.value = v;
      const ok = v.length === 11 && isValidCPF(v);
      if (!v) {
        cpf.setCustomValidity('');
        if (hint) hint.textContent = 'Somente números, 11 dígitos';
        return;
      }
      if (!ok) {
        cpf.setCustomValidity('CPF inválido');
        if (hint) hint.textContent = 'CPF inválido';
      } else {
        cpf.setCustomValidity('');
        if (hint) hint.textContent = 'CPF ok';
      }
    }
    cpf.addEventListener('blur', validate);
    cpf.addEventListener('input', validate);
  }

  function wirePhoneInputs(){
    const phoneFields = [
      $('input[name="telefone"]'),
      $('input[name="indicacao_tel"]'),
      $('input[name="emerg_tel"]'),
    ].filter(Boolean);
    phoneFields.forEach(i => enforceOnlyDigits(i, 11));

    // campos de telefone de dependentes são criados dinamicamente: trataremos por delegação
    document.addEventListener('input', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.dataset.onlyDigits === '1') {
        const max = t.dataset.maxLen ? parseInt(t.dataset.maxLen,10) : null;
        const digits = (t.value||'').replace(/\D/g, '');
        t.value = max ? digits.slice(0,max) : digits;
      }
    });
  }

  // Dependentes
  function depBlock(type){
    // type: 'IRPF' | 'PLANO'
    const wrap = document.createElement('div');
    wrap.className = 'dep-block';

    const row = document.createElement('div');
    row.className = 'grid grid-3';

    const mk = (label, name, req=false, opts=null) => {
      const l = document.createElement('label');
      l.className = 'field';
      const s = document.createElement('span');
      s.textContent = label;
      l.appendChild(s);
      if (opts) {
        const sel = document.createElement('select');
        sel.name = name;
        if (req) sel.required = true;
        opts.forEach(o=>{
          const op = document.createElement('option');
          op.value = o.value;
          op.textContent = o.text;
          sel.appendChild(op);
        });
        l.appendChild(sel);
      } else {
        const i = document.createElement('input');
        i.name = name;
        if (req) i.required = true;
        l.appendChild(i);
      }
      return l;
    };

    row.appendChild(mk('Nome', 'dep_nome', true));
    row.appendChild(mk('CPF', 'dep_cpf', false));
    row.appendChild(mk('Data de nascimento', 'dep_nasc', false));

    if (type === 'PLANO') {
      // básicos exigidos em plano: grau + sexo + titularidade
      const row2 = document.createElement('div');
      row2.className = 'grid grid-3';
      row2.appendChild(mk('Parentesco', 'dep_parentesco', true, [
        {value:'', text:'Selecione'},
        {value:'conjuge', text:'Cônjuge'},
        {value:'filho', text:'Filho(a)'},
        {value:'enteado', text:'Enteado(a)'},
        {value:'outro', text:'Outro'}
      ]));
      row2.appendChild(mk('Sexo', 'dep_sexo', true, [
        {value:'', text:'Selecione'},
        {value:'M', text:'Masculino'},
        {value:'F', text:'Feminino'}
      ]));
      row2.appendChild(mk('Tipo', 'dep_tipo', true, [
        {value:'', text:'Selecione'},
        {value:'titular', text:'Titular'},
        {value:'dependente', text:'Dependente'}
      ]));
      wrap.appendChild(row2);
    }

    const actions = document.createElement('div');
    actions.className = 'dep-actions';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn small danger';
    btn.textContent = 'Remover';
    btn.addEventListener('click', () => wrap.remove());
    actions.appendChild(btn);

    wrap.appendChild(row);
    wrap.appendChild(actions);

    // marca inputs com onlyDigits quando apropriado
    const depCpf = wrap.querySelector('input[name="dep_cpf"]');
    if (depCpf) {
      depCpf.dataset.onlyDigits = '1';
      depCpf.dataset.maxLen = '11';
    }

    return wrap;
  }

  function readDependents(containerId){
    const container = $(containerId);
    if (!container) return [];
    const blocks = Array.from(container.querySelectorAll('.dep-block'));
    return blocks.map(b => {
      const get = (n) => (b.querySelector(`[name="${n}"]`)?.value || '').trim();
      const obj = {
        nome: get('dep_nome'),
        cpf: normalizeCPF(get('dep_cpf')),
        nasc: get('dep_nasc'),
        parentesco: get('dep_parentesco'),
        sexo: get('dep_sexo'),
        tipo: get('dep_tipo'),
      };
      return obj;
    }).filter(d => d.nome);
  }

  function wireDependents(){
    const btnIR = $('#addDepIR');
    const btnPL = $('#addDepPL');
    const cIR = $('#depsIRPF');
    const cPL = $('#depsPlano');

    if (btnIR && cIR) {
      btnIR.addEventListener('click', () => cIR.appendChild(depBlock('IRPF')));
    }
    if (btnPL && cPL) {
      btnPL.addEventListener('click', () => cPL.appendChild(depBlock('PLANO')));
    }
  }

  // Anexos UI
  function renderDocsUI(){
    const root = $('#docs');
    if (!root) return;
    root.innerHTML = '';

    DOCS_ORDER.forEach(d => {
      const row = document.createElement('div');
      row.className = 'doc-row';
      row.dataset.key = d.key;

      const left = document.createElement('div');
      left.className = 'doc-left';
      left.innerHTML = `<div class="doc-num">${String(d.num).padStart(2,'0')}</div><div class="doc-label">${d.label}</div>`;

      const right = document.createElement('div');
      right.className = 'doc-right';

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = ACCEPT_DOCS;
      input.dataset.docKey = d.key;

      const meta = document.createElement('div');
      meta.className = 'doc-meta';
      meta.textContent = 'Nenhum arquivo selecionado';

      const score = document.createElement('div');
      score.className = 'doc-score';

      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) {
          delete uploads[d.key];
          delete legibilityScores[d.key];
          meta.textContent = 'Nenhum arquivo selecionado';
          score.textContent = '';
          return;
        }
        uploads[d.key] = file;
        meta.textContent = `${file.name} (${Math.round(file.size/1024)} KB)`;

        if (scoreFileLegibility) {
          score.textContent = 'Avaliando legibilidade...';
          try {
            const r = await scoreFileLegibility(file);
            legibilityScores[d.key] = r.score;
            const ok = r.score >= 60;
            score.textContent = `Legibilidade: ${r.score}/100 ${ok ? '✅' : '⚠️'}`;
            score.classList.toggle('bad', !ok);
          } catch (e) {
            score.textContent = 'Legibilidade: não foi possível avaliar';
          }
        }
      });

      right.appendChild(input);
      right.appendChild(meta);
      right.appendChild(score);

      row.appendChild(left);
      row.appendChild(right);
      root.appendChild(row);
    });
  }

  function validateRequiredDocs(){
    // foto é obrigatória e os demais podem variar; aqui seguimos sua lista como obrigatória para envio
    const missing = DOCS_ORDER.filter(d => !uploads[d.key]);
    return missing;
  }

  async function checkLegibilityBeforeSend(){
    const bad = [];
    for (const d of DOCS_ORDER) {
      if (!uploads[d.key]) continue;
      const score = legibilityScores[d.key];
      if (typeof score === 'number' && score < 60) bad.push({ key: d.key, label: d.label, score });
    }
    return bad;
  }

  // Foto + "validade de rosto" (orientações) => apenas UX + captura opcional
  function wireLiveness(){
    const btn = $('#btnOpenCamera');
    const camWrap = $('#cameraWrap');
    const video = $('#cameraVideo');
    const btnSnap = $('#btnSnap');
    const preview = $('#selfiePreview');
    const selfieInput = $('#selfieFile');
    let stream = null;

    async function stop(){
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
      }
    }

    if (btn && camWrap && video) {
      btn.addEventListener('click', async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
          video.srcObject = stream;
          camWrap.style.display = '';
        } catch (e) {
          alert('Não foi possível acessar a câmera. Verifique permissões do navegador.');
        }
      });
    }

    if (btnSnap && video && preview && selfieInput) {
      btnSnap.addEventListener('click', async () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 720;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
        if (!blob) return;
        const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
        const dt = new DataTransfer();
        dt.items.add(file);
        selfieInput.files = dt.files;
        preview.src = URL.createObjectURL(blob);
        preview.style.display = '';
        await stop();
        camWrap.style.display = 'none';
      });
    }

    window.addEventListener('beforeunload', stop);
  }

  // Assinatura
  function setupSignature(){
    const canvas = $('#sigCanvas');
    if (!canvas) return { getBlob: async()=>null, clear: ()=>{}, isEmpty: ()=>true };

    const ctx = canvas.getContext('2d');
    let drawing = false;
    let empty = true;

    function resize(){
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(rect.width * ratio));
      const h = Math.max(1, Math.floor(rect.height * ratio));
      const old = canvas.toDataURL();
      canvas.width = w;
      canvas.height = h;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      // não tenta re-desenhar o antigo - simplifica
      if (old && old.length > 50 && !empty) {
        const img = new Image();
        img.onload = () => { ctx.drawImage(img, 0, 0, rect.width, rect.height); };
        img.src = old;
      }
    }

    function pos(e){
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left);
      const y = (e.clientY - r.top);
      return {x,y};
    }

    function start(e){
      drawing = true;
      empty = false;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      e.preventDefault();
    }
    function move(e){
      if (!drawing) return;
      const p = pos(e);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#111';
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      e.preventDefault();
    }
    function end(e){ drawing = false; e.preventDefault(); }

    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointerleave', end);

    window.addEventListener('resize', resize);
    resize();

    const btnClear = $('#btnSigClear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        ctx.clearRect(0,0,canvas.width, canvas.height);
        empty = true;
      });
    }

    return {
      isEmpty: ()=> empty,
      clear: ()=> { ctx.clearRect(0,0,canvas.width, canvas.height); empty = true; },
      getBlob: async () => {
        if (empty) return null;
        return await new Promise(r => canvas.toBlob(r, 'image/png'));
      }
    };
  }

  function collectFormData(){
    const form = $('#admissionForm');
    const fd = new FormData(form);
    const obj = {};
    for (const [k,v] of fd.entries()) obj[k] = (v||'').toString().trim();
    // normalizações
    obj.cpf = normalizeCPF(obj.cpf);
    obj.telefone = normalizeCPF(obj.telefone);
    obj.indicacao_tel = normalizeCPF(obj.indicacao_tel);
    obj.emerg_tel = normalizeCPF(obj.emerg_tel);
    return obj;
  }

  // rascunho (DB + localStorage)
  const LS_KEY = () => `fidel_draft_${currentUser?.id || 'anon'}`;

  async function saveDraft(){
    const data = collectFormData();
    const deps1 = readDependents('#depsIRPF');
    const deps2 = readDependents('#depsPlano');

    // salva local
    localStorage.setItem(LS_KEY(), JSON.stringify({ data, deps1, deps2, savedAt: new Date().toISOString() }));

    // salva no banco (sem anexos)
    const payload = {
      user_id: currentUser.id,
      project_id: currentProject?.id || null,
      status: 'DRAFT',
      form_data: data,
      dependents_irpf: deps1,
      dependents_plano: deps2,
      updated_at: new Date().toISOString()
    };

    let res;
    if (currentSubmissionId) {
      res = await supabase.from('submissions').update(payload).eq('id', currentSubmissionId).select('id').single();
    } else {
      res = await supabase.from('submissions').insert(payload).select('id').single();
    }
    if (res.error) {
      console.warn(res.error);
      setMsg('Rascunho salvo localmente. (Banco: não foi possível salvar)', 'warn');
      return;
    }
    currentSubmissionId = res.data.id;
    setMsg('Rascunho salvo ✅ Você pode voltar e concluir depois.', 'ok');
  }

  function applyDataToForm(data){
    if (!data) return;
    const form = $('#admissionForm');
    Object.keys(data).forEach(k => {
      const el = form.querySelector(`[name="${k}"]`);
      if (!el) return;
      el.value = data[k];
    });
  }

  function renderDependentsFromList(containerId, list, type){
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '';
    (list || []).forEach(d => {
      const block = depBlock(type);
      const set = (name, val) => { const el = block.querySelector(`[name="${name}"]`); if (el) el.value = val || ''; };
      set('dep_nome', d.nome);
      set('dep_cpf', d.cpf);
      set('dep_nasc', d.nasc);
      set('dep_parentesco', d.parentesco);
      set('dep_sexo', d.sexo);
      set('dep_tipo', d.tipo);
      c.appendChild(block);
    });
  }

  async function loadDraft(){
    // 1) tenta banco: último DRAFT do usuário
    const { data: rows } = await supabase
      .from('submissions')
      .select('id, status, form_data, dependents_irpf, dependents_plano, updated_at')
      .eq('user_id', currentUser.id)
      .eq('status', 'DRAFT')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (rows && rows.length) {
      currentSubmissionId = rows[0].id;
      applyDataToForm(rows[0].form_data);
      renderDependentsFromList('#depsIRPF', rows[0].dependents_irpf, 'IRPF');
      renderDependentsFromList('#depsPlano', rows[0].dependents_plano, 'PLANO');
      setMsg('Rascunho carregado do sistema ✅', 'ok');
      return;
    }

    // 2) fallback: localStorage
    const raw = localStorage.getItem(LS_KEY());
    if (!raw) return;
    try {
      const j = JSON.parse(raw);
      applyDataToForm(j.data);
      renderDependentsFromList('#depsIRPF', j.deps1, 'IRPF');
      renderDependentsFromList('#depsPlano', j.deps2, 'PLANO');
      setMsg('Rascunho carregado localmente ✅', 'ok');
    } catch { /* ignore */ }
  }

  async function clearDraft(){
    localStorage.removeItem(LS_KEY());
    if (currentSubmissionId) {
      await supabase.from('submissions').delete().eq('id', currentSubmissionId).eq('status', 'DRAFT');
      currentSubmissionId = null;
    }
    setMsg('Rascunho limpo.', '');
  }

  async function previewPDFs(sigPad){
    setMsg('Gerando pré-visualização...', '');
    const data = collectFormData();
    const deps1 = readDependents('#depsIRPF');
    const deps2 = readDependents('#depsPlano');
    const sigBlob = await sigPad.getBlob();

    const fotoFile = uploads.foto || null;
    const fotoUrl = fotoFile ? URL.createObjectURL(fotoFile) : null;
    const sigUrl = sigBlob ? URL.createObjectURL(sigBlob) : null;

    const pdf1 = await makeCadastroPDF({ data, depsIRPF: deps1, depsPlano: deps2, fotoUrl, sigUrl, footerUser: currentUser.email || currentUser.id });
    const pdf2 = await makePlanoPDF({ data, depsPlano: deps2, fotoUrl, sigUrl, footerUser: currentUser.email || currentUser.id });

    const url1 = URL.createObjectURL(pdf1);
    const url2 = URL.createObjectURL(pdf2);

    window.open(url1, '_blank');
    window.open(url2, '_blank');
    setMsg('Pré-visualização aberta em novas abas.', 'ok');
  }

  async function sendAll(sigPad){
    setMsg('Validando...', '');

    const form = $('#admissionForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      setMsg('Verifique os campos obrigatórios.', 'warn');
      return;
    }

    // anexos obrigatórios
    const missing = validateRequiredDocs();
    if (missing.length) {
      setMsg('Faltam anexos obrigatórios: ' + missing.map(m=>m.label).join(', '), 'warn');
      return;
    }

    // assinatura obrigatória
    if (sigPad.isEmpty()) {
      setMsg('Assinatura é obrigatória.', 'warn');
      return;
    }

    // legibilidade
    const bad = await checkLegibilityBeforeSend();
    if (bad.length) {
      const txt = bad.map(b=>`${b.label} (${b.score}/100)`).join('; ');
      if (!confirm('Alguns anexos estão com baixa legibilidade:\n\n' + txt + '\n\nDeseja continuar mesmo assim?')) {
        setMsg('Envio cancelado para ajuste de documentos.', 'warn');
        return;
      }
    }

    setMsg('Gerando PDFs...', '');

    const data = collectFormData();
    const deps1 = readDependents('#depsIRPF');
    const deps2 = readDependents('#depsPlano');
    const sigBlob = await sigPad.getBlob();

    const fotoFile = uploads.foto || null;
    const fotoUrl = fotoFile ? URL.createObjectURL(fotoFile) : null;
    const sigUrl = sigBlob ? URL.createObjectURL(sigBlob) : null;

    const pdfCadastro = await makeCadastroPDF({ data, depsIRPF: deps1, depsPlano: deps2, fotoUrl, sigUrl, footerUser: currentUser.email || currentUser.id });
    const pdfPlano = await makePlanoPDF({ data, depsPlano: deps2, fotoUrl, sigUrl, footerUser: currentUser.email || currentUser.id });

    const baseName = (data.nome||'COLABORADOR').toUpperCase().replace(/\s+/g,' ').trim();

    setMsg('Montando ZIP...', '');
    const zipBlob = await buildZipFromUploads(baseName, uploads, DOCS_ORDER, pdfCadastro, pdfPlano);

    // grava submissão como ENVIADO (atualiza rascunho ou cria)
    setMsg('Salvando submissão...', '');

    const payload = {
      user_id: currentUser.id,
      project_id: currentProject?.id || null,
      status: 'ENVIADO',
      form_data: data,
      dependents_irpf: deps1,
      dependents_plano: deps2,
      updated_at: new Date().toISOString()
    };

    let sub;
    if (currentSubmissionId) {
      sub = await supabase.from('submissions').update(payload).eq('id', currentSubmissionId).select('id').single();
    } else {
      sub = await supabase.from('submissions').insert(payload).select('id').single();
    }

    if (sub.error) {
      console.warn(sub.error);
      setMsg('Não foi possível salvar a submissão no banco, mas os arquivos foram gerados.', 'warn');
    } else {
      currentSubmissionId = sub.data.id;
    }

    // chama edge function para enviar e-mail com ZIP
    setMsg('Enviando e-mail...', '');

    const toList = (currentProject?.notification_emails || []).length ? currentProject.notification_emails : null;

    const b64 = await blobToBase64(zipBlob);

    const subject = `Cadastro Funcionário: ${baseName} - Indicação: ${data.indicacao_nome || '—'}`;

    const { data: fnRes, error: fnErr } = await supabase.functions.invoke(cfg.FUNCTIONS.submitPackage, {
      body: {
        subject,
        submission_id: currentSubmissionId,
        to: toList,
        file_name: `99 - ${baseName}.zip`,
        zip_base64: b64,
        form_data: data,
        dependents_irpf: deps1,
        dependents_plano: deps2,
      }
    });

    if (fnErr) {
      console.warn(fnErr);
      setMsg('Gerado, mas o envio de e-mail falhou. Você pode baixar o ZIP abaixo.', 'warn');
      downloadBlob(zipBlob, `99 - ${baseName}.zip`);
      return;
    }

    setMsg('Enviado com sucesso ✅', 'ok');
    // limpa rascunho local
    localStorage.removeItem(LS_KEY());

    // oferece download do ZIP também
    downloadBlob(zipBlob, `99 - ${baseName}.zip`);
  }

  function downloadBlob(blob, filename){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function blobToBase64(blob){
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i=0; i<bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function wireDraftButtons(){
    const b1 = $('#btnSaveDraft');
    const b2 = $('#btnClearDraft');
    if (b1) b1.addEventListener('click', () => saveDraft());
    if (b2) b2.addEventListener('click', () => {
      if (confirm('Limpar rascunho?')) clearDraft();
    });
  }

  function wireFooter(){
    const f = $('#footerUser');
    if (f) f.textContent = `Usuário: ${currentUser?.email || currentUser?.id || ''}`;
  }

  function fillAllUF(){
    $all('select[data-uf-select]').forEach(fillUfSelect);
  }

  async function init(){
    await requireLogin();
    await loadProject();
    renderHeader();
    fillAllUF();
    wireFooter();

    wireCpfValidation();
    wirePhoneInputs();
    wireEstadoCivil();

    wireDependents();
    renderDocsUI();
    wireLiveness();

    const sigPad = setupSignature();

    wireDraftButtons();

    // botões
    const btnPreview = $('#btnPreview');
    if (btnPreview) btnPreview.addEventListener('click', () => previewPDFs(sigPad));

    const form = $('#admissionForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await sendAll(sigPad);
    });

    // carrega rascunho (se houver)
    await loadDraft();
    // atualiza visibilidade do casamento após carregar draft
    wireEstadoCivil();
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().catch(err => {
      console.error(err);
      setMsg('Erro ao inicializar o formulário. Veja o console do navegador.', 'warn');
    });
  });
})();
