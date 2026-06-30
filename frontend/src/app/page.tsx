import { api, TimeseriesPoint, ModelBreakdown, TopUser, SystemStats } from "@/lib/api";
import { StatsCard } from "@/components/StatsCard";
import { RequestsChart, ModelsBarChart } from "@/components/Charts";
import {
  Activity,
  Clock,
  Zap,
  AlertTriangle,
  Key,
  TrendingUp,
  Bot,
  Hash,
  Cpu,
  Database,
} from "lucide-react";

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

export default async function OverviewPage() {
  let overview = null;
  let timeseries: TimeseriesPoint[] = [];
  let modelBreakdown: ModelBreakdown[] = [];
  let topUsers: TopUser[] = [];
  let systemStats: SystemStats | null = null;

  try {
    const results = await Promise.allSettled([
      api.overview(),
      api.timeseries(24),
      api.modelBreakdown(),
      api.topUsers(5),
      api.systemStats(),
    ]);

    if (results[0].status === "fulfilled") overview = results[0].value;
    if (results[1].status === "fulfilled") timeseries = results[1].value;
    if (results[2].status === "fulfilled") modelBreakdown = results[2].value;
    if (results[3].status === "fulfilled") topUsers = results[3].value;
    if (results[4].status === "fulfilled") systemStats = results[4].value;
  } catch {
    // Gateway might not be running yet — show empty state
  }

  const cards = overview
    ? [
        {
          title: "Requests Today",
          value: fmt(overview.requests_today),
          subtitle: `${fmt(overview.requests_this_week)} this week`,
          icon: <Activity size={20} />,
          accent: "#8b5cf6",
        },
        {
          title: "Avg Latency",
          value: `${overview.avg_latency_ms}ms`,
          subtitle: overview.p95_latency_ms ? `p95: ${overview.p95_latency_ms}ms` : undefined,
          icon: <Clock size={20} />,
          accent: "#60a5fa",
        },
        {
          title: "Input Tokens",
          value: fmt(overview.input_tokens_today),
          subtitle: "today",
          icon: <Hash size={20} />,
          accent: "#34d399",
        },
        {
          title: "Output Tokens",
          value: fmt(overview.output_tokens_today),
          subtitle: "today",
          icon: <TrendingUp size={20} />,
          accent: "#a78bfa",
        },
        {
          title: "Error Rate",
          value: `${overview.error_rate_pct}%`,
          subtitle: "last 24 hours",
          icon: <AlertTriangle size={20} />,
          accent: overview.error_rate_pct > 5 ? "#ef4444" : "#22c55e",
        },
        {
          title: "Active Keys",
          value: overview.active_keys_today,
          subtitle: "used today",
          icon: <Key size={20} />,
          accent: "#f59e0b",
        },
        {
          title: "Top Model",
          value: overview.top_model?.split(":")[0] ?? "—",
          subtitle: overview.top_model ?? "",
          icon: <Bot size={20} />,
          accent: "#ec4899",
        },
        {
          title: "System RAM",
          value: systemStats ? `${systemStats.ram_pct}%` : "—",
          subtitle: systemStats ? `${systemStats.ram_used_gb} / ${systemStats.ram_total_gb} GB` : "active usage",
          icon: <Database size={20} />,
          accent: "#06b6d4",
        },
      ]
    : [];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1
            className="gradient-text"
            style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}
          >
            AI Gateway
          </h1>
          <p style={{ color: "rgba(148,163,184,0.7)", marginTop: 6, fontSize: 14 }}>
            Pure Local AI Gateway — real-time analytics & local inference (Ollama)
          </p>
        </div>
        
        {systemStats && (
          <div style={{ display: "flex", gap: 16, background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(45, 45, 75, 0.4)", borderRadius: 12, padding: "10px 16px" }}>
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column" }}>
              <span style={{ color: "rgba(148, 163, 184, 0.5)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>CPU LOAD</span>
              <span style={{ color: "white", fontWeight: 700, marginTop: 2 }}>{systemStats.cpu_pct}% <span style={{ fontSize: 10, fontWeight: 400, color: "rgba(148,163,184,0.5)" }}>({systemStats.cpu_cores} Cores)</span></span>
            </div>
            <div style={{ width: 1, background: "rgba(45, 45, 75, 0.4)" }} />
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column" }}>
              <span style={{ color: "rgba(148, 163, 184, 0.5)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>RAM UTILIZATION</span>
              <span style={{ color: "white", fontWeight: 700, marginTop: 2 }}>{systemStats.ram_pct}% <span style={{ fontSize: 10, fontWeight: 400, color: "rgba(148,163,184,0.5)" }}>({systemStats.ram_used_gb}G / {systemStats.ram_total_gb}G)</span></span>
            </div>
            <div style={{ width: 1, background: "rgba(45, 45, 75, 0.4)" }} />
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column" }}>
              <span style={{ color: "rgba(148, 163, 184, 0.5)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>OLLAMA STATUS</span>
              <span style={{ color: systemStats.ollama_status === "Online" ? "#22c55e" : "#ef4444", fontWeight: 700, marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: systemStats.ollama_status === "Online" ? "#22c55e" : "#ef4444" }} />
                {systemStats.ollama_status}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* No-gateway warning */}
      {!overview && (
        <div
          className="glass"
          style={{
            padding: 20,
            marginBottom: 24,
            borderColor: "rgba(234,179,8,0.3)",
            background: "rgba(234,179,8,0.05)",
            color: "rgba(234,179,8,0.9)",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <AlertTriangle size={16} />
          Gateway backend not reachable. Start it with{" "}
          <code
            style={{
              background: "rgba(0,0,0,0.3)",
              padding: "2px 8px",
              borderRadius: 6,
              fontFamily: "monospace",
            }}
          >
            uvicorn main:app --reload
          </code>
        </div>
      )}

      {/* Stats grid */}
      {overview && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          {cards.map((card) => (
            <StatsCard key={card.title} {...card} />
          ))}
        </div>
      )}

      {/* Charts row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginBottom: 28,
        }}
      >
        <div className="glass" style={{ padding: 24 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 20,
              color: "rgba(241,245,249,0.9)",
            }}
          >
            Requests / min — last 24 h
          </div>
          {timeseries.length > 0 ? (
            <RequestsChart data={timeseries} />
          ) : (
            <div
              style={{
                height: 240,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(148,163,184,0.4)",
                fontSize: 14,
              }}
            >
              No data yet
            </div>
          )}
        </div>

        <div className="glass" style={{ padding: 24 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 20,
              color: "rgba(241,245,249,0.9)",
            }}
          >
            Model Usage — last 7 days
          </div>
          {modelBreakdown.length > 0 ? (
            <ModelsBarChart data={modelBreakdown} />
          ) : (
            <div
              style={{
                height: 220,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(148,163,184,0.4)",
                fontSize: 14,
              }}
            >
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Top users */}
      {topUsers.length > 0 && (
        <div className="glass" style={{ padding: 24 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 16,
              color: "rgba(241,245,249,0.9)",
            }}
          >
            Top Users — last 7 days
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Key Name</th>
                <th>Org</th>
                <th>Requests</th>
                <th>Input Tokens</th>
                <th>Output Tokens</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((u, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{u.api_key_name}</td>
                  <td>
                    <span
                      style={{
                        background: "rgba(139,92,246,0.15)",
                        color: "#a78bfa",
                        border: "1px solid rgba(139,92,246,0.3)",
                        borderRadius: 6,
                        padding: "2px 8px",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {u.org}
                    </span>
                  </td>
                  <td style={{ color: "#60a5fa", fontWeight: 600 }}>{fmt(u.requests)}</td>
                  <td style={{ color: "rgba(148,163,184,0.8)" }}>{fmt(u.input_tokens)}</td>
                  <td style={{ color: "rgba(148,163,184,0.8)" }}>{fmt(u.output_tokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
