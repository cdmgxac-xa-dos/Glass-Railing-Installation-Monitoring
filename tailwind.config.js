/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        xa: {
          navy: '#0B3D66',
          blue: '#1D6FE0',
          skyblue: '#EAF2FE',
          slate: '#4A5A6A',
          // Bumped from #DCE4EC (assessment section 5) — card/input borders
          // were too faint to read outdoors in direct sunlight; this stays
          // subtle indoors while giving real edge definition in the field.
          line: '#C7D2DC',
        },
        status: {
          notstarted: '#8A99A8',
          inprogress: '#1D6FE0',
          qc: '#B8860B',
          punch: '#D0453B',
          onhold: '#6B5B95',
          completed: '#1E8E5A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(11, 61, 102, 0.08), 0 1px 2px rgba(11, 61, 102, 0.06)',
        pop: '0 8px 24px rgba(11, 61, 102, 0.16)',
      },
    },
  },
  plugins: [],
}
