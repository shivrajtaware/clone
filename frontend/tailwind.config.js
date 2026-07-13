// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#fff7fb',
          800: '#ffffff',
          700: 'rgba(255,255,255,0.76)',
          600: 'rgba(255,255,255,0.62)',
          500: '#f9cfe0',
          400: '#eda9c6',
        },
        cyan: {
          DEFAULT: '#d9467f',
          dark:    '#be2f6a',
          darker:  '#9f2458',
          glow:    'rgba(217,70,127,0.18)',
          dim:     'rgba(217,70,127,0.08)',
        },
        brand: {
          green:  '#15946f',
          red:    '#d9345f',
          amber:  '#b77912',
          purple: '#8b5cf6',
          pink:   '#ec4899',
          blue:   '#2563eb',
        },
      },
      fontFamily: {
        sans: ["'DM Sans'", 'system-ui', 'sans-serif'],
        mono: ["'DM Mono'", 'monospace'],
      },
      borderRadius: {
        xl2: '1rem',
        xl3: '1.25rem',
      },
      boxShadow: {
        'glow-cyan': '0 18px 38px rgba(217,70,127,0.22)',
        'glow-red':  '0 14px 30px rgba(217,52,95,0.24)',
        'card':      '0 18px 48px rgba(157,67,108,0.14)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.25s ease-out',
        'float-soft':  'floatSoft 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { transform: 'translateY(8px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
        floatSoft: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      },
    },
  },
  plugins: [],
}
