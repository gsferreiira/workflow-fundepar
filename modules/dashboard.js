// modules/dashboard.js — Estatísticas, movimentações recentes e gráfico mensal.
App.modules.dashboard = {
  init: async () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [
      { count: totalOpen },
      { count: totalResolved },
      { count: totalRooms },
      { count: totalEquipment },
      { data: recentMovements },
      { data: rooms },
      { data: profilesList },
      { data: chartMovements },
    ] = await Promise.all([
      supabaseClient
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "aberto")
        .is("deleted_at", null),
      supabaseClient
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "resolvido")
        .is("deleted_at", null),
      supabaseClient
        .from("rooms")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      supabaseClient
        .from("equipment")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      supabaseClient
        .from("asset_movements")
        .select("*, equipment(name)")
        .is("deleted_at", null)
        .order("moved_at", { ascending: false })
        .limit(8),
      supabaseClient.from("rooms").select("id, name").is("deleted_at", null),
      supabaseClient.from("profiles").select("id, full_name").is("deleted_at", null),
      supabaseClient
        .from("asset_movements")
        .select("moved_at")
        .is("deleted_at", null)
        .gte("moved_at", sixMonthsAgo.toISOString()),
    ]);

    const roomMap = Object.fromEntries((rooms || []).map((r) => [r.id, r]));
    const profileMap = Object.fromEntries(
      (profilesList || []).map((p) => [p.id, p]),
    );
    const recent = (recentMovements || []).map((m) => ({
      ...m,
      origin: roomMap[m.origin_room_id] || null,
      destination: roomMap[m.destination_room_id] || null,
      profiles: profileMap[m.moved_by] || null,
    }));

    const monthNames = [
      "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
      "Jul", "Ago", "Set", "Out", "Nov", "Dez",
    ];
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      d.setDate(1);
      chartData.push({
        label: monthNames[d.getMonth()],
        year: d.getFullYear(),
        month: d.getMonth(),
        count: 0,
      });
    }
    (chartMovements || []).forEach((m) => {
      const d = new Date(m.moved_at);
      const entry = chartData.find(
        (c) => c.month === d.getMonth() && c.year === d.getFullYear(),
      );
      if (entry) entry.count++;
    });

    document.getElementById("view-content").innerHTML = Views.app.dashboard(
      { totalOpen, totalResolved, totalRooms, totalEquipment },
      recent,
      chartData,
    );
    if (typeof lucide !== "undefined") lucide.createIcons();
  },
};
