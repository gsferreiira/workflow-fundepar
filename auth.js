// auth.js
const SUPABASE_URL = 'https://ljbqumddeinvpoxulmrm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FULVqLs0S34LcLNLwqltmQ_2fqOoMLU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const Auth = {
    user: null, 
    isInitialized: false, // Trava de performance

    init: async () => {
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (session && session.user) {
                // Se já carregou o app e é só um refresh do Supabase, ignora para não travar a tela
                if (Auth.isInitialized && Auth.user && Auth.user.id === session.user.id) {
                    return; 
                }

                await Auth.fetchProfile(session.user);
                Auth.isInitialized = true;
                App.showAppView(); 
            } else {
                Auth.user = null;
                Auth.isInitialized = false;
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

        UI.showToast('Cadastro realizado!', 'success');
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
        Auth.isInitialized = false;
        await supabaseClient.auth.signOut();
        UI.showToast('Logout realizado com sucesso!', 'success');
    }
};