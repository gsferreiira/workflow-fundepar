// auth.js
// Configuração do Supabase com as suas credenciais
const SUPABASE_URL = 'https://ljbqumddeinvpoxulmrm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FULVqLs0S34LcLNLwqltmQ_2fqOoMLU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Gerenciamento de Autenticação
const Auth = {
    user: null, // Armazena o usuário atual e seu perfil

    // 1. Inicializar autenticação e escutar mudanças de sessão
    init: async () => {
        // Escuta mudanças (LOGIN, SIGNOUT)
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (session && session.user) {
                // Ao logar, busca o perfil detalhado na tabela profiles
                await Auth.fetchProfile(session.user);
                App.showAppView(); // Inicia a SPA
            } else {
                Auth.user = null;
                App.showAuthView(); // Mostra tela de login
            }
        });
    },

    // 2. Buscar perfil detalhado (Join auth.user com profiles)
    fetchProfile: async (authUser) => {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();

        if (error) {
            console.error('Erro ao buscar perfil:', error.message);
            // Em caso de erro, criamos um perfil básico para não quebrar a UI
            Auth.user = { ...authUser, full_name: authUser.email, role: 'usuario' };
        } else {
            // Unificamos os dados do usuário com o perfil
            Auth.user = { ...authUser, ...profile };
        }
    },

    // 3. Função de Cadastro de Novo Usuário na Plataforma
    signUp: async (full_name, email, password) => {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            // Passamos metadados que serão usados no trigger SQL para criar o perfil
            options: { data: { full_name: full_name } }
        });

        if (error) {
            UI.showToast(error.message, 'danger');
            return null;
        }

        UI.showToast('Cadastro realizado! Verifique seu e-mail para confirmar a conta.', 'success');
        return data.user;
    },

    // 4. Função de Login
    signIn: async (email, password) => {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            UI.showToast(error.message, 'danger');
            return null;
        }

        return data.user;
    },

    // 5. Função de Logout
    signOut: async () => {
        await supabaseClient.auth.signOut();
        UI.showToast('Logout realizado com sucesso!', 'success');
    }
};