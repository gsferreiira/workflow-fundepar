// auth.js
const SUPABASE_URL = 'https://ljbqumddeinvpoxulmrm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FULVqLs0S34LcLNLwqltmQ_2fqOoMLU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const Auth = {
    user: null, 

    init: async () => {
        // Verifica sessão imediatamente para não deixar tela em branco
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            await Auth.fetchProfile(session.user);
            App.showAppView();
        } else {
            App.showAuthView();
        }

        // Escuta mudanças posteriores (login / logout)
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                await Auth.fetchProfile(session.user);
                App.showAppView();
            } else if (event === 'SIGNED_OUT') {
                Auth.user = null;
                App.showAuthView();
            }
        });
    },

    fetchProfile: async (authUser) => {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();

        if (error) {
            console.error('Erro ao buscar perfil:', error.message);
            Auth.user = { ...authUser, full_name: authUser.email, role: 'usuario' };
        } else {
            Auth.user = { ...authUser, ...profile };
        }
    },

    signUp: async (full_name, email, password) => {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: { data: { full_name: full_name } }
        });

        if (error) {
            UI.showToast(error.message, 'danger');
            return null;
        }

        UI.showToast('Cadastro realizado! Se o e-mail for válido, confirme na sua caixa de entrada.', 'success');
        return data.user;
    },

    signIn: async (email, password) => {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            UI.showToast('Erro no login: ' + error.message, 'danger');
            return null;
        }

        return data.user;
    },

    signOut: async () => {
        await supabaseClient.auth.signOut();
        UI.showToast('Logout realizado com sucesso!', 'success');
    }
};