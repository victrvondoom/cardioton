/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        clinical: {
          bg: '#F6F7F9',
          surface: '#FFFFFF',
          subtle: '#F8FAFC',
          border: '#E2E8F0',
          borderDark: '#334155',
          text: '#0F172A',
          muted: '#64748B',
          primary: '#0284C7',
          primaryHover: '#0369A1',
          primaryLight: '#E0F2FE'
        }
      }
    },
  },
  plugins: [],
}
