// modules/store.js — Cache centralizado de listas comuns (rooms, equipment, profiles).
//
// Por que existe:
//   - Antes, cada init() de módulo buscava rooms + profiles + equipment do banco.
//     Trocar 3x entre Movimentações e Rastreio fazia 12+ queries idênticas.
//   - O Store guarda a lista em memória por TTL (default 60s) e refeta só quando expira.
//   - Os módulos chamam Store.invalidate('rooms') após CRUD para forçar refresh.
//
// Uso típico:
//   const rooms = await Store.rooms();        // pega do cache, ou busca
//   await supabase.from('rooms').insert(...);
//   Store.invalidate('rooms');                // limpa cache
const Store = {
  _cache: {},
  _ttl: 60_000, // 60 segundos

  _isFresh: (key) => {
    const entry = Store._cache[key];
    return entry && Date.now() - entry.at < Store._ttl;
  },

  _fetch: async (key, query) => {
    if (Store._isFresh(key)) return Store._cache[key].data;
    const { data, error } = await query();
    if (error) {
      console.warn(`Store.${key} fetch falhou:`, error.message);
      return Store._cache[key]?.data || [];
    }
    Store._cache[key] = { data: data || [], at: Date.now() };
    return Store._cache[key].data;
  },

  rooms: () =>
    Store._fetch("rooms", () =>
      supabaseClient
        .from("rooms")
        .select("id, name")
        .is("deleted_at", null)
        .order("name"),
    ),

  roomsFull: () =>
    Store._fetch("roomsFull", () =>
      supabaseClient
        .from("rooms")
        .select("*")
        .is("deleted_at", null)
        .order("name"),
    ),

  equipment: () =>
    Store._fetch("equipment", () =>
      supabaseClient
        .from("equipment")
        .select("id, name")
        .is("deleted_at", null)
        .order("name"),
    ),

  profiles: () =>
    Store._fetch("profiles", () =>
      supabaseClient
        .from("profiles")
        .select("id, full_name")
        .is("deleted_at", null),
    ),

  // Invalida uma chave (ou várias). Próxima leitura busca do banco.
  invalidate: (...keys) => {
    keys.forEach((k) => delete Store._cache[k]);
  },

  // Invalida tudo (logout, recarga manual, etc).
  clear: () => {
    Store._cache = {};
  },
};
