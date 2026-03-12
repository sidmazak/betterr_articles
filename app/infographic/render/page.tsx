"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  CheckCircle2,
  BarChart3,
  PieChart as PieChartIcon,
  ListChecks,
  Image,
  Table2,
  AlertTriangle,
  Gauge,
  Eye,
  XCircle,
  Hash,
  MinusCircle,
  Car,
  Shield,
  Clock,
  FileText,
  TrendingUp,
  Percent,
  Info,
  Cloud,
  Droplets,
  Package,
  Scale,
  Zap,
  Lightbulb,
  ArrowRight,
  Plus,
  Equal,
  type LucideIcon,
} from "lucide-react";
import type {
  InfographicSpec,
  InfographicSection,
  InfographicIconHint,
  InfographicCategory,
  InfographicItem,
} from "@/lib/infographic-extractor";

const INF_WIDTH = 800;
const INF_MIN_HEIGHT = 500;

const COLORS = [
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
];

/** Semantic colors: critical=fail/danger, standard=deduction, info=neutral, success=approved */
const SEMANTIC_COLORS: Record<InfographicCategory, string> = {
  critical: "#ef4444",
  standard: "#f59e0b",
  info: "#06b6d4",
  success: "#10b981",
};

const ICON_MAP: Record<InfographicIconHint, LucideIcon> = {
  "alert-triangle": AlertTriangle,
  gauge: Gauge,
  eye: Eye,
  "x-circle": XCircle,
  hash: Hash,
  "minus-circle": MinusCircle,
  "check-circle": CheckCircle2,
  car: Car,
  shield: Shield,
  clock: Clock,
  "list-checks": ListChecks,
  "file-text": FileText,
  "trending-up": TrendingUp,
  percent: Percent,
  info: Info,
  cloud: Cloud,
  droplets: Droplets,
  package: Package,
  scale: Scale,
  zap: Zap,
  lightbulb: Lightbulb,
};

const BACKGROUND_VARIANTS = [
  "linear-gradient(180deg, #0c1222 0%, #1a2744 40%, #0f172a 100%)",
  "linear-gradient(180deg, #0f172a 0%, #1e3a5f 50%, #0c1222 100%)",
  "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1a2744 100%)",
];

function getHeaderIcon(chartType: string) {
  switch (chartType) {
    case "bar":
      return BarChart3;
    case "pie":
      return PieChartIcon;
    case "comparison":
      return Table2;
    case "list":
      return ListChecks;
    default:
      return Image;
  }
}

function getBackgroundVariant(chartType: string): string {
  const idx = ["bar", "pie", "comparison", "list"].indexOf(chartType);
  return BACKGROUND_VARIANTS[idx >= 0 ? idx % BACKGROUND_VARIANTS.length : 0];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Resolve icon from hint or infer from label/value text */
function resolveIcon(
  hint: InfographicIconHint | undefined,
  label: string,
  value: string | number | undefined
): LucideIcon {
  if (hint && ICON_MAP[hint]) return ICON_MAP[hint];
  const text = `${label} ${value ?? ""}`.toLowerCase();
  if (/\bfail|instant|critical|danger\b/.test(text)) return XCircle;
  if (/\bspeed|mph|kmh\b/.test(text)) return Gauge;
  if (/\bmirror|look|scan|check\b/.test(text)) return Eye;
  if (/\bpoint|pts?|deduction\b/.test(text)) return Hash;
  if (/\bcomment|required\b/.test(text)) return FileText;
  if (/\bwarning|caution\b/.test(text)) return AlertTriangle;
  if (/\bsalt|air|humidity|weather\b/.test(text)) return Cloud;
  if (/\bcorrosion|rust|moisture\b/.test(text)) return Droplets;
  if (/\bload|cargo|weight|package\b/.test(text)) return Package;
  if (/\batm|mass|scale|balance\b/.test(text)) return Scale;
  if (/\bbrake|electrical|power\b/.test(text)) return Zap;
  if (/\blight|led|lighting\b/.test(text)) return Lightbulb;
  return CheckCircle2;
}

/** Resolve color from category or infer from value text */
function resolveColor(
  category: InfographicCategory | undefined,
  value: string | number | undefined,
  index: number
): string {
  if (category && SEMANTIC_COLORS[category]) return SEMANTIC_COLORS[category];
  const text = String(value ?? "").toLowerCase();
  if (/\binstant fail|fail\b/.test(text)) return SEMANTIC_COLORS.critical;
  if (/\b-\d+\s*pt|deduction\b/.test(text)) return SEMANTIC_COLORS.standard;
  if (/\bsafe|approved|required|compliant\b/.test(text)) return SEMANTIC_COLORS.success;
  return COLORS[index % COLORS.length];
}

function renderSectionBlock(
  section: InfographicSection,
  resolveIcon: (hint: InfographicIconHint | undefined, label: string, value: string | number | undefined) => LucideIcon,
  resolveColor: (category: InfographicCategory | undefined, value: string | number | undefined, index: number) => string
) {
  const fontFamily = "var(--font-sora), var(--font-plus-jakarta-sans), system-ui, sans-serif";

  switch (section.type) {
    case "heading": {
      if (!section.title) return null;
      return (
        <div key={section.title} style={{ padding: "24px 32px 8px", fontFamily }}>
          <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
            {escapeHtml(section.title)}
          </h4>
        </div>
      );
    }
    case "description": {
      if (!section.content) return null;
      return (
        <div key={section.content.slice(0, 20)} style={{ padding: "8px 32px 16px", fontFamily }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#94a3b8" }}>{escapeHtml(section.content)}</p>
        </div>
      );
    }
    case "flow": {
      const flow = section.flow ?? [];
      if (flow.length === 0) return null;
      return (
        <div key="flow" style={{ padding: "16px 32px", fontFamily, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          {flow.map((item, i) => {
            if (item === "arrow") {
              return (
                <ArrowRight key={i} size={20} color="#64748b" style={{ flexShrink: 0 }} />
              );
            }
            const it = item as InfographicItem;
            const Icon = resolveIcon(it.icon, it.label, it.value);
            const color = resolveColor(it.category, it.value, i);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: `${color}18`, borderRadius: 10, border: `1px solid ${color}44` }}>
                <Icon size={20} color={color} />
                <span style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 14 }}>{it.label}</span>
              </div>
            );
          })}
        </div>
      );
    }
    case "equation": {
      const eq = section.equation ?? [];
      if (eq.length === 0) return null;
      return (
        <div key="equation" style={{ padding: "16px 32px", fontFamily, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          {eq.map((item, i) => {
            if (item === "plus") {
              return <span key={i} style={{ fontSize: 16, color: "#64748b", fontWeight: 700 }}>+</span>;
            }
            if (item === "equals") {
              return <span key={i} style={{ fontSize: 16, color: "#64748b", fontWeight: 700 }}>=</span>;
            }
            const it = item as InfographicItem;
            const Icon = resolveIcon(it.icon, it.label, it.value);
            const color = resolveColor(it.category, it.value, i);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", background: `${color}18`, borderRadius: 12, border: `1px solid ${color}44` }}>
                <Icon size={22} color={color} />
                <span style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 14 }}>{it.label}</span>
              </div>
            );
          })}
        </div>
      );
    }
    case "comparison-pair": {
      const pair = section.pair;
      if (!pair) return null;
      const GoodIcon = resolveIcon(pair.good.icon, pair.good.label, pair.good.value);
      const BadIcon = resolveIcon(pair.bad.icon, pair.bad.label, pair.bad.value);
      const goodColor = resolveColor(pair.good.category, pair.good.value, 0);
      const badColor = resolveColor(pair.bad.category, pair.bad.value, 1);
      return (
        <div key="pair" style={{ padding: "16px 32px", fontFamily, display: "flex", gap: 12 }}>
          <div style={{ flex: 1, padding: 16, background: `${goodColor}15`, borderRadius: 12, border: `1px solid ${goodColor}44`, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <GoodIcon size={24} color={goodColor} />
              <span style={{ fontWeight: 700, color: goodColor, fontSize: 15 }}>{pair.good.label}</span>
            </div>
            {pair.good.value != null && <span style={{ fontSize: 13, color: "#94a3b8" }}>{String(pair.good.value)}</span>}
          </div>
          <div style={{ flex: 1, padding: 16, background: `${badColor}15`, borderRadius: 12, border: `1px solid ${badColor}44`, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <BadIcon size={24} color={badColor} />
              <span style={{ fontWeight: 700, color: badColor, fontSize: 15 }}>{pair.bad.label}</span>
            </div>
            {pair.bad.value != null && <span style={{ fontSize: 13, color: "#94a3b8" }}>{String(pair.bad.value)}</span>}
          </div>
        </div>
      );
    }
    case "status": {
      const st = section.status;
      if (!st) return null;
      const color = st.category ? SEMANTIC_COLORS[st.category] : COLORS[0];
      return (
        <div key="status" style={{ padding: "16px 32px", fontFamily, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {section.title && <span style={{ fontSize: 14, color: "#94a3b8" }}>{section.title}</span>}
          <span style={{ padding: "6px 14px", borderRadius: 8, background: `${color}22`, border: `1px solid ${color}44`, fontWeight: 700, color, fontSize: 13 }}>
            {st.label}: {st.value}
          </span>
        </div>
      );
    }
    case "list": {
      const items = section.items ?? [];
      if (items.length === 0) return null;
      return (
        <div key="list" style={{ padding: "16px 32px", fontFamily }}>
          {section.title && <h5 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{section.title}</h5>}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {items.map((item, i) => {
              const Icon = resolveIcon(item.icon, item.label, item.value);
              const color = resolveColor(item.category, item.value, i);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < items.length - 1 ? "1px solid rgba(148,163,184,0.1)" : "none" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}22`, border: `1px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={16} color={color} />
                  </div>
                  <span style={{ fontWeight: 500, color: "#e2e8f0", fontSize: 14 }}>{item.label}</span>
                  {item.value != null && <span style={{ marginLeft: 8, color: "#94a3b8", fontSize: 13 }}>{String(item.value)}</span>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    case "comparison": {
      const rows = section.rows ?? [];
      if (rows.length === 0) return null;
      return (
        <div key="comparison" style={{ padding: "16px 32px", fontFamily }}>
          {section.title && <h5 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{section.title}</h5>}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {rows.map((row, i) => {
              const accentColor = row[0]?.category ? SEMANTIC_COLORS[row[0].category] : COLORS[i % COLORS.length];
              return (
                <div key={i} style={{ display: "flex", alignItems: "stretch", padding: "12px 0", borderBottom: i < rows.length - 1 ? "1px solid rgba(148,163,184,0.12)" : "none", gap: 16 }}>
                  <div style={{ width: 4, borderRadius: 2, background: accentColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: "12px 20px", alignItems: "center" }}>
                    {row.map((c, j) => {
                      const Icon = resolveIcon(c.icon, c.label, c.value);
                      const color = resolveColor(c.category, c.value, i);
                      return (
                        <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                          <Icon size={16} color={color} />
                          <span style={{ color: "#94a3b8" }}>{c.label}</span>
                          <span style={{ fontWeight: 600, color }}>{String(c.value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    case "bar": {
      const labels = section.labels ?? [];
      const values = section.values ?? [];
      const data = labels.map((l, i) => ({ name: l, value: values[i] ?? 0 }));
      if (data.length === 0) return null;
      return (
        <div key="bar" style={{ padding: "16px 24px", fontFamily }}>
          {section.title && <h5 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{section.title}</h5>}
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tick={{ fill: "#94a3b8" }} />
              <YAxis stroke="#94a3b8" fontSize={11} tick={{ fill: "#94a3b8" }} />
              <Bar dataKey="value" fill={COLORS[0]} radius={[4, 4, 0, 0]} name="" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case "pie": {
      const labels = section.labels ?? [];
      const values = section.values ?? [];
      const data = labels.map((l, i) => ({ name: l, value: values[i] ?? 0 }));
      if (data.length === 0) return null;
      return (
        <div key="pie" style={{ padding: "16px 24px", fontFamily }}>
          {section.title && <h5 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{section.title}</h5>}
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={{ stroke: "#94a3b8" }}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend layout="horizontal" align="center" wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span style={{ color: "#e2e8f0" }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }
    default:
      return null;
  }
}

function InfographicChart({ spec }: { spec: InfographicSpec }) {
  const useSections = Boolean(spec.sections && spec.sections.length > 0);

  const sectionContent = useMemo(() => {
    if (!useSections || !spec.sections) return null;
    return spec.sections.map((section, i) => (
      <div key={i}>{renderSectionBlock(section, resolveIcon, resolveColor)}</div>
    ));
  }, [useSections, spec.sections]);

  const legacyContent = useMemo(() => {
    if (useSections) return null;
    if (!spec.chartType || !spec.data) return null;
    switch (spec.chartType) {
      case "bar": {
        const { labels = [], values = [] } = spec.data;
        const data = labels.map((label, i) => ({
          name: label,
          value: values[i] ?? 0,
        }));
        return (
          <div
            style={{
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              fontFamily: "var(--font-sora), var(--font-plus-jakarta-sans), system-ui, sans-serif",
            }}
          >
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={data} margin={{ top: 16, right: 24, left: 24, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tick={{ fill: "#94a3b8" }} />
                <YAxis stroke="#94a3b8" fontSize={12} tick={{ fill: "#94a3b8" }} />
                <Bar dataKey="value" fill={COLORS[0]} radius={[4, 4, 0, 0]} name="" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }
      case "pie": {
        const { labels = [], values = [] } = spec.data;
        const data = labels.map((label, i) => ({
          name: label,
          value: values[i] ?? 0,
        }));
        return (
          <div
            style={{
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              fontFamily: "var(--font-sora), var(--font-plus-jakarta-sans), system-ui, sans-serif",
            }}
          >
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={{ stroke: "#94a3b8" }}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend layout="horizontal" align="center" wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span style={{ color: "#e2e8f0" }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      }
      case "comparison": {
        const { rows = [] } = spec.data;
        return (
          <div
            style={{
              padding: "28px 32px",
              fontFamily: "var(--font-sora), var(--font-plus-jakarta-sans), system-ui, sans-serif",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {rows.map((row, i) => {
                const rowCategory = row[0]?.category;
                const accentColor = rowCategory ? SEMANTIC_COLORS[rowCategory] : COLORS[i % COLORS.length];
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "stretch",
                      borderBottom: i < rows.length - 1 ? "1px solid rgba(148,163,184,0.12)" : "none",
                      padding: "14px 0",
                      gap: 20,
                      background: i % 2 === 1 ? "rgba(255,255,255,0.02)" : "transparent",
                    }}
                  >
                    <div
                      style={{
                        width: 4,
                        borderRadius: 2,
                        background: accentColor,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: "12px 24px", alignItems: "center" }}>
                      {row.map((c, j) => {
                        const Icon = resolveIcon(c.icon, c.label, c.value);
                        const color = resolveColor(c.category, c.value, i);
                        return (
                          <div
                            key={j}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              fontSize: 14,
                            }}
                          >
                            <Icon size={18} color={color} style={{ flexShrink: 0, opacity: 0.9 }} />
                            <span style={{ color: "#94a3b8" }}>{c.label}</span>
                            <span style={{ fontWeight: 600, color, minWidth: 0 }}>{String(c.value)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
      default: {
        const items = spec.data.items ?? spec.data.labels?.map((l) => ({ label: l })) ?? [];
        return (
          <div
            style={{
              padding: "28px 32px",
              fontFamily: "var(--font-sora), var(--font-plus-jakarta-sans), system-ui, sans-serif",
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            {items.map((item, i) => {
              const val =
                "value" in item
                  ? (item as { value?: string | number }).value
                  : "detail" in item
                    ? (item as { detail?: string | number }).detail
                    : undefined;
              const iconHint = "icon" in item ? (item as { icon?: InfographicIconHint }).icon : undefined;
              const categoryHint = "category" in item ? (item as { category?: InfographicCategory }).category : undefined;
              const Icon = resolveIcon(iconHint, item.label, val);
              const color = resolveColor(categoryHint, val, i);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                    padding: "14px 0",
                    borderBottom: i < items.length - 1 ? "1px solid rgba(148,163,184,0.12)" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: `${color}22`,
                      border: `1px solid ${color}44`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={18} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 15 }}>{item.label}</span>
                    {val != null && (
                      <span style={{ marginLeft: 10, color: "#94a3b8", fontSize: 14 }}>{String(val)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
    }
  }, [useSections, spec]);

  const chartType = spec.chartType ?? "list";
  const HeaderIcon = getHeaderIcon(chartType);
  const chartTypeIdx = ["bar", "pie", "comparison", "list"].indexOf(chartType);
  const headerIconColor = chartTypeIdx >= 0 ? COLORS[chartTypeIdx % COLORS.length] : COLORS[0];
  const content = useSections ? sectionContent : legacyContent;

  return (
    <figure
      style={{
        margin: 0,
        width: INF_WIDTH,
        height: "fit-content",
        overflow: "visible",
        borderRadius: 16,
        background: getBackgroundVariant(spec.chartType ?? "list"),
        color: "#fff",
        border: "1px solid rgba(148,163,184,0.25)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset",
        fontFamily: "var(--font-sora), var(--font-plus-jakarta-sans), system-ui, sans-serif",
      }}
    >
      <div
        style={{
          borderBottom: "1px solid rgba(148,163,184,0.2)",
          padding: "18px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          background: "rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: `${headerIconColor}22`,
              border: `1px solid ${headerIconColor}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <HeaderIcon size={22} color={headerIconColor} />
          </div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, lineHeight: 1.3, color: "#fff", letterSpacing: "-0.02em" }}>
            {escapeHtml(spec.title)}
          </h3>
        </div>
        {spec.subtitle && (
          <p style={{ margin: "0 0 0 54px", fontSize: 14, color: "#06b6d4", fontWeight: 500 }}>
            {escapeHtml(spec.subtitle)}
          </p>
        )}
      </div>
      {content}
      {spec.siteUrl && (
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid rgba(148,163,184,0.2)",
            background: "rgba(0,0,0,0.2)",
            fontSize: 12,
            color: "rgba(148,163,184,0.9)",
            textAlign: "center",
          }}
        >
          {(() => {
            try {
              const url = spec.siteUrl.startsWith("http") ? spec.siteUrl : `https://${spec.siteUrl}`;
              const hostname = new URL(url).hostname.replace(/^www\./, "");
              return (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#06b6d4", textDecoration: "none" }}
                >
                  {hostname}
                </a>
              );
            } catch {
              return <span>{spec.siteUrl}</span>;
            }
          })()}
        </div>
      )}
    </figure>
  );
}

function InfographicRenderInner() {
  const searchParams = useSearchParams();
  const specB64 = searchParams.get("spec");
  const spec = useMemo((): InfographicSpec | null => {
    if (!specB64) return null;
    try {
      const binary = atob(specB64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const json = new TextDecoder().decode(bytes);
      return JSON.parse(json) as InfographicSpec;
    } catch {
      return null;
    }
  }, [specB64]);

  if (!spec) {
    return (
      <div style={{ width: INF_WIDTH, height: INF_MIN_HEIGHT, background: "#0f172a", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Missing or invalid spec
      </div>
    );
  }

  return (
    <div
      style={{
        margin: 0,
        padding: 24,
        background: "#0f172a",
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflow: "visible",
      }}
    >
      <div style={{ overflow: "visible", flexShrink: 0 }}>
        <InfographicChart spec={spec} />
      </div>
    </div>
  );
}

export default function InfographicRenderPage() {
  return (
    <Suspense
      fallback={
        <div style={{ width: INF_WIDTH, height: INF_MIN_HEIGHT, background: "#0f172a", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center" }}>
          Loading…
        </div>
      }
    >
      <InfographicRenderInner />
    </Suspense>
  );
}
