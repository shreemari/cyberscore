/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#05060d',
          surface: '#0b0f1d',
          card: '#0e1424',
          elevated: '#141b2e',
        },
        neon: {
          cyan: '#22d3ee',
          violet: '#a855f7',
          magenta: '#ec4899',
          lime: '#a3e635',
        },
        border: {
          subtle: '#1f2937',
          muted: '#374151',
        },
        text: {
          primary: '#f9fafb',
          secondary: '#9ca3af',
          muted: '#6b7280',
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          DEFAULT: '#3b82f6',
        },
        score: {
          green: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter_400Regular', 'System'],
        medium: ['Inter_500Medium', 'System'],
        semibold: ['Inter_600SemiBold', 'System'],
        bold: ['Inter_700Bold', 'System'],
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
};
