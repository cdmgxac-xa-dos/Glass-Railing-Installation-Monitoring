/** @type {import('tailwindcss').Config}
 *
 * Colors/shadows/fonts here are the XA Design Studio approved brand tokens
 * (DR-0003, xa-dos-design-studio/04_DIGITAL/DESIGN_SYSTEM/tokens.json
 * v0.2.0) — the same values XA DOS itself migrated to (DR-0006). Extend
 * this file to stay in sync with that token set rather than introducing
 * ad-hoc hexes in individual screens.
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        xa: {
          navy: '#073F5F', // brand.primary-strong — dark headers, pressed/high-emphasis
          blue: '#0A5C8A', // brand.primary — buttons, links, active nav, key accents
          accent: '#2C9CD6', // brand.accent — focus states, highlights, data-viz accent series
          skyblue: '#E1EEF4', // brand.primary-soft — tinted surfaces, selected rows
          slate: '#5A6672', // neutral.slate — tertiary text, icons, neutral status
          line: '#C5CED6', // neutral.mist — dividers, input borders
        },
        status: {
          notstarted: '#5A6672', // functional.neutral
          inprogress: '#0A5C8A', // brand.primary
          qc: '#B87514', // functional.warning
          punch: '#C0392F', // functional.danger
          onhold: '#7A5EA8', // approved data-viz series purple — no dedicated "hold" functional color exists
          completed: '#1E7F5C', // functional.success
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Approved: Manrope for headings/KPI numbers, Inter for everything
        // else (typography.family in tokens.json).
        display: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Approved elevation tokens (elevation.raised / elevation.overlay).
        card: '0 1px 2px rgba(11, 17, 22, 0.06), 0 4px 12px rgba(11, 17, 22, 0.06)',
        pop: '0 8px 28px rgba(11, 17, 22, 0.14)',
      },
    },
  },
  plugins: [],
}
