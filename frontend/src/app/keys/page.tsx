"use client";

import { useState, useEffect } from "react";
import { api, APIKey, APIKeyCreated } from "@/lib/api";
import { Key, Plus, Trash2, Copy, Eye, EyeOff, CheckCircle } from "lucide-react";

function formatDate(ts: string | null) {
  if (!ts) return "Never";
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function KeysPage() {
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<APIKeyCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", org: "default", rate_limit_rpm: 60 });

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    try {
      const data = await api.keys();
      setKeys(data);
    } catch {
      // Gateway not running
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const created = await api.createKey(form);
      setNewKey(created);
      setShowForm(false);
      setForm({ name: "", org: "default", rate_limit_rpm: 60 });
      await loadKeys();
    } catch (e) {
      alert("Failed to create key. Is the gateway running?");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string, name: string) {
    if (!confirm(`Revoke key "${name}"? This cannot be undone.`)) return;
    try {
      await api.revokeKey(id);
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revoked: true } : k)));
    } catch {
      alert("Failed to revoke key.");
    }
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 28,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
            API Keys
          </h1>
          <p style={{ color: "rgba(148,163,184,0.7)", fontSize: 14 }}>
            Manage access credentials for your AI Gateway
          </p>
        </div>
        <button className="btn-accent" onClick={() => setShowForm((s) => !s)}>
          <Plus size={14} style={{ display: "inline", marginRight: 6 }} />
          Create Key
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div
          className="glass fade-in"
          style={{ padding: 24, marginBottom: 20 }}
        >
          <div
            style={{ fontSize: 14, fontWeight: 700, marginBottom: 20, color: "rgba(241,245,249,0.9)" }}
          >
            New API Key
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto auto",
              gap: 12,
              alignItems: "end",
            }}
          >
            <div>
              <label style={{ fontSize: 12, color: "rgba(148,163,184,0.7)", display: "block", marginBottom: 6, fontWeight: 600 }}>
                Key Name
              </label>
              <input
                className="input"
                placeholder="e.g. production-key"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "rgba(148,163,184,0.7)", display: "block", marginBottom: 6, fontWeight: 600 }}>
                Organization
              </label>
              <input
                className="input"
                placeholder="e.g. acme-corp"
                value={form.org}
                onChange={(e) => setForm({ ...form, org: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "rgba(148,163,184,0.7)", display: "block", marginBottom: 6, fontWeight: 600 }}>
                RPM Limit
              </label>
              <input
                className="input"
                type="number"
                style={{ width: 100 }}
                value={form.rate_limit_rpm}
                onChange={(e) => setForm({ ...form, rate_limit_rpm: parseInt(e.target.value) })}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-accent" onClick={handleCreate} disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </button>
              <button className="btn-ghost" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New key reveal */}
      {newKey && (
        <div
          className="glass fade-in"
          style={{
            padding: 20,
            marginBottom: 20,
            borderColor: "rgba(34,197,94,0.3)",
            background: "rgba(34,197,94,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
              color: "#22c55e",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            <CheckCircle size={16} />
            Key created — copy it now, it won&apos;t be shown again
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(0,0,0,0.3)",
              borderRadius: 10,
              padding: "12px 16px",
              fontFamily: "monospace",
              fontSize: 13,
              color: "#a78bfa",
              border: "1px solid rgba(139,92,246,0.2)",
            }}
          >
            <span style={{ flex: 1, wordBreak: "break-all" }}>{newKey.raw_key}</span>
            <button
              className="btn-ghost"
              onClick={() => copyKey(newKey.raw_key)}
              style={{ padding: "6px 12px", flexShrink: 0 }}
            >
              {copied ? <CheckCircle size={14} color="#22c55e" /> : <Copy size={14} />}
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(148,163,184,0.5)",
              cursor: "pointer",
              fontSize: 12,
              marginTop: 10,
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Keys table */}
      <div className="glass" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "rgba(148,163,184,0.5)", fontSize: 14 }}>
            Loading…
          </div>
        ) : keys.length === 0 ? (
          <div
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
            <Key size={32} color="rgba(148,163,184,0.3)" />
            No API keys yet. Create one to start using the gateway.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Organization</th>
                <th>Key</th>
                <th>RPM Limit</th>
                <th>Created</th>
                <th>Last Used</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td style={{ fontWeight: 700 }}>{k.name}</td>
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
                      {k.org}
                    </span>
                  </td>
                  <td>
                    <code
                      style={{
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "rgba(148,163,184,0.7)",
                        background: "rgba(0,0,0,0.2)",
                        padding: "3px 8px",
                        borderRadius: 6,
                      }}
                    >
                      {k.key_prefix}
                    </code>
                  </td>
                  <td style={{ color: "#60a5fa", fontWeight: 600 }}>
                    {k.rate_limit_rpm}/min
                  </td>
                  <td style={{ color: "rgba(148,163,184,0.7)", fontSize: 13 }}>
                    {formatDate(k.created_at)}
                  </td>
                  <td style={{ color: "rgba(148,163,184,0.7)", fontSize: 13 }}>
                    {formatDate(k.last_used_at)}
                  </td>
                  <td>
                    {k.revoked ? (
                      <span className="badge-error">Revoked</span>
                    ) : (
                      <span className="badge-success">Active</span>
                    )}
                  </td>
                  <td>
                    {!k.revoked && (
                      <button
                        onClick={() => handleRevoke(k.id, k.name)}
                        style={{
                          background: "rgba(239,68,68,0.1)",
                          border: "1px solid rgba(239,68,68,0.3)",
                          color: "#ef4444",
                          borderRadius: 8,
                          padding: "6px 10px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          transition: "all 0.15s",
                        }}
                      >
                        <Trash2 size={12} />
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Usage hint */}
      <div
        className="glass"
        style={{ padding: 20, marginTop: 20, borderColor: "rgba(45,45,75,0.4)" }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "rgba(241,245,249,0.8)" }}>
          How to use your API key
        </div>
        <pre
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            color: "#a78bfa",
            background: "rgba(0,0,0,0.3)",
            padding: 16,
            borderRadius: 10,
            overflowX: "auto",
            border: "1px solid rgba(139,92,246,0.2)",
            lineHeight: 1.6,
          }}
        >{`curl http://localhost:8000/v1/chat/completions \\
  -H "Authorization: Bearer aigw_your-key-here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gemma3:4b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}</pre>
      </div>
    </div>
  );
}
