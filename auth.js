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
            // Sincroniza email no perfil caso ainda não esteja salvo
            if (!profile.email) {
                supabaseClient.from('profiles').update({ email: authUser.email }).eq('id', authUser.id);
            }
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
    },

    // ── Operações Admin ────────────────────────────────────────────────
    admin: {
        createUser: async (full_name, email, role = 'usuario') => {
            const DEFAULT_PASSWORD = 'Fundepar26';

            // Cliente temporário sem persistir sessão — não afeta a sessão do admin
            const tempClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: { autoRefreshToken: false, persistSession: false }
            });

            const { data, error } = await tempClient.auth.signUp({
                email,
                password: DEFAULT_PASSWORD,
                options: { data: { full_name } }
            });
            if (error) { UI.showToast('Erro ao criar usuário: ' + error.message, 'danger'); return null; }

            // Cria o perfil com role usando a sessão do admin (protegido por RLS)
            const { error: profileError } = await supabaseClient.from('profiles').upsert({
                id: data.user.id,
                full_name,
                email,
                role
            }, { onConflict: 'id' });
            if (profileError) { UI.showToast('Usuário criado, mas erro no perfil: ' + profileError.message, 'warning'); }

            return data.user;
        },

        resetPassword: async (email) => {
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
            if (error) { UI.showToast('Erro ao enviar email de redefinição: ' + error.message, 'danger'); return false; }
            return true;
        }
    }
};