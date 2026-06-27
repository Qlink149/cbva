import React from "react";

export const BRAND_COLORS = {
  primary: "#5d27ca",
  deep: "#1f0798",
  soft: "#8d57de",
  lavender: "#b5a6f6",
  mist: "#e9e5ff",
  midnight: "#070362",
  navy: "#0c0828",
  success: "#22b07d",
  danger: "#d25f86",
  warning: "#f59e0b",
};

export const BRAND_SERIES_COLORS = [
  "#5d27ca",
  "#8d57de",
  "#1f0798",
  "#b5a6f6",
  "#070362",
  "#e9e5ff",
  "#22b07d",
  "#d25f86",
  "#f59e0b",
];

export const BRAND_CHART_TONES = {
  primary: ["#8d57de", "#1f0798"],
  secondary: ["#b5a6f6", "#5d27ca"],
  deep: ["#5d27ca", "#070362"],
  soft: ["#e9e5ff", "#8d57de"],
  success: ["#22b07d", "#0f7a55"],
  danger: ["#d25f86", "#a83060"],
  warning: ["#f59e0b", "#b45309"],
};

export const BRAND_CHART_AXIS = "#6d668d";
export const BRAND_CHART_GRID = "rgba(12, 8, 40, 0.12)";
export const BRAND_CHART_CURSOR = "rgba(93, 39, 202, 0.14)";

export const BrandChartGradient = ({ id, variant = "primary", direction = "vertical" }) => {
  const [from, to] = BRAND_CHART_TONES[variant] ?? BRAND_CHART_TONES.primary;
  const axis =
    direction === "horizontal"
      ? { x1: "0", y1: "0", x2: "1", y2: "0" }
      : { x1: "0", y1: "0", x2: "0", y2: "1" };

  return (
    <linearGradient id={id} {...axis}>
      <stop offset="0%" stopColor={from} stopOpacity={1} />
      <stop offset="100%" stopColor={to} stopOpacity={1} />
    </linearGradient>
  );
};

export const BrandAreaGradient = ({ id, variant = "primary" }) => {
  const [from] = BRAND_CHART_TONES[variant] ?? BRAND_CHART_TONES.primary;
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor={from} stopOpacity={0.28} />
      <stop offset="95%" stopColor={from} stopOpacity={0.03} />
    </linearGradient>
  );
};

export const brandDonutSegments = (pct, total = 100) => {
  const rest = total - pct;
  return `conic-gradient(${BRAND_COLORS.primary} 0 ${pct}%, ${BRAND_COLORS.lavender} ${pct}% ${pct + rest * 0.48}%, ${BRAND_COLORS.mist} ${pct + rest * 0.48}% 100%)`;
};
