import { api, LocalModel } from "@/lib/api";
import { CheckCircle, XCircle, Cpu, Zap, Clock, AlertTriangle, HardDrive, Layers, Server } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default async function ModelsPage() {
  let providers = null;
  let breakdown = null;

  try {
    [providers, breakdown] = await Promise.all([
      api.providers(),
      api.modelBreakdown(),
    ]);
  } catch {
    // Gateway not running
  }

  const ollamaProvider = providers?.find((p) => p.provider === "ollama");
  const localModels = (ollamaProvider?.models as unknown as LocalModel[]) || [];
  const activeModels = localModels.filter((m) => m.loaded);

  return (
    <div>
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: 6,
            }}
          >
            Local Model Library
          </h1>
          <p style={{ color: "rgba(148,163,184,0.7)", fontSize: 14 }}>
            Manage local LLMs, inspect quantization, parameter size, and active memory allocation
          </p>
        </div>
        {ollamaProvider && (
          <span className={ollamaProvider.available ? "badge-success" : "badge-error"} style={{ padding: "6px 12px", fontSize: 13, borderRadius: 10 }}>
            {ollamaProvider.available ? <CheckCircle size={12} style={{ marginRight: 6 }} /> : <XCircle size={12} style={{ marginRight: 6 }} />}
            Ollama: {ollamaProvider.available ? "Connected" : "Disconnected"}
          </span>
        )}
      </div>

      {!providers ? (
        <div
          className="glass"
          style={{
            padding: 48,
            textAlign: "center",
            color: "rgba(148,163,184,0.5)",
            fontSize: 14,
          }}
        >
          Gateway not reachable. Make sure the backend server is running.
        </div>
      ) : (
        <>
          {/* Active VRAM Models Banner */}
          {activeModels.length > 0 && (
            <div
              className="glass"
              style={{
                padding: "16px 20px",
                marginBottom: 24,
                borderColor: "rgba(34,197,94,0.3)",
                background: "rgba(34,197,94,0.03)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 10px #22c55e, 0 0 20px #22c55e",
                  animation: "pulse 1.5s infinite",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>
                  Active Model(s) Loaded in VRAM
                </div>
                <div style={{ fontSize: 12, color: "rgba(148,163,184,0.8)", marginTop: 2 }}>
                  {activeModels.map((m) => `${m.name} (${m.parameter_size})`).join(", ")}
                </div>
              </div>
              <span
                style={{
                  background: "rgba(34,197,94,0.15)",
                  color: "#22c55e",
                  border: "1px solid rgba(34,197,94,0.3)",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                In Use
              </span>
            </div>
          )}

          {/* Model Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 20,
              marginBottom: 28,
            }}
          >
            {localModels.map((m) => (
              <div
                key={m.name}
                className="glass"
                style={{
                  padding: 24,
                  border: m.loaded ? "1px solid rgba(34,197,94,0.4)" : undefined,
                  background: m.loaded ? "rgba(34,197,94,0.02)" : undefined,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: 200,
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: m.loaded
                            ? "rgba(34,197,94,0.15)"
                            : "rgba(139,92,246,0.1)",
                          border: `1px solid ${m.loaded ? "rgba(34,197,94,0.3)" : "rgba(139,92,246,0.2)"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: m.loaded ? "#22c55e" : "#a78bfa",
                        }}
                      >
                        <Cpu size={18} />
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 15,
                            fontFamily: "monospace",
                            color: "white",
                          }}
                        >
                          {m.name.split(":")[0]}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "rgba(148,163,184,0.5)",
                            marginTop: 1,
                            fontFamily: "monospace",
                          }}
                        >
                          tag: {m.name.split(":")[1] || "latest"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Specs */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <Server size={14} style={{ color: "rgba(148,163,184,0.5)" }} />
                      <div>
                        <div style={{ fontSize: 10, color: "rgba(148,163,184,0.4)", fontWeight: 700, textTransform: "uppercase" }}>Family</div>
                        <div style={{ fontWeight: 600, color: "rgba(241,245,249,0.9)", textTransform: "capitalize" }}>{m.family}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <Zap size={14} style={{ color: "rgba(148,163,184,0.5)" }} />
                      <div>
                        <div style={{ fontSize: 10, color: "rgba(148,163,184,0.4)", fontWeight: 700, textTransform: "uppercase" }}>Params</div>
                        <div style={{ fontWeight: 600, color: "rgba(241,245,249,0.9)" }}>{m.parameter_size}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <Layers size={14} style={{ color: "rgba(148,163,184,0.5)" }} />
                      <div>
                        <div style={{ fontSize: 10, color: "rgba(148,163,184,0.4)", fontWeight: 700, textTransform: "uppercase" }}>Quantization</div>
                        <div style={{ fontWeight: 600, color: "rgba(241,245,249,0.9)" }}>{m.quantization}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <HardDrive size={14} style={{ color: "rgba(148,163,184,0.5)" }} />
                      <div>
                        <div style={{ fontSize: 10, color: "rgba(148,163,184,0.4)", fontWeight: 700, textTransform: "uppercase" }}>Size on Disk</div>
                        <div style={{ fontWeight: 600, color: "rgba(241,245,249,0.9)" }}>{formatBytes(m.size)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div
                  style={{
                    borderTop: "1px solid rgba(45,45,75,0.4)",
                    paddingTop: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontSize: 12, color: "rgba(148,163,184,0.6)" }}>Memory Status</span>
                  {m.loaded ? (
                    <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="pulse-dot" style={{ width: 6, height: 6, background: "#22c55e" }} />
                      Active in VRAM
                    </span>
                  ) : (
                    <span style={{ color: "rgba(148,163,184,0.5)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(148,163,184,0.4)" }} />
                      Idle on Disk
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Performance Table */}
          {breakdown && breakdown.length > 0 && (
            <div className="glass" style={{ padding: 24 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 16,
                  color: "rgba(241,245,249,0.9)",
                }}
              >
                Model Performance — last 7 days
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Requests</th>
                    <th>Input Tokens</th>
                    <th>Output Tokens</th>
                    <th>Avg Latency</th>
                    <th>Error Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((m, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 13 }}>
                          {m.model}
                        </div>
                      </td>
                      <td style={{ color: "#60a5fa", fontWeight: 600 }}>
                        {m.requests.toLocaleString()}
                      </td>
                      <td style={{ color: "rgba(148,163,184,0.8)" }}>
                        {m.input_tokens.toLocaleString()}
                      </td>
                      <td style={{ color: "rgba(148,163,184,0.8)" }}>
                        {m.output_tokens.toLocaleString()}
                      </td>
                      <td
                        style={{
                          color:
                            m.avg_latency_ms > 2000
                              ? "#ef4444"
                              : m.avg_latency_ms > 800
                              ? "#f59e0b"
                              : "#22c55e",
                          fontWeight: 600,
                        }}
                      >
                        {m.avg_latency_ms}ms
                      </td>
                      <td
                        style={{
                          color: m.error_rate_pct > 5 ? "#ef4444" : "rgba(148,163,184,0.8)",
                          fontWeight: 600,
                        }}
                      >
                        {m.error_rate_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Routing Rules Info */}
          <div className="glass" style={{ padding: 24, marginTop: 24 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 16,
                color: "rgba(241,245,249,0.9)",
              }}
            >
              Active Local Routing Rules
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { condition: "Prompt contains code keywords", target: "qwen2.5-coder:7b", provider: "ollama", color: "#a78bfa" },
                { condition: "Short prompt (< 80 chars)", target: "phi4-mini:latest", provider: "ollama", color: "#60a5fa" },
                { condition: "Explicit ollama/ prefix specified", target: "Requested model", provider: "ollama", color: "#34d399" },
                { condition: "Default (everything else)", target: "gemma3:4b", provider: "ollama", color: "#8b5cf6" },
              ].map((rule, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(45,45,75,0.4)",
                    fontSize: 13,
                  }}
                >
                  <Zap size={14} color={rule.color} style={{ flexShrink: 0 }} />
                  <span style={{ color: "rgba(148,163,184,0.8)", flex: 1 }}>
                    {rule.condition}
                  </span>
                  <span style={{ color: "white", fontWeight: 600, fontFamily: "monospace" }}>
                    {rule.target}
                  </span>
                  <span
                    style={{
                      background: `${rule.color}20`,
                      color: rule.color,
                      border: `1px solid ${rule.color}40`,
                      borderRadius: 6,
                      padding: "2px 8px",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    {rule.provider}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
