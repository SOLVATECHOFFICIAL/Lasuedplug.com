import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eef5ff',
          100: '#d9e8ff',
          500: '#0066ff',
          600: '#0052cc',
          700: '#003fa3',
          900: '#0a1638',
        },
        accent: {
          500: '#ff6b00',
          600: '#e05d00',
        },
        brand: {
          navy: '#0A1638',
          blue: '#0066FF',
          orange: '#FF6B00',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
