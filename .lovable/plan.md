

## Re-engineering QuoteKit: Single-Organization Internal Tool

### Current Problem
The platform is currently framed as a multi-tenant SaaS for individual freelancers/agencies. Each user is siloed — they only see their own clients, proposals, and data. The language throughout ("freelancers and agencies", "Get started free", "Sign up") reads like a public product.

### Target Model
One company deploys QuoteKit internally. Multiple team members (agents, departments) log in and create proposals on behalf of the organization. Shared clients, shared templates, org-wide reporting.

---

### 1. Database Changes

**New table: `organizations`**
- `id`, `name`, `logo_url`, `brand_primary_color`, `brand_secondary_color`, `brand_font`, `website`, `phone`, `address`, `industry`, `created_at`, `updated_at`
- Move branding/company fields OUT of `profiles` and INTO this single org record
- Seed with one default organization row

**New table: `departments`**
- `id`, `org_id` (FK → organizations), `name`, `created_at`

**Update `profiles` table**
- Add `org_id` (FK → organizations), `department_id` (FK → departments), `full_name`, `avatar_url`
- Remove company-level fields (company_name, brand_*, industry, website, address) — those live on the org now
- The `handle_new_user` trigger auto-assigns new users to the default org

**Update `clients` table**
- Change `user_id` → `org_id` (clients belong to the org, not individual users)
- Add `created_by` (UUID, tracks who added the client)
- RLS: all org members can view/manage clients

**Update `proposals` table**
- Keep `user_id` (the agent who created/owns the proposal)
- Add `org_id` (FK → organizations)
- Add `department_id` (FK → departments, optional)
- RLS: users see their own proposals + org admins see all org proposals

**Update `templates` table**
- Add `org_id` for org-specific templates (in addition to defaults)
- RLS: org members can view org templates + defaults

**New table: `user_roles`** (per security guidelines)
- `id`, `user_id`, `role` (enum: 'admin', 'manager', 'agent')
- Admins: manage org settings, see all proposals, manage users
- Managers: see department proposals, manage clients
- Agents: create/manage their own proposals, view shared clients

**Security definer function: `has_role()`** and **`get_user_org_id()`** for RLS policies

### 2. Rewording & Branding

**Landing page** → Becomes an internal welcome/login redirect page. No "Sign up free" marketing language. Instead: "Welcome to [OrgName] Proposal System — Sign in to continue."

**Login page** → "Sign in to your account" (remove "QuoteKit" SaaS branding, show org logo if configured)

**Signup page** → "Join your team" or potentially invite-only (admin creates accounts). Remove "Start creating stunning proposals today" generic copy.

**Dashboard** → "Your Proposals" focus. Add org-wide stats for admins. Replace "freelancers and agencies" language with "your team", "your organization".

**Nav items** → Add "Proposals" as explicit nav item. Rename as needed for internal tool feel.

### 3. Build Out Missing Pages

**Clients page** (`/clients`)
- Searchable/filterable list of org-wide clients
- Create/edit client modal or page
- Client detail page showing all proposals sent to that client (across all agents)

**Templates page** (`/templates`)
- Gallery of default + org templates with category filtering
- Template preview cards
- "Start from blank" option

**Proposals list page** (`/proposals`)
- All user's proposals with status filters, search, sorting
- Admins see org-wide view

**Proposal builder** (`/proposals/new`, `/proposals/:id`)
- Step flow: pick template → assign client → edit sections → set pricing → review
- Dynamic line items with real-time total calculation

**Settings page** (`/settings`)
- Organization settings (name, logo, branding) — admin only
- Profile settings (name, email, avatar) — all users
- Department management — admin only
- Team members list — admin only

**Public proposal view** (`/p/:shareId`)
- Read-only branded proposal page for clients
- Logs view/download events

### 4. RLS Policy Overhaul

All tables switch from per-user isolation to org-based access:
- `get_user_org_id(uid)` security definer function returns the user's org
- Clients: `org_id = get_user_org_id(auth.uid())`
- Proposals: owner sees own; admins/managers see org-wide via `has_role()`
- Templates: org members see org templates + defaults
- Profiles: users see own; admins see all org members

### 5. Implementation Order

1. **Migration**: Create `organizations`, `departments`, `user_roles` tables; alter `profiles`, `clients`, `proposals`, `templates`; create security definer functions; update all RLS policies
2. **Auth & context updates**: Update AuthContext to load org info and user role; update ProtectedRoute with role-based access
3. **Reword all pages**: Landing, Login, Signup, Dashboard — internal org language
4. **Build Clients pages**: list, detail, create/edit
5. **Build Templates page**: gallery with filters
6. **Build Proposals pages**: list, builder, preview
7. **Build Settings page**: org settings, profile, team management

### Technical Notes
- The `organizations` table will be seeded with a single row. This is a single-org deployment.
- User roles stored in separate `user_roles` table per security requirements (never on profiles).
- `has_role()` and `get_user_org_id()` as `SECURITY DEFINER` functions to avoid RLS recursion.
- All existing data will need migration — existing `user_id`-based records get the default `org_id`.

