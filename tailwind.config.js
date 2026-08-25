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
        //
        // agent-ink/agent-ink-dark were later lightened from a near-black
        // teal (#0B4F4A/#083A36) to Tailwind's own teal-700/teal-800 — same
        // hue family (this was already a teal, not a true forest green), just
        // materially brighter, since the original read as "very dark" across
        // every heading/body-text/icon on the portal. Still comfortably
        // AA-compliant for body text on white (teal-700 ≈ 5.4:1, teal-800 ≈
        // 7.1:1 — both above the 4.5:1 minimum), and the two still keep their
        // original darker/lighter relationship to each other. Every other
        // token below (borders, panels, background, gold accent, muted text)
        // was already light/neutral enough that it wasn't part of the "too
        // dark" complaint, so those are untouched.
        'agent-ink': '#0F766E',
        'agent-ink-dark': '#115E59',
        'agent-line': '#8FB5AE',
        'agent-line-light': '#D7EAE5',
        'agent-panel': '#EAF6F2',
        // Cream page canvas — re-themed off the pale ocean-mist tint to match
        // the "Fixed Group Departures" reference design's warm cream
        // background. Only this base canvas token changed; agent-panel/
        // agent-ink/agent-accent (the teal/gold system every other agent
        // page's cards, borders and buttons already use) are untouched, so
        // existing pages keep their current look sitting on a warmer canvas
        // rather than needing a full per-page re-theme.
        'agent-bg': '#FDF8ED',
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
