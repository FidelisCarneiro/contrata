// Sistema de Admissão • Fidel
// supabaseClient.js (global)

(function(){
  const cfg = window.FIDEL_CONFIG;
  if (!cfg) {
    console.error('FIDEL_CONFIG não carregado.');
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase JS não carregado. Inclua o CDN antes deste arquivo.');
    return;
  }

  window.FIDEL_SUPABASE = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
})();
