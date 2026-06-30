"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { TimeseriesPoint, ModelBreakdown } from "@/lib/api";

function formatTime(ts: string) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(15,15,25,0.95)",
        border: "1px solid rgba(45,45,75,0.8)",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 13,
      }}
    >
      <div style={{ color: "rgba(148,163,184,0.8)", marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div
          key={p.name}
          style={{ color: p.color, fontWeight: 600, marginBottom: 2 }}
        >
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
};

export function RequestsChart({ data }: { data: TimeseriesPoint[] }) {
  const chartData = data.map((p) => ({
    time: formatTime(p.timestamp),
    Requests: p.requests,
    Errors: p.errors,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,45,75,0.4)" />
        <XAxis
          dataKey="time"
          tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="Requests"
          stroke="#8b5cf6"
          strokeWidth={2}
          fill="url(#reqGrad)"
        />
        <Area
          type="monotone"
          dataKey="Errors"
          stroke="#ef4444"
          strokeWidth={2}
          fill="url(#errGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ModelsBarChart({ data }: { data: ModelBreakdown[] }) {
  const chartData = data.slice(0, 8).map((m) => ({
    model: m.model.split(":")[0],
    Requests: m.requests,
    "Avg Latency (ms)": m.avg_latency_ms,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,45,75,0.4)" />
        <XAxis
          dataKey="model"
          tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "rgba(148,163,184,0.8)" }}
        />
        <Bar dataKey="Requests" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
