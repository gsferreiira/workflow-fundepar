// modules/perfil.js — Página de perfil do usuário logado (nome + senha).
App.modules.perfil = {
  init: () => {
    document.getElementById("view-content").innerHTML =
      Views.app.perfilPage(Auth.user);
    if (typeof lucide !== "undefined") lucide.createIcons();
  },

  updateName: async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.innerHTML =
      '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Salvando...';
    if (typeof lucide !== "undefined") lucide.createIcons();
    const newName = document.getElementById("perfil-name").value.trim();
    const { error } = await supabaseClient
      .from("profiles")
      .update({ full_name: newName })
      .eq("id", Auth.user.id);
    if (error) {
      UI.showToast("Erro ao salvar: " + error.message, "danger");
      btn.disabled = false;
      btn.textContent = orig;
      return;
    }
    Auth.user.full_name = newName;
    App.renderSidebarProfile();
    btn.disabled = false;
    btn.textContent = orig;
    UI.showToast("Nome atualizado!", "success");
  },

  updatePassword: async (e) => {
    e.preventDefault();
    const newPass = document.getElementById("perfil-new-pass").value;
    const confPass = document.getElementById("perfil-confirm-pass").value;
    if (newPass !== confPass) {
      UI.showToast("As senhas não coincidem.", "warning");
      return;
    }
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.innerHTML =
      '<i data-lucide="loader-2" style="animation:spin 1s linear infinite;"></i> Alterando...';
    if (typeof lucide !== "undefined") lucide.createIcons();
    const { error } = await supabaseClient.auth.updateUser({
      password: newPass,
    });
    if (error) {
      UI.showToast("Erro: " + error.message, "danger");
      btn.disabled = false;
      btn.textContent = orig;
      return;
    }
    e.target.reset();
    btn.disabled = false;
    btn.textContent = orig;
    UI.showToast("Senha alterada com sucesso!", "success");
  },
};
