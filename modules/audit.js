// modules/audit.js — Registro centralizado de ações para auditoria.
//
// Uso:
//   Audit.log('create', 'rooms', sala.id, { name: sala.name });
//   Audit.log('update', 'equipment', eq.id, { before: oldData, after: newData });
//   Audit.log('delete', 'asset_movements', movId);
//
// Logs são gravados em audit_logs. Falhas são silenciosas (apenas console.warn)
// para nunca bloquear a operação principal do usuário.
const Audit = {
  log: async (action, tableName, recordId, details = null) => {
    if (!Auth.user) return;
    try {
      const { error } = await supabaseClient.from("audit_logs").insert([
        {
          actor_id: Auth.user.id,
          actor_name: Auth.user.full_name || Auth.user.email || null,
          table_name: tableName,
          record_id: recordId != null ? String(recordId) : null,
          action: action,
          details: details,
        },
      ]);
      if (error) {
        console.warn(`Audit.log falhou (${action} ${tableName}):`, error.message);
      }
    } catch (err) {
      console.warn(`Audit.log exceção (${action} ${tableName}):`, err);
    }
  },

  // Helpers semânticos opcionais
  created: (tableName, recordId, details) => Audit.log("create", tableName, recordId, details),
  updated: (tableName, recordId, details) => Audit.log("update", tableName, recordId, details),
  deleted: (tableName, recordId, details) => Audit.log("delete", tableName, recordId, details),
  restored: (tableName, recordId, details) => Audit.log("restore", tableName, recordId, details),
};
