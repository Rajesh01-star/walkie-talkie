/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tactical: {
          900: '#0a0d0e',
          800: '#121719',
          700: '#1b2225',
          600: '#263135',
          amber: '#ffb300',
          cyan: '#00f0ff',
          green: '#22c55e',
          red: '#ef4444',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        display: ['Orbitron', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 25px rgba(0, 240, 255, 0.45)',
        'glow-amber': '0 0 25px rgba(255, 179, 0, 0.45)',
        'inner-lcd': 'inset 0 2px 10px rgba(0,0,0,0.8), inset 0 0 20px rgba(0, 240, 255, 0.1)',
      },
    },
  },
  plugins: [],
}
