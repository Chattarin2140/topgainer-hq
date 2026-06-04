export const C = {
  bg: '#0a0b0f',
  surface: '#12141a',
  card: '#1a1d26',
  border: '#252836',
  accent: '#00d4ff',
  green: '#00e676',
  red: '#ff4757',
  yellow: '#ffd32a',
  text: '#e8eaf0',
  muted: '#6b7280',
  inputBg: '#0e1018',
};

export const FONT = "'JetBrains Mono', 'Fira Code', monospace";

export const STRATEGIES = [
  'Long Call',
  'Long Put',
  'Short Call',
  'Short Put',
  'Bull Call Spread',
  'Bear Put Spread',
  'Iron Condor',
  'Straddle',
  'Strangle',
];

export const STRATEGY_COLORS = {
  'Long Call': '#00e676',
  'Long Put': '#ff4757',
  'Short Call': '#ffd32a',
  'Short Put': '#ff6b81',
  'Bull Call Spread': '#00d4ff',
  'Bear Put Spread': '#a855f7',
  'Iron Condor': '#f97316',
  'Straddle': '#ec4899',
  'Strangle': '#14b8a6',
};

export const DONUT_PALETTE = [
  '#00d4ff', '#00e676', '#ffd32a', '#a855f7', '#f97316',
  '#ec4899', '#14b8a6', '#ff6b81', '#7c3aed', '#ff4757',
  '#38bdf8', '#facc15',
];

export const inputStyle = {
  background: C.inputBg,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  color: C.text,
  fontFamily: FONT,
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.15s ease',
};
