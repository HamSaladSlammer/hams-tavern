// Colour themes for the whole interface: presets, plus your own accent, background and text
// colours. Everything else (cards, borders, muted text) is worked out from those.

export interface Palette { bg: string; bg2: string; card: string; line: string; ink: string; soft: string; dim: string; gold: string; green: string; blood: string; you: string; accent: string }
export interface ThemeDef { id: string; name: string; p: Palette }
export interface CustomColours { accent?: string; bg?: string; ink?: string }

export const THEMES: ThemeDef[] = [
  { id: 'dark', name: 'Tavern', p: { bg: '#17120d', bg2: '#211a13', card: '#2a2118', line: '#3b2f22', ink: '#eadfc8', soft: '#b9a98c', dim: '#85765f', gold: '#d2ad55', green: '#7fae86', blood: '#d2715f', you: '#9fb7d6', accent: '#c99a3a' } },
  { id: 'light', name: 'Parchment', p: { bg: '#e9dfc8', bg2: '#dfd2b4', card: '#f3ead6', line: '#c9b78f', ink: '#2c231a', soft: '#5a4c3a', dim: '#8c8272', gold: '#8a6a1f', green: '#3f6e48', blood: '#8e2a22', you: '#2f5f9e', accent: '#7a5a18' } },
  { id: 'midnight', name: 'Midnight', p: { bg: '#0f1420', bg2: '#151c2c', card: '#1b2438', line: '#2a3550', ink: '#dfe6f3', soft: '#a3b0c8', dim: '#6f7d98', gold: '#e3c46b', green: '#7fc4a0', blood: '#e07a6e', you: '#8fb8ff', accent: '#6f8fdc' } },
  { id: 'forest', name: 'Thornwood', p: { bg: '#101710', bg2: '#162016', card: '#1d2a1c', line: '#2c3d2a', ink: '#e1ead6', soft: '#a9b89a', dim: '#76866a', gold: '#c9c36a', green: '#8ccf8a', blood: '#d47b62', you: '#9fc6d6', accent: '#6fa35c' } },
  { id: 'bloodmoon', name: 'Blood Moon', p: { bg: '#170b0c', bg2: '#211012', card: '#2b1518', line: '#45212a', ink: '#f0dcdc', soft: '#c49c9c', dim: '#8d6767', gold: '#e8a35a', green: '#8fbf8f', blood: '#ff6b5e', you: '#b6a9e0', accent: '#b8323a' } },
  { id: 'ash', name: 'Ash', p: { bg: '#141414', bg2: '#1c1c1c', card: '#242424', line: '#383838', ink: '#e6e6e6', soft: '#b0b0b0', dim: '#7c7c7c', gold: '#d9c27a', green: '#8fc49a', blood: '#e07a6a', you: '#9ec1e6', accent: '#9a9a9a' } },
  { id: 'sea', name: 'Northern Ocean', p: { bg: '#0b1719', bg2: '#102023', card: '#15292d', line: '#21404a', ink: '#d9eef0', soft: '#9dbcc0', dim: '#6a8a8f', gold: '#e2c56e', green: '#7fd1a8', blood: '#e58370', you: '#8fd0ff', accent: '#2f9fa6' } },
  { id: 'snow', name: 'Herstal Snow', p: { bg: '#eef2f5', bg2: '#e1e8ee', card: '#f8fafc', line: '#c3cfd9', ink: '#1d2731', soft: '#4a5a69', dim: '#7c8b98', gold: '#6a5a1a', green: '#2f6b4a', blood: '#a3302a', you: '#1f5fa8', accent: '#3a6ea5' } },
  { id: 'contrast', name: 'High contrast', p: { bg: '#000000', bg2: '#0a0a0a', card: '#111111', line: '#5a5a5a', ink: '#ffffff', soft: '#e0e0e0', dim: '#b5b5b5', gold: '#ffd84a', green: '#6dff9a', blood: '#ff6a5a', you: '#7ec8ff', accent: '#ffd84a' } },
];

const hex = (h: string) => { const n = parseInt(h.replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number) => { const x = hex(a), y = hex(b); return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
export const luminance = (h: string) => { const [r, g, b] = hex(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

/** A full palette from a preset plus any custom colours. */
export function paletteFor(themeId: string, custom: CustomColours = {}): Palette {
  const base = (THEMES.find((t) => t.id === themeId) ?? THEMES[0]).p;
  const p = { ...base };
  if (custom.bg) {
    const light = luminance(custom.bg) > 0.5;
    const toward = light ? '#000000' : '#ffffff';
    p.bg = custom.bg;
    p.bg2 = mix(custom.bg, toward, 0.04);
    p.card = mix(custom.bg, toward, 0.08);
    p.line = mix(custom.bg, toward, 0.18);
    if (!custom.ink && light !== luminance(base.bg) > 0.5) p.ink = light ? '#1f1a14' : '#ece4d4';
  }
  if (custom.ink) p.ink = custom.ink;
  if (custom.bg || custom.ink) { p.soft = mix(p.ink, p.bg, 0.3); p.dim = mix(p.ink, p.bg, 0.5); }
  if (custom.accent) {
    p.accent = custom.accent;
    const light = luminance(p.bg) > 0.5;
    p.gold = light ? mix(custom.accent, '#000000', 0.25) : mix(custom.accent, '#ffffff', 0.25);
  }
  return p;
}

export function applyTheme(themeId: string, custom: CustomColours = {}) {
  const p = paletteFor(themeId, custom);
  const st = document.documentElement.style;
  for (const [k, v] of Object.entries(p)) st.setProperty(`--${k}`, v);
  const light = luminance(p.bg) > 0.5;
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', p.bg2);
  return p;
}
