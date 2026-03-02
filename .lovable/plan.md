

## Mobile Responsive Overhaul

### Scope

All pages and the shared layout need responsive updates. The main issues are:

1. **DashboardLayout nav** -- nav items are inline and cramped on mobile; needs a hamburger menu with a Sheet/drawer
2. **ProposalDetail header** -- action buttons overflow horizontally on mobile
3. **ProposalBuilder pricing** -- 12-column grid breaks on small screens
4. **ProposalBuilder review** -- 2-column grid needs to stack
5. **Settings** -- org form uses `grid-cols-2` without responsive prefix
6. **Clients dialog** -- form uses `grid-cols-2` without responsive prefix
7. **Tables** -- tables on Proposals, Clients, ClientDetail overflow on mobile; need horizontal scroll wrapper or card-based mobile layout
8. **Landing page** -- already mostly responsive, minor touch-target and button width tweaks
9. **Dashboard** -- header buttons need stacking on mobile

### Changes by File

**`src/components/DashboardLayout.tsx`**
- Add mobile hamburger menu using the Sheet component
- Hide inline nav on mobile (`hidden md:flex`), show hamburger trigger on mobile (`md:hidden`)
- Sheet contains full nav links + "New Proposal" button, all full-width with 44px min height
- Keep desktop nav unchanged

**`src/pages/ProposalDetail.tsx`**
- Wrap header in `flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`
- Stack action buttons: `flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3`
- Make buttons `w-full sm:w-auto`

**`src/pages/ProposalBuilder.tsx`**
- Pricing grid: change from `grid-cols-12` to stacked on mobile, `sm:grid-cols-12`
- On mobile, each line item becomes a vertical card with labeled fields
- Review grid: `grid-cols-1 sm:grid-cols-2`
- Step indicators: add labels on larger screens, keep dots on mobile
- Content section toolbar: wrap on mobile

**`src/pages/Dashboard.tsx`**
- Header: `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`
- "New Proposal" button: `w-full sm:w-auto`

**`src/pages/Proposals.tsx`**
- Header: stack on mobile
- Table: wrap in `overflow-x-auto` div
- "New Proposal" button: `w-full sm:w-auto`

**`src/pages/Clients.tsx`**
- Same header stacking pattern
- Table: `overflow-x-auto` wrapper
- Dialog form: `grid-cols-1 sm:grid-cols-2`

**`src/pages/ClientDetail.tsx`**
- Table: `overflow-x-auto` wrapper

**`src/pages/Settings.tsx`**
- Org form grids: `grid-cols-1 sm:grid-cols-2`
- TabsList: allow wrapping on mobile with `flex-wrap h-auto`
- Team table: `overflow-x-auto`

**`src/pages/Templates.tsx`**
- Header: stack on mobile
- Template dialog pricing items: stack vertically on mobile

**`src/pages/Landing.tsx`**
- Hero buttons: already `flex-col sm:flex-row` -- add `w-full sm:w-auto` to buttons
- CTA buttons: same treatment
- Nav padding: `px-4 sm:px-6`

**Auth pages (Login, Signup, ForgotPassword, ResetPassword)**
- Already centered cards with `max-w-md` -- mostly fine
- Ensure padding `px-4` on the wrapper

### Technical Details

- Mobile hamburger uses existing `Sheet` component (already installed via shadcn)
- Add `Menu` and `X` icons from lucide-react
- All tables get `<div className="overflow-x-auto">` wrapper
- All page headers follow pattern: `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`
- All primary action buttons: `w-full sm:w-auto`
- Touch targets: buttons already meet 44px via `h-10`/`h-11` defaults; Sheet nav items use `h-12`
- No new dependencies needed

