const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || "change-me-admin-token";

const headers = () => ({
  "Content-Type": "application/json",
  "x-admin-token": ADMIN_TOKEN,
});

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...options?.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export const api = {
  overview: () => apiFetch<Overview>("/admin/stats/overview"),
  timeseries: (hours = 24) =>
    apiFetch<TimeseriesPoint[]>(`/admin/stats/timeseries?hours=${hours}`),
  models: () => apiFetch<ModelStat[]>("/admin/stats/models"),
  topUsers: (limit = 10) =>
    apiFetch<TopUser[]>(`/admin/stats/top-users?limit=${limit}`),
  modelBreakdown: () => apiFetch<ModelBreakdown[]>("/admin/stats/models"),
  requests: (params?: {
    skip?: number;
    limit?: number;
    model?: string;
    success?: boolean;
    search?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.skip != null) qs.set("skip", String(params.skip));
    if (params?.limit != null) qs.set("limit", String(params.limit));
    if (params?.model) qs.set("model", params.model);
    if (params?.success != null) qs.set("success", String(params.success));
    if (params?.search) qs.set("search", params.search);
    return apiFetch<RequestLogPage>(`/admin/requests?${qs}`);
  },
  keys: () => apiFetch<APIKey[]>("/admin/keys"),
  createKey: (body: { name: string; org: string; rate_limit_rpm: number }) =>
    apiFetch<APIKeyCreated>("/admin/keys", {
      method: "POST",
      body: JSON.stringify(body),
    }),
   revokeKey: (id: string) =>
     apiFetch(`/admin/keys/${id}`, { method: "DELETE" }),
   providers: () => apiFetch<ProviderHealth[]>("/admin/models"),
   systemStats: () => apiFetch<SystemStats>("/admin/system/stats"),
 };

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Overview {
  requests_today: number;
  requests_this_week: number;
  avg_latency_ms: number;
  p95_latency_ms: number | null;
  input_tokens_today: number;
  output_tokens_today: number;
  error_rate_pct: number;
  active_keys_today: number;
  top_model: string | null;
}

export interface TimeseriesPoint {
  timestamp: string;
  requests: number;
  errors: number;
  avg_latency_ms: number;
}

export interface ModelStat {
  provider: string;
  models: string[];
  available: boolean;
}

export interface ModelBreakdown {
  model: string;
  provider: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  avg_latency_ms: number;
  error_rate_pct: number;
}

export interface TopUser {
  api_key_name: string;
  org: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
}

export interface RequestLogDoc {
  _id: string;
  timestamp: string;
  api_key_name: string;
  org: string;
  requested_model: string;
  routed_model: string;
  provider: string;
  routing_reason: string;
  prompt_preview: string;
  response_preview: string;
  messages?: Array<{ role: string; content: string }>;
  client_location?: { country: string; region: string; city: string };
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  success: boolean;
  error: string | null;
  status_code: number;
  client_ip: string;
  stream: boolean;
}

export interface RequestLogPage {
  total: number;
  skip: number;
  limit: number;
  data: RequestLogDoc[];
}

export interface APIKey {
  id: string;
  name: string;
  org: string;
  key_prefix: string;
  rate_limit_rpm: number;
  created_at: string;
  last_used_at: string | null;
  revoked: boolean;
}

export interface APIKeyCreated extends APIKey {
  raw_key: string;
}

export interface LocalModel {
  name: string;
  size: number;
  family: string;
  quantization: string;
  parameter_size: string;
  loaded: boolean;
}

export interface ProviderHealth {
  provider: string;
  models: LocalModel[];
  available: boolean;
}

export interface SystemStats {
  os: string;
  cpu_pct: number;
  cpu_cores: number;
  ram_total_gb: number;
  ram_used_gb: number;
  ram_pct: number;
  ollama_status: string;
  ollama_url: string;
}
