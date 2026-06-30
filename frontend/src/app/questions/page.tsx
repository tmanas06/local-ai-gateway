"use client";

import { useState, useEffect, useCallback } from "react";
import { api, RequestLogDoc } from "@/lib/api";
import {
  MessageSquare,
  Search,
  Calendar,
  Cpu,
  Clock,
  ChevronDown,
  ChevronUp,
  Globe,
  AlertCircle,
  Activity,
} from "lucide-react";

function formatDate(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
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

interface ChatSession {
  _id: string;
  timestamp: string;
  api_key_name: string;
  org: string;
  routed_model: string;
  provider: string;
  routing_reason: string;
  client_location?: { country: string; region: string; city: string };
  client_ip: string;
  success: boolean;
  error: string | null;
  status_code: number;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  response_preview: string;
  prompt_preview: string;
  messages: Array<{
    role: string;
    content: string;
    routed_model?: string;
    provider?: string;
    routing_reason?: string;
    latency_ms?: number;
    input_tokens?: number;
    output_tokens?: number;
    success?: boolean;
    error?: string | null;
    status_code?: number;
    timestamp?: string;
  }>;
  logs: RequestLogDoc[];
}

function groupLogsIntoSessions(logs: RequestLogDoc[]): ChatSession[] {
  if (!logs || logs.length === 0) return [];

  // Group logs by api_key_name + client_ip
  const groups: Record<string, RequestLogDoc[]> = {};
  for (const log of logs) {
    const key = `${log.api_key_name || "default"}_${log.client_ip || "unknown"}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(log);
  }

  const sessions: ChatSession[] = [];

  for (const key in groups) {
    // Sort chronologically (oldest first) to find conversations
    const sortedLogs = [...groups[key]].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let currentSessionLogs: RequestLogDoc[] = [];

    for (const log of sortedLogs) {
      if (currentSessionLogs.length === 0) {
        currentSessionLogs.push(log);
      } else {
        const lastLog = currentSessionLogs[currentSessionLogs.length - 1];
        const timeDiff = new Date(log.timestamp).getTime() - new Date(lastLog.timestamp).getTime();

        // Group requests occurring within 15 minutes of each other
        if (timeDiff < 15 * 60 * 1000) {
          currentSessionLogs.push(log);
        } else {
          sessions.push(createSessionFromLogs(currentSessionLogs));
          currentSessionLogs = [log];
        }
      }
    }

    if (currentSessionLogs.length > 0) {
      sessions.push(createSessionFromLogs(currentSessionLogs));
    }
  }

  // Sort sessions by latest activity timestamp (newest first)
  return sessions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

function createSessionFromLogs(sessionLogs: RequestLogDoc[]): ChatSession {
  const sorted = [...sessionLogs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  const latestLog = sorted[sorted.length - 1];
  const totalInputTokens = sorted.reduce((sum, l) => sum + (l.input_tokens || 0), 0);
  const totalOutputTokens = sorted.reduce((sum, l) => sum + (l.output_tokens || 0), 0);
  const totalLatency = sorted.reduce((sum, l) => sum + (l.latency_ms || 0), 0);

  const combinedMessages: ChatSession["messages"] = [];

  for (const log of sorted) {
    const logMsgs = log.messages || [];
    const msgsToProcess = logMsgs.length > 0
      ? logMsgs
      : [
          ...(log.prompt_preview ? [{ role: "user", content: log.prompt_preview }] : []),
          ...(log.response_preview ? [{ role: "assistant", content: log.response_preview }] : [])
        ];

    for (const msg of msgsToProcess) {
      const isSystem = msg.role === "system";
      
      if (isSystem) {
        const hasSystem = combinedMessages.some(m => m.role === "system");
        if (!hasSystem) {
          combinedMessages.push({
            role: msg.role,
            content: msg.content,
          });
        }
        continue;
      }

      // Simple deduplication for stateful clients
      const isDuplicate = combinedMessages.some(
        m => m.role === msg.role && m.content.trim() === msg.content.trim()
      );

      if (!isDuplicate) {
        combinedMessages.push({
          role: msg.role,
          content: msg.content,
          ...(msg.role === "assistant" ? {
            routed_model: log.routed_model,
            provider: log.provider,
            routing_reason: log.routing_reason,
            latency_ms: log.latency_ms,
            input_tokens: log.input_tokens,
            output_tokens: log.output_tokens,
            success: log.success,
            error: log.error,
            status_code: log.status_code,
            timestamp: log.timestamp,
          } : {})
        });
      }
    }
  }

  const userMsgs = combinedMessages.filter(m => m.role === "user");
  const lastUserMsg = userMsgs[userMsgs.length - 1]?.content || latestLog.prompt_preview || "(No text)";

  return {
    _id: latestLog._id,
    timestamp: latestLog.timestamp,
    api_key_name: latestLog.api_key_name,
    org: latestLog.org,
    routed_model: latestLog.routed_model,
    provider: latestLog.provider,
    routing_reason: latestLog.routing_reason,
    client_location: latestLog.client_location,
    client_ip: latestLog.client_ip,
    success: latestLog.success,
    error: latestLog.error,
    status_code: latestLog.status_code,
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    latency_ms: totalLatency,
    response_preview: latestLog.response_preview,
    prompt_preview: lastUserMsg,
    messages: combinedMessages,
    logs: sorted,
  };
}

export default function QuestionsPage() {
  const [data, setData] = useState<RequestLogDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const limit = 20;

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.requests({ skip, limit, search });
      setData(result.data);
      setTotal(result.total);
    } catch {
      // API or backend not running
    } finally {
      setLoading(false);
    }
  }, [skip, search]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSkip(0);
    setSearch(searchInput);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
            Questions Log
          </h1>
          <p style={{ color: "rgba(148,163,184,0.7)", fontSize: 14 }}>
            Browse and inspect prompt history, multi-turn message threads, and generated completions.
          </p>
        </div>
        <div style={{ fontSize: 13, color: "rgba(148,163,184,0.6)" }}>
          {total > 0 && <span>Total prompts: <strong>{total.toLocaleString()}</strong></span>}
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} style={{ marginBottom: 24 }}>
        <div style={{ position: "relative", display: "flex", gap: 12 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={18}
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                color: "rgba(148,163,184,0.5)",
              }}
            />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: 42, height: 44 }}
              placeholder="Search user questions, response contents, or API key names..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-accent" style={{ height: 44, padding: "0 24px" }}>
            Search
          </button>
        </div>
      </form>

      {/* Loading state */}
      {loading ? (
        <div className="glass" style={{ padding: 64, textAlign: "center", color: "rgba(148,163,184,0.5)", fontSize: 14 }}>
          Loading questions…
        </div>
      ) : data.length === 0 ? (
        <div
          className="glass"
          style={{
            padding: 64,
            textAlign: "center",
            color: "rgba(148,163,184,0.5)",
            fontSize: 14,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <MessageSquare size={32} color="rgba(148,163,184,0.3)" />
          {search ? "No questions match your query." : "No API queries recorded yet."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groupLogsIntoSessions(data).map((row) => {
            const isExpanded = !!expandedIds[row._id];
            
            // Locate client location representation
            const loc = row.client_location;
            const locationStr = loc?.city && loc?.country 
              ? `${loc.city}, ${loc.country}` 
              : "Local Network";

            const userMessages = row.messages.filter((m) => m.role === "user");
            const turnCount = userMessages.length;

            return (
              <div
                key={row._id}
                className="glass"
                style={{
                  padding: 20,
                  transition: "all 0.2s ease",
                  border: isExpanded ? "1px solid rgba(139,92,246,0.4)" : "1px solid rgba(45,45,75,0.4)",
                  background: isExpanded ? "rgba(22, 22, 38, 0.9)" : undefined,
                }}
              >
                {/* Card Header Metadata */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 12,
                    marginBottom: 14,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    {/* Timestamp */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(148,163,184,0.6)" }}>
                      <Calendar size={13} />
                      {formatDate(row.timestamp)}
                    </div>
                    {/* API Key info */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 700, color: "#f59e0b" }}>{row.api_key_name}</span>
                      <span
                        style={{
                          background: "rgba(139,92,246,0.1)",
                          color: "#a78bfa",
                          border: "1px solid rgba(139,92,246,0.2)",
                          borderRadius: 4,
                          padding: "1px 6px",
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        {row.org}
                      </span>
                    </div>
                    {/* Location Info */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(148,163,184,0.5)" }} title={`IP: ${row.client_ip}`}>
                      <Globe size={13} />
                      <span>{locationStr}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Token usage */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(148,163,184,0.7)" }}>
                      <span title="Prompt tokens" style={{ color: "#60a5fa" }}>{row.input_tokens} In</span>
                      <span>/</span>
                      <span title="Response tokens" style={{ color: "#a78bfa" }}>{row.output_tokens} Out</span>
                    </div>
                    {/* Latency */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 600, color: row.latency_ms > 2000 ? "#ef4444" : "#22c55e" }}>
                      <Clock size={13} />
                      {row.latency_ms}ms
                    </div>
                    {/* Provider badge */}
                    <ProviderBadge provider={row.provider} />
                    {/* Conversation Turn badge */}
                    <span
                      style={{
                        background: "rgba(245, 158, 11, 0.15)",
                        color: "#f59e0b",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        borderRadius: 6,
                        padding: "2px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {turnCount} {turnCount === 1 ? "turn" : "turns"}
                    </span>
                  </div>
                </div>

                {/* Prompt Question Display Block */}
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: "rgba(139,92,246,0.15)",
                      border: "1px solid rgba(139,92,246,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#a78bfa",
                      fontWeight: 700,
                      fontSize: 12,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    Q
                  </div>
                  <div style={{ flex: 1, color: "white", fontSize: 14, fontWeight: 500, lineHeight: 1.5, wordBreak: "break-word" }}>
                    {row.prompt_preview}
                  </div>
                </div>

                {/* Collapsible conversation logs */}
                {isExpanded ? (
                  <div
                    style={{
                      marginTop: 20,
                      paddingTop: 20,
                      borderTop: "1px solid rgba(45,45,75,0.6)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    {row.messages && row.messages.length > 0 ? (
                      row.messages.map((msg, index) => {
                        const isUser = msg.role === "user";
                        const isSystem = msg.role === "system";
                        
                        if (isSystem) {
                          return (
                            <div
                              key={index}
                              style={{
                                alignSelf: "center",
                                background: "rgba(255, 255, 255, 0.02)",
                                border: "1px dashed rgba(45,45,75,0.8)",
                                borderRadius: 8,
                                padding: "6px 14px",
                                fontSize: 11,
                                color: "rgba(148,163,184,0.6)",
                                fontFamily: "monospace",
                                maxWidth: "80%",
                                textAlign: "center",
                              }}
                            >
                              SYSTEM INSTRUCTION: {msg.content}
                            </div>
                          );
                        }

                        return (
                          <div
                            key={index}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignSelf: isUser ? "flex-end" : "flex-start",
                              maxWidth: "85%",
                              gap: 6,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                gap: 12,
                                flexDirection: isUser ? "row-reverse" : "row",
                              }}
                            >
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 6,
                                  background: isUser ? "rgba(139,92,246,0.2)" : "rgba(255, 255, 255, 0.04)",
                                  border: `1px solid ${isUser ? "rgba(139,92,246,0.4)" : "rgba(45,45,75,0.6)"}`,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: isUser ? "#a78bfa" : "#34d399",
                                  fontWeight: 700,
                                  fontSize: 11,
                                  flexShrink: 0,
                                }}
                              >
                                {isUser ? "U" : "A"}
                              </div>
                              <div
                                style={{
                                  background: isUser
                                    ? "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(109,40,217,0.1))"
                                    : "rgba(25, 25, 35, 0.8)",
                                  border: `1px solid ${isUser ? "rgba(139,92,246,0.25)" : "rgba(45,45,75,0.5)"}`,
                                  padding: "12px 16px",
                                  borderRadius: 12,
                                  borderTopRightRadius: isUser ? 2 : 12,
                                  borderTopLeftRadius: !isUser ? 2 : 12,
                                  fontSize: 13,
                                  color: "#f1f5f9",
                                  lineHeight: 1.6,
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                }}
                              >
                                {msg.content}
                              </div>
                            </div>

                            {/* Metadata below Assistant Bubble */}
                            {!isUser && !isSystem && msg.routed_model && (
                              <div
                                style={{
                                  marginLeft: 40,
                                  fontSize: 10,
                                  color: "rgba(148,163,184,0.5)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                <span style={{ color: "#a78bfa", fontWeight: 600 }}>{msg.routed_model}</span>
                                <span>•</span>
                                <span style={{ color: msg.latency_ms && msg.latency_ms > 2000 ? "#ef4444" : "#22c55e" }}>
                                  {msg.latency_ms}ms
                                </span>
                                <span>•</span>
                                <span>{msg.input_tokens} in / {msg.output_tokens} out</span>
                                {msg.routing_reason && (
                                  <>
                                    <span>•</span>
                                    <span style={{ fontStyle: "italic" }}>{msg.routing_reason}</span>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Individual turn error message */}
                            {!isUser && !isSystem && msg.success === false && msg.error && (
                              <div
                                style={{
                                  marginLeft: 40,
                                  background: "rgba(239,68,68,0.05)",
                                  border: "1px solid rgba(239,68,68,0.2)",
                                  borderRadius: 8,
                                  padding: "6px 10px",
                                  fontSize: 11,
                                  color: "#ef4444",
                                  marginTop: 4,
                                }}
                              >
                                <strong>Error:</strong> {msg.error} (Status: {msg.status_code})
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      /* Fallback to simple preview display */
                      <div style={{ display: "flex", gap: 12, alignSelf: "flex-start", maxWidth: "85%" }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(45,45,75,0.6)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#34d399",
                            fontWeight: 700,
                            fontSize: 11,
                            flexShrink: 0,
                          }}
                        >
                          A
                        </div>
                        <div
                          style={{
                            background: "rgba(25, 25, 35, 0.8)",
                            border: "1px solid rgba(45,45,75,0.5)",
                            padding: "12px 16px",
                            borderRadius: 12,
                            borderTopLeftRadius: 2,
                            fontSize: 13,
                            color: "#f1f5f9",
                            lineHeight: 1.6,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {row.response_preview || "(No assistant response preview recorded)"}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Answer Preview Mode when collapsed */
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      background: "rgba(0,0,0,0.1)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 12,
                      color: "rgba(148,163,184,0.7)",
                    }}
                  >
                    <span style={{ fontWeight: 700, color: "#34d399" }}>A:</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.response_preview || "(Empty or error response)"}
                    </span>
                  </div>
                )}

                {/* Bottom Toggle Control Row */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                  <button
                    onClick={() => toggleExpand(row._id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#a78bfa",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 8px",
                      borderRadius: 6,
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139,92,246,0.1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    {isExpanded ? (
                      <>
                        Collapse Conversation <ChevronUp size={14} />
                      </>
                    ) : (
                      <>
                        Inspect Conversation <ChevronDown size={14} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 24,
            color: "rgba(148,163,184,0.7)",
            fontSize: 13,
          }}
        >
          <span>
            Showing {skip + 1}–{Math.min(skip + limit, total)} of {total.toLocaleString()} prompts
          </span>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setSkip((s) => Math.max(0, s - limit))}
              disabled={skip === 0}
              className="btn-ghost"
              style={{
                opacity: skip === 0 ? 0.4 : 1,
                cursor: skip === 0 ? "not-allowed" : "pointer",
                padding: "8px 16px",
                fontSize: 13,
              }}
            >
              ← Previous
            </button>
            <button
              onClick={() => setSkip((s) => s + limit)}
              disabled={skip + limit >= total}
              className="btn-ghost"
              style={{
                opacity: skip + limit >= total ? 0.4 : 1,
                cursor: skip + limit >= total ? "not-allowed" : "pointer",
                padding: "8px 16px",
                fontSize: 13,
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
