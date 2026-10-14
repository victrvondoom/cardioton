/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cardio: {
          dark: '#0b0f19',
          card: '#111827',
          border: '#1f2937',
          accent: '#38bdf8',
          lad: '#3b82f6',
          lcx: '#8b5cf6',
          rca: '#ec4899',
        }
      }
    },
  },
  plugins: [],
}
