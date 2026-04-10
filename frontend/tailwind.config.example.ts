/**
 * TAILWIND CONFIG - Optimized for Electric Blue Design System
 *
 * Add this to your tailwind.config.ts or tailwind.config.js
 * This config extends the default Tailwind theme with custom colors,
 * typography, and animations from the design system.
 */

import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  // ✅ Enable dark mode with data attribute strategy
  darkMode: ['selector', '[data-theme="dark"]'],

  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],

  theme: {
    extend: {
      // ── CUSTOM COLORS ──
      colors: {
        // Primary Blue (Electric)
        primary: {
          50: '#F0F7FF',
          100: '#E0EEFF',
          200: '#C1DCFF',
          300: '#A2CBFF',
          400: '#83B9FF',
          500: '#1E90FF',
          600: '#0066FF',
          700: '#004FCC',
          800: '#003B99',
          900: '#002766',
          950: '#001433',
        },

        // Accent Colors
        accent: {
          cyan: '#00D4FF',
          indigo: '#6366F1',
          purple: '#A855F7',
        },

        // Semantic Colors
        success: {
          50: '#D1FAE5',
          600: '#10B981',
        },
        warning: {
          50: '#FEF3C7',
          600: '#F59E0B',
        },
        error: {
          50: '#FEE2E2',
          600: '#EF4444',
        },
        info: {
          50: '#DBEAFE',
          600: '#3B82F6',
        },
      },

      // ── TYPOGRAPHY ──
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        serif: defaultTheme.fontFamily.serif,
        mono: ['Menlo', 'Monaco', ...defaultTheme.fontFamily.mono],
        display: ['Lexend', 'Inter', ...defaultTheme.fontFamily.sans],
      },

      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['0.95rem', { lineHeight: '1.6rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
      },

      lineHeight: {
        tight: '1.25',
        snug: '1.375',
        normal: '1.5',
        relaxed: '1.625',
        loose: '2',
      },

      letterSpacing: {
        tighter: '-0.02em',
        tight: '-0.01em',
        normal: '0em',
        wide: '0.025em',
        wider: '0.05em',
        widest: '0.1em',
      },

      // ── SPACING ──
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '2.5rem',
        '3xl': '3rem',
      },

      // ── BORDER RADIUS ──
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '28px',
        full: '9999px',
      },

      // ── SHADOWS ──
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        sm: '0 2px 4px 0 rgba(0, 0, 0, 0.08)',
        md: '0 4px 8px 0 rgba(0, 0, 0, 0.1)',
        lg: '0 8px 16px 0 rgba(0, 0, 0, 0.12)',
        xl: '0 12px 24px 0 rgba(0, 0, 0, 0.15)',
        '2xl': '0 16px 40px 0 rgba(0, 0, 0, 0.2)',
        glow: '0 0 20px rgba(0, 102, 255, 0.3)',
        'glow-dark': '0 0 20px rgba(30, 144, 255, 0.4)',
      },

      // ── TRANSITIONS ──
      transitionDuration: {
        fast: '150ms',
        base: '250ms',
        slow: '350ms',
      },

      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      // ── ANIMATIONS ──
      animation: {
        'fade-in': 'fadeIn 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-in-up': 'slideInUp 250ms cubic-bezier(0.4, 0, 0.2, 1)',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInUp: {
          '0%': {
            transform: 'translateY(20px)',
            opacity: '0',
          },
          '100%': {
            transform: 'translateY(0)',
            opacity: '1',
          },
        },
      },

      // ── GRADIENTS ──
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #0066FF 0%, #1E90FF 50%, #00D4FF 100%)',
        'gradient-primary-subtle': 'linear-gradient(135deg, #F0F7FF 0%, #E0EEFF 50%, #F0F4FF 100%)',
        'gradient-header': 'linear-gradient(180deg, #0052CC 0%, #0066FF 50%, #1E90FF 100%)',
      },

      // ── BACKDROP ──
      backdropBlur: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '20px',
      },
    },
  },

  plugins: [
    // Plugin for scrollbar styling (optional)
    function ({ addUtilities }: any) {
      const scrollbarUtilities = {
        '.scrollbar-thumb-blue': {
          scrollbarColor: '#0066FF #F8FAFC',
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#0066FF',
            borderRadius: '9999px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#F8FAFC',
          },
        },
        '.scrollbar-thumb-blue-dark': {
          scrollbarColor: '#1E90FF #0F1629',
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#1E90FF',
            borderRadius: '9999px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#0F1629',
          },
        },
      };
      addUtilities(scrollbarUtilities);
    },
  ],
};

export default config;
