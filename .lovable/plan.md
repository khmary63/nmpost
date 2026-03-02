

## Landing Page Enhancement Plan

The current landing page is a minimal centered card with a logo icon, title, subtitle, and two buttons. It needs to become a proper marketing page that sells QuoteKit.

### What will be built

**Full marketing landing page** with these sections:

1. **Hero section** — Large headline ("Win more deals with beautiful proposals"), subheadline explaining QuoteKit's value, two CTAs (Sign in / Join your team), and an AI-generated hero image showing a clean proposal dashboard mockup displayed in a browser frame with a subtle gradient background and floating UI elements.

2. **Social proof bar** — "Trusted by 500+ teams" with placeholder logos (styled as muted text/shapes since we don't have real logos).

3. **Features grid** — 3-column grid highlighting key capabilities:
   - AI-powered content writing
   - One-click proposal sharing
   - Real-time client engagement tracking
   - Beautiful branded templates
   - Team collaboration
   - Analytics and insights
   Each with a Lucide icon, title, and short description.

4. **How it works** — 3-step visual flow: Create → Send → Win. Numbered steps with descriptions.

5. **CTA section** — Final call-to-action block with gradient background, headline, and buttons.

6. **Footer** — QuoteKit branding and copyright.

### AI-generated hero image

A backend function call will generate a hero illustration using the Lovable AI image generation model (`google/gemini-2.5-flash-image`). The image will depict a clean, modern proposal dashboard UI on a laptop/browser mockup — blue and white color scheme matching the brand. The generated image will be stored as a Lovable asset via `create_asset`.

### Technical approach

- **Single file change**: Rewrite `src/pages/Landing.tsx` from a simple centered card into a full scrollable marketing page.
- **Create one edge function**: `supabase/functions/generate-hero-image/index.ts` to generate the hero image (or generate it at build time and store as asset).
- **Styling**: All Tailwind — gradient backgrounds, responsive grid, smooth scroll animations using the existing `animate-fade-in` keyframe plus new CSS keyframes for staggered entrance.
- **New CSS keyframes** in `src/index.css`: `fade-in-up` with staggered delays for the features grid.
- **No new dependencies** — uses existing Lucide icons, Button, Card components.

### Design direction

Clean, minimal, professional (Linear/Notion-inspired per the design memory). Generous whitespace, muted accent backgrounds for alternating sections, the primary blue as the main accent color. Plus Jakarta Sans for all headings, DM Sans for body.

