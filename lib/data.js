export const COLUMNS = ["todo", "inprog", "review", "done"];

export const PRIORITY_ORDER = ["urgent", "high", "medium", "low"];

export const PRIORITY_META = {
  urgent: {
    label: "Urgent",
    color: "var(--danger)",
    bg: "rgba(240,112,112,0.12)",
  },
  high: { label: "High", color: "#f0a060", bg: "rgba(240,160,96,0.12)" },
  medium: { label: "Medium", color: "var(--inprog-c)", bg: "var(--inprog-bg)" },
  low: { label: "Low", color: "var(--text3)", bg: "var(--surface3)" },
};

export const COLUMN_LABELS = {
  todo: "To do",
  inprog: "In progress",
  review: "In review",
  done: "Done",
};

export const PROJECT_COLORS = [
  "#7c6df0",
  "#4ecb8a",
  "#f0c060",
  "#6aabff",
  "#ff7b8a",
  "#f0855a",
  "#5dcaa5",
  "#c084fc",
];

export const ASSIGNEES = ["AIOps Agent", "Me","Unassigned"];

export const AVATAR_PALETTES = [
  { bg: "rgba(124,109,240,.22)", color: "#a897ff" },
  { bg: "rgba(78,203,138,.18)", color: "#4ecb8a" },
  { bg: "rgba(240,192,96,.18)", color: "#f0c060" },
  { bg: "rgba(106,171,255,.18)", color: "#6aabff" },
  { bg: "rgba(255,123,138,.18)", color: "#ff7b8a" },
];

export function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function avatarPalette(name) {
  if (!name) return AVATAR_PALETTES[0];
  return AVATAR_PALETTES[name.charCodeAt(0) % AVATAR_PALETTES.length];
}

export function uid() {
  return "t" + Date.now() + Math.random().toString(36).slice(2, 8);
}
