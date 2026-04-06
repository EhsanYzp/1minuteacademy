export const CATEGORY_SURFACE_COLORS = {
  "accounting": "#93c5fd",
  "banking": "#93c5fd",
  "behavioral-economics": "#a5b4fc",
  "business": "#94a3b8",
  "business-models": "#a8a29e",
  "e-commerce": "#c4b5fd",
  "economics": "#7dd3fc",
  "entrepreneurship": "#a5b4fc",
  "insurance": "#93c5fd",
  "investing": "#93c5fd",
  "money": "#fcd34d",
  "personal-finance": "#93c5fd",
  "real-estate": "#fbbf24",
  "startups": "#c4b5fd",
  "taxes": "#93c5fd",
  "trading": "#7dd3fc",
  "fraud-and-scams": "#fca5a5",
  "risk-and-compliance": "#94a3b8",
  "career": "#a5b4fc",
  "communication": "#67e8f9",
  "copywriting": "#fde047",
  "human-resources": "#67e8f9",
  "leadership": "#a5b4fc",
  "management": "#94a3b8",
  "marketing": "#fda4af",
  "negotiation": "#93c5fd",
  "operations": "#9ca3af",
  "product-management": "#c4b5fd",
  "productivity": "#5eead4",
  "project-management": "#94a3b8",
  "public-speaking": "#c4b5fd",
  "sales": "#86efac",
  "workplace-skills": "#93c5fd",
  "critical-thinking": "#a5b4fc",
  "creativity": "#fde047",
  "decision-making": "#93c5fd",
  "education": "#67e8f9",
  "game-theory": "#d6d3d1",
  "information-theory": "#a5b4fc",
  "learning": "#5eead4",
  "learning-methods": "#5eead4",
  "life-skills": "#93c5fd",
  "logic": "#93c5fd",
  "mental-models": "#a5b4fc",
  "cognitive-science": "#c4b5fd",
  "emotions": "#f9a8d4",
  "mental-health": "#5eead4",
  "neuroscience": "#c4b5fd",
  "psychology": "#c4b5fd",
  "first-aid-safety": "#fca5a5",
  "human-body": "#c4b5fd",
  "human-evolution": "#a5b4fc",
  "medicine": "#5eead4",
  "nutrition": "#86efac",
  "physical-fitness": "#fca5a5",
  "public-health": "#67e8f9",
  "self-care": "#f9a8d4",
  "sexual-health": "#fda4af",
  "sleep": "#a5b4fc",
  "parenting": "#fdba74",
  "relationships": "#f9a8d4",
  "social-media": "#67e8f9",
  "sociology": "#93c5fd",
  "anthropology": "#fde047",
  "archaeology": "#fcd34d",
  "culture": "#c4b5fd",
  "ethics": "#94a3b8",
  "geopolitics": "#93c5fd",
  "history": "#fcd34d",
  "languages": "#5eead4",
  "law": "#93c5fd",
  "linguistics": "#a5b4fc",
  "literature": "#fde047",
  "media-literacy": "#94a3b8",
  "myth-symbolism": "#c4b5fd",
  "mythology": "#c4b5fd",
  "philosophy": "#a5b4fc",
  "politics": "#94a3b8",
  "religion": "#c4b5fd",
  "religion-and-spirituality": "#c4b5fd",
  "religion-spirituality": "#c4b5fd",
  "animation": "#fda4af",
  "art": "#fda4af",
  "art-design": "#fda4af",
  "design": "#c4b5fd",
  "fashion": "#f9a8d4",
  "film-and-cinema": "#a8a29e",
  "gaming": "#c4b5fd",
  "music": "#d8b4fe",
  "music-production": "#a5b4fc",
  "photography": "#9ca3af",
  "television-and-streaming": "#93c5fd",
  "writing": "#fde047",
  "astronomy-and-space": "#a5b4fc",
  "astronomy-space": "#a5b4fc",
  "biology": "#86efac",
  "biotechnology": "#5eead4",
  "chemistry": "#67e8f9",
  "ecology": "#86efac",
  "food-science": "#fde047",
  "genetics": "#c4b5fd",
  "geography": "#86efac",
  "geology": "#fcd34d",
  "mathematics": "#a5b4fc",
  "meteorology": "#7dd3fc",
  "oceanography": "#7dd3fc",
  "physics": "#a5b4fc",
  "science": "#93c5fd",
  "statistics": "#a5b4fc",
  "agriculture": "#86efac",
  "climate-and-environment": "#5eead4",
  "coffee-and-tea": "#d4a574",
  "cooking": "#fdba74",
  "energy": "#fde047",
  "gardening": "#86efac",
  "architecture": "#a8a29e",
  "civil-engineering": "#94a3b8",
  "electrical-engineering": "#a5b4fc",
  "engineering-fundamentals": "#9ca3af",
  "materials-science": "#94a3b8",
  "mechanical-engineering": "#a8a29e",
  "nanotechnology": "#a5b4fc",
  "transportation-systems": "#7dd3fc",
  "urban-planning": "#5eead4",
  "ai": "#c4b5fd",
  "ai-agents": "#c4b5fd",
  "cloud-computing": "#7dd3fc",
  "computer-networking": "#93c5fd",
  "cybersecurity": "#5eead4",
  "data": "#a5b4fc",
  "data-engineering": "#93c5fd",
  "databases": "#a5b4fc",
  "devops": "#7dd3fc",
  "future-tech": "#a5b4fc",
  "mobile-development": "#93c5fd",
  "privacy-and-digital-rights": "#93c5fd",
  "programming": "#a5b4fc",
  "quality-assurance-testing": "#94a3b8",
  "supply-chain-logistics": "#9ca3af",
  "system-design": "#93c5fd",
  "technology": "#93c5fd",
  "ux-research": "#c4b5fd",
  "web-development": "#67e8f9",
  "web3": "#a8a29e",
  "automotive-and-evs": "#9ca3af",
  "home-diy": "#fcd34d",
  "home-and-diy": "#fcd34d",
  "hospitality": "#fdba74",
  "sports": "#86efac",
  "travel": "#67e8f9",
};

export function getCategorySurfaceColor(categoryId, fallback = "") {
  const key = String(categoryId ?? "").trim();
  return CATEGORY_SURFACE_COLORS[key] || fallback;
}

function hexToRgb(hex) {
  const value = String(hex ?? '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function toRgba(hex, alpha, fallback) {
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function getRelativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const srgb = [rgb.r, rgb.g, rgb.b].map((value) => value / 255);
  const linear = srgb.map((value) => (
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

export function getCategoryChipVars(categoryId, fallback = "") {
  const color = getCategorySurfaceColor(categoryId, fallback);
  if (!color) return undefined;
  return {
    '--chip-accent': color,
    '--chip-border': toRgba(color, 0.22, 'rgba(92, 71, 44, 0.09)'),
    '--chip-bg': toRgba(color, 0.12, 'rgba(255, 249, 242, 0.64)'),
  };
}

export function getCategoryThemeVars(categoryId, fallback = "") {
  const color = getCategorySurfaceColor(categoryId, fallback);
  if (!color) return undefined;

  const luminance = getRelativeLuminance(color);
  const isVeryLight = luminance != null && luminance >= 0.68;
  const isLight = luminance != null && luminance >= 0.52;

  const ink = isVeryLight
    ? 'rgba(72, 56, 24, 0.96)'
    : isLight
      ? 'rgba(63, 55, 40, 0.95)'
      : 'rgba(36, 46, 64, 0.96)';

  const inkSoft = isVeryLight
    ? 'rgba(92, 71, 44, 0.82)'
    : isLight
      ? 'rgba(81, 72, 56, 0.76)'
      : 'rgba(55, 65, 81, 0.76)';

  const borderSoftAlpha = isVeryLight ? 0.32 : isLight ? 0.24 : 0.18;
  const borderStrongAlpha = isVeryLight ? 0.40 : isLight ? 0.30 : 0.22;
  const surfaceAlpha = isVeryLight ? 0.18 : isLight ? 0.14 : 0.10;
  const surfaceStrongAlpha = isVeryLight ? 0.28 : isLight ? 0.22 : 0.16;
  const overlayTop = isVeryLight ? 'rgba(255, 249, 242, 0.46)' : isLight ? 'rgba(255, 249, 242, 0.38)' : 'rgba(255, 249, 242, 0.30)';
  const overlayBottom = isVeryLight ? 'rgba(247, 238, 227, 0.72)' : isLight ? 'rgba(247, 238, 227, 0.60)' : 'rgba(247, 238, 227, 0.48)';
  const overlayTopHover = isVeryLight ? 'rgba(255, 249, 242, 0.34)' : isLight ? 'rgba(255, 249, 242, 0.28)' : 'rgba(255, 249, 242, 0.20)';
  const overlayBottomHover = isVeryLight ? 'rgba(247, 238, 227, 0.56)' : isLight ? 'rgba(247, 238, 227, 0.46)' : 'rgba(247, 238, 227, 0.36)';

  return {
    '--tone-ink': ink,
    '--tone-ink-soft': inkSoft,
    '--tone-border-soft': toRgba(color, borderSoftAlpha, 'rgba(92, 71, 44, 0.09)'),
    '--tone-border-strong': toRgba(color, borderStrongAlpha, 'rgba(92, 71, 44, 0.14)'),
    '--tone-surface': toRgba(color, surfaceAlpha, 'rgba(255, 249, 241, 0.52)'),
    '--tone-surface-strong': toRgba(color, surfaceStrongAlpha, 'rgba(255, 249, 241, 0.68)'),
    '--tone-overlay-top': overlayTop,
    '--tone-overlay-bottom': overlayBottom,
    '--tone-overlay-top-hover': overlayTopHover,
    '--tone-overlay-bottom-hover': overlayBottomHover,
  };
}