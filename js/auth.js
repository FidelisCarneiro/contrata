// Sistema de Admissão • Fidel
// auth.js (global) - login e troca obrigatória de senha

(function(){
  const supabase = window.FIDEL_SUPABASE;
  if (!supabase) {
    console.error('Supabase não inicializado.');
    return;
  }

  const form = document.getElementById('loginForm');
  const msg = document.getElementById('loginMsg');
  const btnForgot = document.getElementById('btnForgot');

  function setMsg(text, type=''){
    if (!msg) return;
    msg.textContent = text || '';
    msg.className = 'msg ' + (type || '');
  }

  function onlyDigits(str){ return (str||'').replace(/\D/g,''); }

  async function getProfileByCpf(cpf){
    const { data, error } = await supabase
      .from('profiles')
      .select('id, cpf, full_name, role, active, first_access')
      .eq('cpf', cpf)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function doLogin(email, password){
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function ensureEmailForCpf(cpf){
    // Estratégia: usamos um e-mail sintético por CPF para o Auth
    return `${cpf}@fidel.local`;
  }

  async function mustChangePassword(userId){
    const { data, error } = await supabase
      .from('profiles')
      .select('first_access')
      .eq('id', userId)
      .maybeSingle();
    if (error) return false;
    return !!data?.first_access;
  }

  async function forcePasswordChangeFlow(){
    const newPass = prompt('Primeiro acesso: crie uma nova senha (mínimo 6 caracteres):');
    if (!newPass || newPass.length < 6) {
      setMsg('Senha inválida. Tente novamente.', 'error');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMsg('Sessão não encontrada.', 'error');
      return;
    }
    const { error: err1 } = await supabase.auth.updateUser({ password: newPass });
    if (err1) {
      setMsg(err1.message || 'Erro ao atualizar senha.', 'error');
      return;
    }
    // limpa flag
    await supabase.from('profiles').update({ first_access: false }).eq('id', user.id);
    setMsg('Senha atualizada com sucesso. Redirecionando...', 'success');
    setTimeout(()=>{ window.location.href = './form.html'; }, 500);
  }

  if (form){
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      setMsg('Entrando...');
      const cpf = onlyDigits(document.getElementById('cpf').value);
      const pass = document.getElementById('password').value;

      if (cpf.length !== 11) { setMsg('Informe um CPF com 11 dígitos.', 'error'); return; }
      if (!pass) { setMsg('Informe sua senha.', 'error'); return; }

      try {
        const profile = await getProfileByCpf(cpf);
        if (!profile) { setMsg('Usuário não encontrado.', 'error'); return; }
        if (!profile.active) { setMsg('Usuário inativo. Procure o administrador.', 'error'); return; }

        const email = await ensureEmailForCpf(cpf);
        await doLogin(email, pass);

        // rota por perfil
        const { data: { user } } = await supabase.auth.getUser();
        if (await mustChangePassword(user.id)) {
          await forcePasswordChangeFlow();
          return;
        }

        if (profile.role === 'ADMIN') window.location.href = './admin.html';
        else window.location.href = './form.html';
      } catch (err){
        setMsg(err?.message || 'Falha no login.', 'error');
      }
    });
  }

  if (btnForgot){
    btnForgot.addEventListener('click', ()=>{
      alert('Peça ao Administrador para realizar o reset de senha.');
    });
  }
})();
