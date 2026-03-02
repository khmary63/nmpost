

## What's Already Built vs. What's Missing

### Already Built
- Auth (email + Google OAuth), Landing, Login, Signup, Forgot/Reset Password
- Database: organizations, departments, profiles, clients, proposals, line_items, templates, proposal_versions, proposal_events, user_roles — all with org-based RLS
- Dashboard with stats cards + recent proposals
- Proposals list with status filters and search
- Proposal Builder (5-step: Template → Client → Content → Pricing → Review)
- Proposal Detail page with status updates and share links
- Clients page with CRUD + search
- Templates page with category filters
- Settings page (profile, org, team, departments tabs)
- Public proposal view with event tracking
- DashboardLayout with nav

### Missing Features (from the original plan)

**1. AI Content Assistant**
- No AI integration exists yet
- Need a backend function using Lovable AI to generate/improve section content in the Proposal Builder
- "Improve writing" button per section, context-aware suggestions based on template type
- Pricing benchmark suggestions

**2. PDF Export**
- No export functionality
- Need a backend function to generate a PDF from proposal data
- Download button on ProposalDetail page

**3. Client Detail Page (`/clients/:id`)**
- Current Clients page is list-only with inline edit modal
- No dedicated detail page showing client info + all proposals sent to that client across agents

**4. Proposal Editing (existing proposals)**
- ProposalBuilder only creates new proposals — no editing of existing drafts
- Need `/proposals/:id/edit` or reuse the builder with pre-loaded data

**5. Drag-and-Drop Section Reordering**
- Content sections in the builder have no reorder capability

**6. Proposal Analytics / Charts**
- Dashboard has stat cards but no conversion rate charts or trend visualizations
- No proposal engagement analytics (view counts, time on page)

**7. Email Delivery**
- No ability to send proposals via email from within the app

**8. Real-time Notifications**
- No notification system when clients view/interact with proposals

### Recommended Priority Order

1. **Proposal editing** — high impact, currently can't edit drafts
2. **Client detail page** — complete the client management flow
3. **AI content assistant** — differentiating feature, uses Lovable AI (no API key needed)
4. **PDF export** — essential for a proposal tool
5. **Dashboard charts** — conversion rates over time using recharts (already installed)
6. **Drag-and-drop sections** — polish for the builder
7. **Email delivery & notifications** — nice-to-haves

### Implementation Approach

**Proposal editing**: Modify ProposalBuilder to accept an optional `:id` param, load existing proposal data, and update instead of insert on save. Add an "Edit" button on ProposalDetail.

**Client detail page**: New route `/clients/:id` showing client info card + table of all proposals for that client. Add a route in App.tsx and a new `ClientDetail.tsx` page.

**AI content assistant**: Create a backend function (`supabase/functions/ai-content/index.ts`) using the Lovable AI gateway. Add "Improve with AI" buttons to each section in the Content step of the builder. The function takes section title, template category, and current content, returns improved text.

**PDF export**: Create a backend function (`supabase/functions/generate-pdf/index.ts`) that renders proposal HTML to PDF. Add a "Download PDF" button on ProposalDetail.

**Dashboard charts**: Add a recharts area/bar chart to Dashboard.tsx showing proposals created per month and acceptance rates.

**Drag-and-drop**: Use native HTML drag events on sections in the Content step (no extra dependency needed).

