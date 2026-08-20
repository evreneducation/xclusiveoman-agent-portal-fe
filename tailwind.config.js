/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Admin Console palette — used only by src/admin/**. Whole-admin
        // colour-system pass: retinted from the original charcoal/terracotta
        // pairing onto the blue/indigo/purple "modern SaaS dashboard" palette
        // the CMS pages introduced first, so every existing admin page that
        // uses these same token names (text-accent, bg-panel, border-line-light,
        // text-muted, …) re-themes consistently in one place rather than
        // needing per-page edits. Same token names throughout, so no markup
        // changed — only what each token resolves to. The Agent Portal has
        // its own separate `agent-*` palette (unchanged) so the two portals
        // stay visually distinct per-portal without a second Tailwind build.
        ink: '#172554',
        'ink-dark': '#0F1B4D',
        line: '#A5B4D9',
        'line-light': '#E4E9FB',
        panel: '#F3F4FF',
        accent: '#4F46E5',
        'accent-soft': '#E0E7FF',
        'accent-dark': '#3730A3',
        muted: '#64748B',

        // Agent Portal — a travel-themed "ocean + sunset over the dunes"
        // identity, deliberately different colour codes from the Admin
        // Console's navy/indigo/purple palette above (teal/emerald ocean
        // tones + gold/coral sunset accents instead), so the two portals
        // keep reading as distinct apps while both get the same "colourful,
        // modern, premium" treatment. Same token names as before — only the
        // hex values were enriched — so no agent markup needed to change
        // for this to take effect anywhere they're already used. Used only
        // by src/agent/** components.
        'agent-ink': '#0B4F4A',
        'agent-ink-dark': '#083A36',
        'agent-line': '#8FB5AE',
        'agent-line-light': '#D7EAE5',
        'agent-panel': '#EAF6F2',
        'agent-bg': '#F5FBF8',
        'agent-accent': '#E2A33B',
        'agent-accent-dark': '#C98A24',
        'agent-accent-soft': '#FAF0DA',
        'agent-muted': '#5F7D79',

        // Team Portal (/team) — Lead Managers (sales_manager) and
        // Relationship Managers (relationship_manager) sign in here, never
        // into the full Admin Console or Agent Portal. A third, deliberately
        // distinct identity from both above — slate charcoal + a rose/crimson
        // accent ("executive slate & rose"), so someone glancing at either
        // sidebar can never mistake this for Admin's navy/indigo/purple or
        // Agent's teal/gold. Used only by src/team/**.
        'team-ink': '#1E2532',
        'team-ink-dark': '#12161F',
        'team-line': '#A8AEBB',
        'team-line-light': '#E4E7EC',
        'team-panel': '#F7F5F6',
        'team-bg': '#FBFAFA',
        'team-accent': '#BE123C',
        'team-accent-dark': '#881337',
        'team-accent-soft': '#FCE4E9',
        'team-muted': '#6B7280',
      },
      fontFamily: {
        sans: ['Helvetica', 'Arial', 'sans-serif'],
        mono: ['SFMono-Regular', 'Consolas', '"Liberation Mono"', 'Menlo', 'monospace'],
      },
      boxShadow: {
        wf: '6px 6px 0 rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};
