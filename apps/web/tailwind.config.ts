import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefbf3',
          100: '#d6f5e1',
          200: '#b0eac8',
          300: '#7cd9a8',
          400: '#46c284',
          500: '#24a86a',
          600: '#168754',
          700: '#126c45',
          800: '#115639',
          900: '#0f4730',
          950: '#07281b',
        },
        auction: {
          live: '#22c55e',
          ending: '#f59e0b',
          scheduled: '#3b82f6',
          ended: '#6b7280',
        },
      },
      keyframes: {
        'bid-flash': {
          '0%': { backgroundColor: 'rgb(34 197 94 / 0.2)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        'bid-flash': 'bid-flash 1s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
