

## QuoteKit — Full MVP Implementation Plan

### 1. Foundation & Auth
- Set up Supabase with Lovable Cloud for backend
- Email/password + Google OAuth authentication
- User profiles table with company info (name, logo, branding colors, fonts)
- Clean, minimal design system (light backgrounds, subtle shadows, professional typography)
- Protected routes and auth guards

### 2. Database Schema
- **profiles**: company name, logo URL, brand colors, industry
- **clients**: name, email, company, phone, notes (linked to user)
- **templates**: name, category, sections JSON, default pricing items
- **proposals**: title, client_id, template_id, status (draft/sent/viewed/accepted/rejected), content JSON, pricing JSON, version number
- **proposal_versions**: snapshot of proposal at each save point
- **proposal_events**: tracking events (opened, downloaded, viewed duration)
- **line_items**: description, quantity, rate, discount, linked to proposal

### 3. Dashboard
- Overview cards: total proposals, pending, accepted, revenue
- Recent proposals list with status badges
- Recent client activity feed
- Quick-action buttons (New Proposal, Add Client)
- Charts showing proposal conversion rates over time

### 4. Client Management
- Client list with search and filters
- Client detail page with contact info and proposal history
- Create/edit client forms with validation

### 5. Template System
- 5 pre-built templates: Web Design, Consulting, Development, Marketing, General Services
- Each template has predefined sections (intro, scope, timeline, pricing, terms)
- Template preview cards with category filtering
- "Start from blank" option

### 6. Proposal Builder
- Step-by-step creation flow: Select template → Add client → Edit content → Set pricing → Review
- Drag-and-drop section reordering
- Rich text editing for each section
- Dynamic pricing calculator with line items, quantities, rates, discounts, tax
- Real-time total recalculation
- Auto-save with version history
- Brand customization applied automatically (logo, colors)

### 7. AI Content Assistant (Lovable AI)
- Edge function using Lovable AI gateway
- Context-aware suggestions for service descriptions based on project type
- "Improve writing" button for each text section
- Pricing benchmark suggestions based on industry

### 8. Proposal Preview & Export
- Full document preview matching the final output
- PDF export via edge function
- Shareable link generation (public proposal view page)
- Email delivery with SendGrid/built-in email

### 9. Proposal Tracking
- Unique tracking links for each sent proposal
- Public proposal view page that logs open/download events
- Real-time notifications on dashboard when clients interact
- Proposal status management (mark as accepted/rejected)

### 10. Responsive Design
- Desktop-optimized proposal builder
- Tablet-friendly layout for all pages
- Mobile-responsive dashboard and client management

### Pages
- `/` — Landing/marketing page
- `/login`, `/signup`, `/reset-password` — Auth pages
- `/dashboard` — Main dashboard
- `/clients` — Client list & management
- `/clients/:id` — Client detail
- `/templates` — Template gallery
- `/proposals/new` — Proposal builder
- `/proposals/:id` — Proposal editor
- `/proposals/:id/preview` — Proposal preview
- `/p/:shareId` — Public shareable proposal view (with tracking)
- `/settings` — Company profile & branding settings

