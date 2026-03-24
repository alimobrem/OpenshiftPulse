/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        slate: {
          850: '#1a202e',
        },
      },
      keyframes: {
        'slide-in': {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.3s ease-out',
      },
      boxShadow: {
        'modern-sm': 'var(--shadow-sm)',
        'modern-md': 'var(--shadow-md)',
        'modern-lg': 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
};
