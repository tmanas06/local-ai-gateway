"use client";

import { ReactNode } from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  accent?: string;
  trend?: "up" | "down" | "neutral";
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  accent = "#8b5cf6",
  trend,
}: StatsCardProps) {
  return (
    <div
      className="glass fade-in"
      style={{
        padding: "24px",
        position: "relative",
        overflow: "hidden",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 30px rgba(0,0,0,0.3), 0 0 30px ${accent}22`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "";
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(148,163,184,0.8)",
              marginBottom: 10,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: "white",
            }}
          >
            {value}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 12,
                color: "rgba(148,163,184,0.6)",
                marginTop: 6,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${accent}30, ${accent}15)`,
            border: `1px solid ${accent}40`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: accent,
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
