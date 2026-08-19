/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f9f5ff',
          100: '#f4ebff',
          200: '#e9d7fe',
          300: '#d6bbfb',
          400: '#b692f6',
          500: '#9e77ed',
          600: '#7f56d9',
          700: '#6941c6',
          800: '#53389e',
          900: '#42307d',
          950: '#2c1c5f',
        },
        cubic: {
          bgLight: '#f4f6fa',
          bgDark: '#0d0f18',
          cardLight: '#ffffff',
          cardDark: '#141824',
          cardDarkElevated: '#1a1f30',
          borderLight: '#eaecf0',
          borderDark: '#23293d',
          textPrimaryLight: '#101828',
          textPrimaryDark: '#f8f9fc',
          textSecondaryLight: '#475467',
          textSecondaryDark: '#9496a8',
          textMutedLight: '#667085',
          textMutedDark: '#667085',
        },
        correct: {
          light: '#ecfdf3',
          border: '#a6f4c5',
          DEFAULT: '#12b76a',
          dark: '#027a48',
        },
        wrong: {
          light: '#fef3f2',
          border: '#fecdca',
          DEFAULT: '#f04438',
          dark: '#d92d20',
        },
        review: {
          light: '#fffaeb',
          border: '#fedf89',
          DEFAULT: '#f79009',
          dark: '#b54708',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'xs': '0px 1px 2px 0px rgba(16, 24, 40, 0.05)',
        'sm': '0px 1px 3px 0px rgba(16, 24, 40, 0.1), 0px 1px 2px 0px rgba(16, 24, 40, 0.06)',
        'md': '0px 4px 8px -2px rgba(16, 24, 40, 0.1), 0px 2px 4px -2px rgba(16, 24, 40, 0.06)',
        'lg': '0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
