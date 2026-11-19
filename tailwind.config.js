/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0A1638',
          blue: '#0066FF',
          orange: '#FF6B00',
        },
      },
    },
  },
  plugins: [],
};
