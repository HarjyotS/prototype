/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'deep-navy': '#0F172A',
        'slate': '#1E293B',
        'clinical-teal': '#0D9488',
        'warm-amber': '#F59E0B',
        'alert-red': '#EF4444',
        'insight-blue': '#3B82F6',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Space Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
