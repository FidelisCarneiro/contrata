// Sistema de Admissão • Fidel
// admin.js (global) - painel do administrador

(function(){
  const supabase = window.FIDEL_SUPABASE;
  const cfg = window.FIDEL_CONFIG;
  if (!supabase || !cfg) {
    console.error('Supabase/Config não carregados.');
    return;
  }

  const elUser = document.getElementById('userInfo');
  const btnLogout = document.getElementById('btnLogout');
  const btnGoForm = document.getElementById('btnGoForm');

  const createForm = document.getElementById('createUserForm');
  const createMsg = document.getElementById('createUserMsg');

  const resetForm = document.getElementById('resetForm');
  const resetMsg = document.getElementById('resetMsg');

  const emailForm = document.getElementById('emailForm');
  const emailMsg = document.getElementById('emailMsg');
  const emailsInput = document.getElementById('emails');

  const projectsWrap = document.getElementById('projectsWrap');

  function setMsg(el, text, type=''){ if (!el) return; el.textContent = text||''; el.className = 'msg '+(type||''); }

  async function requireAdmin(){
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { location.href = './index.html'; return null; }
    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', session.user.id).maybeSingle();
    if (!profile || !profile.active) { await supabase.auth.signOut(); location.href='./index.html'; return null; }
    if (profile.role !== 'ADMIN' && profile.role !== 'SUPERADMIN') {
      location.href = './form.html';
      return null;
    }
    return { session, profile };
  }

  async function loadEmails(){
    // salva em app_settings id=1 com campo notification_emails (array) ou notification_email
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
    if (error) {
      setMsg(emailMsg, 'Falha ao carregar e-mails: '+error.message, 'err');
      return;
    }
    const list = (data && (data.notification_emails || (data.notification_email ? [data.notification_email] : []))) || [];
    emailsInput.value = list.join(', ');
  }

  async function saveEmails(){
    const raw = (emailsInput.value||'').split(',').map(s=>s.trim()).filter(Boolean);
    const uniq = Array.from(new Set(raw));
    const { error } = await supabase.from('app_settings').upsert({ id: 1, notification_emails: uniq }, { onConflict: 'id' });
    if (error) { setMsg(emailMsg, 'Erro ao salvar: '+error.message, 'err'); return; }
    setMsg(emailMsg, 'E-mails atualizados.', 'ok');
  }

  async function createUser(payload){
    setMsg(createMsg, 'Criando usuário...', '');
    const { data, error } = await supabase.functions.invoke(cfg.FUNCTIONS.adminCreateUser, { body: payload });
    if (error || (data && data.error)) {
      setMsg(createMsg, 'Erro: '+(error?.message || data?.error || 'desconhecido'), 'err');
      return;
    }
    setMsg(createMsg, 'Usuário criado com sucesso.', 'ok');
    createForm.reset();
  }

  async function resetPassword(payload){
    setMsg(resetMsg, 'Resetando senha...', '');
    const { data, error } = await supabase.functions.invoke(cfg.FUNCTIONS.adminResetPassword, { body: payload });
    if (error || (data && data.error)) {
      setMsg(resetMsg, 'Erro: '+(error?.message || data?.error || 'desconhecido'), 'err');
      return;
    }
    setMsg(resetMsg, 'Senha resetada (volta para 6 primeiros dígitos do CPF).', 'ok');
    resetForm.reset();
  }

  function renderProjectsUI(isSuperAdmin){
    if (!projectsWrap) return;
    if (!isSuperAdmin) {
      projectsWrap.innerHTML = '';
      return;
    }
    // UI simples (cadastro multi-projeto) - base para evoluir
    projectsWrap.innerHTML = `
      <div class="divider"></div>
      <div class="card-subtitle"><div class="icon-badge sm">🏗️</div><h3>Projetos (Superadmin)</h3></div>
      <form id="projForm" class="card">
        <div class="grid grid-3">
          <label class="field"><span>Nome do projeto</span><input name="name" required></label>
          <label class="field"><span>Slug</span><input name="slug" placeholder="ex: projeto-a" required></label>
          <label class="field"><span>E-mails destinatários (vírgula)</span><input name="emails" placeholder="ex: rh@empresa.com, obra@empresa.com" required></label>
        </div>
        <div class="actions"><button class="btn primary" type="submit">Cadastrar projeto</button></div>
        <div id="projMsg" class="msg"></div>
      </form>
    `;

    const projForm = document.getElementById('projForm');
    const projMsg = document.getElementById('projMsg');
    projForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(projForm);
      const name = (fd.get('name')||'').toString().trim();
      const slug = (fd.get('slug')||'').toString().trim();
      const emails = (fd.get('emails')||'').toString().split(',').map(s=>s.trim()).filter(Boolean);
      const uniq = Array.from(new Set(emails));
      if (!uniq.length) { setMsg(projMsg, 'Informe pelo menos 1 e-mail.', 'err'); return; }

      // tabela projects: (id uuid), name, slug, emails (json/array), active
      const { error } = await supabase.from('projects').insert({ name, slug, notification_emails: uniq, active: true });
      if (error) { setMsg(projMsg, 'Erro: '+error.message, 'err'); return; }
      setMsg(projMsg, 'Projeto cadastrado.', 'ok');
      projForm.reset();
    });
  }

  async function init(){
    const ctx = await requireAdmin();
    if (!ctx) return;

    if (elUser) elUser.textContent = `${ctx.profile.name || 'Usuário'} • ${ctx.profile.cpf}`;

    btnLogout?.addEventListener('click', async ()=>{ await supabase.auth.signOut(); location.href='./index.html'; });
    btnGoForm?.addEventListener('click', ()=>location.href='./form.html');

    await loadEmails();
    emailForm?.addEventListener('submit', async (e)=>{ e.preventDefault(); await saveEmails(); });

    createForm?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(createForm);
      await createUser({ name: fd.get('name'), cpf: fd.get('cpf'), role: fd.get('role'), active: fd.get('active')==='on' || fd.get('active')==='1' || fd.get('active')==='true' || fd.get('active')==='Sim' || fd.get('active')==='SIM' || fd.get('active')==='YES' });
    });

    resetForm?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(resetForm);
      await resetPassword({ user_id: fd.get('user_id'), cpf: fd.get('cpf') });
    });

    renderProjectsUI(ctx.profile.role === 'SUPERADMIN' && ctx.profile.cpf === '05717864647');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
