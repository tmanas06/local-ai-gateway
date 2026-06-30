"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  List,
  Cpu,
  Key,
  Zap,
  HelpCircle,
} from "lucide-react";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/requests", label: "Requests", icon: List },
  { href: "/questions", label: "Questions", icon: HelpCircle },
  { href: "/models", label: "Models", icon: Cpu },
  { href: "/keys", label: "API Keys", icon: Key },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 240,
        minHeight: "100vh",
        background: "rgba(15,15,25,0.95)",
        borderRight: "1px solid rgba(45,45,75,0.5)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 0",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ padding: "0 20px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 20px rgba(139,92,246,0.4)",
            }}
          >
            <Zap size={18} color="white" fill="white" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>
              AI Gateway
            </div>
            <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", marginTop: 1 }}>
              v1.0.0
            </div>
          </div>
        </div>
      </div>

      {/* Nav label */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(148,163,184,0.5)",
          padding: "0 20px 10px",
        }}
      >
        Navigation
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: "0 10px" }}>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} style={{ textDecoration: "none" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 12px",
                  borderRadius: 10,
                  marginBottom: 4,
                  color: active ? "white" : "rgba(148,163,184,0.8)",
                  background: active
                    ? "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(109,40,217,0.1))"
                    : "transparent",
                  border: active
                    ? "1px solid rgba(139,92,246,0.3)"
                    : "1px solid transparent",
                  fontWeight: active ? 600 : 500,
                  fontSize: 14,
                  transition: "all 0.15s ease",
                  cursor: "pointer",
                }}
              >
                <Icon size={17} color={active ? "#a78bfa" : undefined} />
                {label}
                {active && (
                  <div
                    style={{
                      marginLeft: "auto",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#a78bfa",
                      boxShadow: "0 0 8px rgba(167,139,250,0.8)",
                    }}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: "1px solid rgba(45,45,75,0.4)",
          fontSize: 12,
          color: "rgba(148,163,184,0.5)",
        }}
      >
        <div>Self-hosted · Local inference</div>
        <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <div
            className="pulse-dot"
            style={{ background: "#22c55e", flexShrink: 0 }}
          />
          Gateway running
        </div>
      </div>
    </aside>
  );
}
