import { api, RequestLogDoc } from "@/lib/api";
import { CheckCircle, XCircle, Zap } from "lucide-react";

function formatDate(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ProviderBadge({ provider }: { provider: string }) {
  const colors: Record<string, [string, string]> = {
    ollama: ["#a78bfa", "rgba(139,92,246,0.15)"],
    openai: ["#34d399", "rgba(52,211,153,0.15)"],
    groq: ["#f59e0b", "rgba(245,158,11,0.15)"],
  };
  const [color, bg] = colors[provider] ?? ["#94a3b8", "rgba(148,163,184,0.1)"];
  return (
    <span
      style={{
        background: bg,
        color,
        border: `1px solid ${color}40`,
        borderRadius: 6,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {provider}
    </span>
  );
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const skip = parseInt(params.skip ?? "0");
  const limit = 50;

  let result = null;
  try {
    result = await api.requests({ skip, limit });
  } catch {
    // Gateway not running
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            marginBottom: 6,
          }}
        >
          Request Log
        </h1>
        <p style={{ color: "rgba(148,163,184,0.7)", fontSize: 14 }}>
          Every request routed through the gateway
          {result ? ` · ${result.total.toLocaleString()} total` : ""}
        </p>
      </div>

      <div className="glass" style={{ overflow: "hidden" }}>
        {!result ? (
          <div
            style={{
              padding: 48,
              textAlign: "center",
              color: "rgba(148,163,184,0.5)",
              fontSize: 14,
            }}
          >
            Gateway not reachable. Start the backend to see request logs.
          </div>
        ) : result.data.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: "center",
              color: "rgba(148,163,184,0.5)",
              fontSize: 14,
            }}
          >
            No requests yet. Send your first request to{" "}
            <code style={{ color: "#a78bfa" }}>POST /v1/chat/completions</code>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Key</th>
                  <th>Model</th>
                  <th>Provider</th>
                  <th>Tokens In</th>
                  <th>Tokens Out</th>
                  <th>Latency</th>
                  <th>Status</th>
                  <th>Routing</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((row: RequestLogDoc) => (
                  <tr key={row._id}>
                    <td
                      style={{
                        fontSize: 12,
                        color: "rgba(148,163,184,0.7)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(row.timestamp)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {row.api_key_name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(148,163,184,0.5)",
                        }}
                      >
                        {row.org}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {row.routed_model.split(":")[0]}
                      </div>
                      {row.requested_model !== row.routed_model && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "rgba(245,158,11,0.7)",
                          }}
                        >
                          req: {row.requested_model}
                        </div>
                      )}
                    </td>
                    <td>
                      <ProviderBadge provider={row.provider} />
                    </td>
                    <td
                      style={{
                        color: "#60a5fa",
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {row.input_tokens}
                    </td>
                    <td
                      style={{
                        color: "#a78bfa",
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {row.output_tokens}
                    </td>
                    <td
                      style={{
                        fontVariantNumeric: "tabular-nums",
                        color:
                          row.latency_ms > 2000
                            ? "#ef4444"
                            : row.latency_ms > 800
                            ? "#f59e0b"
                            : "#22c55e",
                        fontWeight: 600,
                      }}
                    >
                      {row.latency_ms}ms
                    </td>
                    <td>
                      {row.success ? (
                        <span className="badge-success">
                          <CheckCircle size={10} />
                          200
                        </span>
                      ) : (
                        <span className="badge-error">
                          <XCircle size={10} />
                          {row.status_code}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        fontSize: 11,
                        color: "rgba(148,163,184,0.5)",
                        maxWidth: 160,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={row.routing_reason}
                    >
                      {row.routing_reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {result && result.total > limit && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 16,
            color: "rgba(148,163,184,0.7)",
            fontSize: 13,
          }}
        >
          <span>
            {skip + 1}–{Math.min(skip + limit, result.total)} of{" "}
            {result.total.toLocaleString()}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            {skip > 0 && (
              <a
                href={`/requests?skip=${Math.max(0, skip - limit)}`}
                className="btn-ghost"
                style={{ textDecoration: "none", padding: "8px 16px", fontSize: 13 }}
              >
                ← Previous
              </a>
            )}
            {skip + limit < result.total && (
              <a
                href={`/requests?skip=${skip + limit}`}
                className="btn-ghost"
                style={{ textDecoration: "none", padding: "8px 16px", fontSize: 13 }}
              >
                Next →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
