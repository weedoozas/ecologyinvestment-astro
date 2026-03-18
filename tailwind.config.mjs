/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'eco-bg': '#eef7f1',
        'eco-surface': '#ffffff',
        'eco-line': 'rgba(34, 63, 43, 0.12)',
        'eco-text': '#0c170f',
        'eco-muted': '#356444',
        'eco-green': '#4b8b5f',
        'eco-green-deep': '#223f2b',
      },
    },
  },
  plugins: [],
}
