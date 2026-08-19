export interface ColorPalette {
  name: string;
  dayName: string;
  description: string;
  previewColor: string;
  shades: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
  };
}

export const DAILY_PALETTES: Record<number, ColorPalette> = {
  0: {
    name: 'Emerald Harmony',
    dayName: 'Sunday',
    description: 'Serene Emerald & Mint — peaceful start to the study week',
    previewColor: '#10b981',
    shades: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
      950: '#022c22',
    },
  },
  1: {
    name: 'Deep Indigo Focus',
    dayName: 'Monday',
    description: 'Deep Electric Indigo — high-energy Monday deep focus',
    previewColor: '#6366f1',
    shades: {
      50: '#eef2ff',
      100: '#e0e7ff',
      200: '#c7d2fe',
      300: '#a5b4fc',
      400: '#818cf8',
      500: '#6366f1',
      600: '#4f46e5',
      700: '#4338ca',
      800: '#3730a3',
      900: '#312e81',
      950: '#1e1b4b',
    },
  },
  2: {
    name: 'Ocean Cyan Breeze',
    dayName: 'Tuesday',
    description: 'Fresh Sky & Cyan — crisp clarity for revision',
    previewColor: '#0ea5e9',
    shades: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
      950: '#082f49',
    },
  },
  3: {
    name: 'Royal Amethyst',
    dayName: 'Wednesday',
    description: 'Velvet Purple & Violet — mid-week mastery & motivation',
    previewColor: '#a855f7',
    shades: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#c084fc',
      500: '#a855f7',
      600: '#9333ea',
      700: '#7e22ce',
      800: '#6b21a8',
      900: '#581c87',
      950: '#3b0764',
    },
  },
  4: {
    name: 'Sunset Amber',
    dayName: 'Thursday',
    description: 'Warm Golden Amber — uplifting, warm evening focus',
    previewColor: '#f59e0b',
    shades: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
      950: '#451a03',
    },
  },
  5: {
    name: 'Rose Quartz',
    dayName: 'Friday',
    description: 'Vibrant Rose Coral — energizing weekend prep',
    previewColor: '#f43f5e',
    shades: {
      50: '#fff1f2',
      100: '#ffe4e6',
      200: '#fecdd3',
      300: '#fda4af',
      400: '#fb7185',
      500: '#f43f5e',
      600: '#e11d48',
      700: '#be123c',
      800: '#9f1239',
      900: '#881337',
      950: '#4c0519',
    },
  },
  6: {
    name: 'Teal Mountain',
    dayName: 'Saturday',
    description: 'Calm Mountain Teal — relaxed weekend mock exams',
    previewColor: '#14b8a6',
    shades: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
      950: '#042f2e',
    },
  },
};

/**
 * Applies the given palette or calculates today's daily rotating theme (in Asia/Kathmandu time).
 */
export function applyDailyTheme(forcedDayIndex?: number): ColorPalette {
  let dayIndex: number;

  if (forcedDayIndex !== undefined && forcedDayIndex >= 0 && forcedDayIndex <= 6) {
    dayIndex = forcedDayIndex;
    localStorage.setItem('studydashboard_custom_theme_day', String(dayIndex));
  } else {
    const saved = localStorage.getItem('studydashboard_custom_theme_day');
    if (saved !== null && saved !== 'auto') {
      dayIndex = Number(saved);
    } else {
      // Auto: Nepal date day-of-week
      const now = new Date();
      // UTC + 5:45
      const ktmTime = new Date(now.getTime() + (5 * 60 + 45) * 60 * 1000);
      dayIndex = ktmTime.getUTCDay();
    }
  }

  const palette = DAILY_PALETTES[dayIndex] || DAILY_PALETTES[1];
  const root = document.documentElement;

  // Set CSS variables on root
  Object.entries(palette.shades).forEach(([shade, value]) => {
    root.style.setProperty(`--brand-${shade}`, value);
  });

  return palette;
}
