/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg-app':     '#eef2f7',
        'bg-surface': '#ffffff',
        'bg-raised':  '#f8fafc',
        'bg-sunken':  '#f1f5f9',
        border:       '#dde3ec',
        'border-med': '#c8d2df',
        primary:      '#0f1c2e',
        secondary:    '#3d5166',
        muted:        '#6b7f94',
        faint:        '#9aaab8',
        teal:         '#0a7c7c',
        'teal-deep':  '#065f5f',
        'teal-light': '#e0f5f5',
        navy:         '#1e3a5f',
        'risk-low':   '#059669',
        'risk-mod':   '#d97706',
        'risk-high':  '#dc2626',
        'risk-crit':  '#7c0a0a',
        amber:        '#b45309',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
      },
      boxShadow: {
        card:  '0 1px 4px rgba(15,28,46,.06), 0 4px 16px rgba(15,28,46,.04)',
        'card-hover': '0 4px 12px rgba(15,28,46,.10), 0 8px 24px rgba(15,28,46,.07)',
      },
    },
  },
  plugins: [],
}
