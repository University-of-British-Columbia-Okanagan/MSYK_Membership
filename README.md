# MSYK Membership Management System

A comprehensive membership management platform built with React Router 7, TypeScript, and Prisma, designed to manage makerspace memberships, workshops, equipment bookings, and volunteer coordination.

This is the single source of truth for the project — setup, user documentation, architecture, database schema, route map, and development patterns. Both humans and agentic coding tools should read this file before making changes.

## Table of Contents

- [Local Development Setup](#local-development-setup)
- [Environment Variables & Configuration](#environment-variables--configuration)
- [User Documentation](#user-documentation)
- [Architecture Overview](#architecture-overview)
- [Core System Concepts](#core-system-concepts)
- [System Architecture & Database Schema](#system-architecture--database-schema)
- [Components Architecture](#components-architecture)
- [Backend Models & Data Layer](#backend-models--data-layer)
- [Development Patterns](#development-patterns)
- [Testing Strategy](#testing-strategy)
- [Complete Route Map](#complete-route-map)
- [Common Tasks](#common-tasks)
- [Further Documentation](#further-documentation)

## Local Development Setup

### Prerequisites

**Minimum Requirements:**
- Node.js 20+
- React 18+
- React DOM 18+

**Recommended (Latest as of 2025):**
- Node.js 22
- React 19
- React DOM 19
- npm 11
- PostgreSQL 17 with pgAdmin 4

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mysk-membership
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Database configuration**

   Create a `.env` file in the root directory. See [Environment Variables & Configuration](#environment-variables--configuration) for the complete list of required and optional variables.

   For Stripe: visit the [Stripe dashboard](https://dashboard.stripe.com) to get API keys. Use `sk_live_`/`pk_live_` for production and `sk_test_`/`pk_test_` for development.

4. **Database migration**
   ```bash
   npx prisma generate --schema prisma/schema.prisma
   npx prisma migrate dev
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5173`

### Development Commands

**Running the application:**
```bash
npm run dev              # Start development server (client + server concurrently)
npm run dev:client       # Start React Router dev client only
npm run dev:server       # Start server only
npm run build            # Production build
npm start                # Run production server
npm run typecheck        # Type check and generate React Router types
npm test                 # Run Jest tests
```

**Database operations:**
```bash
# Generate Prisma client (required after schema changes)
npx prisma generate --schema prisma/schema.prisma

# Create and apply migrations
npx prisma migrate dev

# Seed database with test data (requires NODE_ENV=development)
npx tsx seed.ts

# Open Prisma Studio (visual database manager)
npx prisma studio
```

## Environment Variables & Configuration

### Required Environment Variables

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA"
SESSION_SECRET=          # Cookie encryption key (session expiry: 3 hours)
STRIPE_SECRET_KEY=       # Stripe secret key (sk_live_... or sk_test_...)
STRIPE_PUBLIC_KEY=       # Stripe publishable key (pk_live_... or pk_test_...)
BASE_URL=                # Application base URL (dev: http://localhost:5173)
WAIVER_ENCRYPTION_KEY=   # AES key for waiver PDF encryption
JWT_SECRET=              # Secret for password reset JWT tokens (1-hour expiry)

MAILGUN_API_KEY=         # Mailgun API key
MAILGUN_DOMAIN=          # Mailgun sending domain
MAILGUN_FROM_EMAIL=      # "From" email address
```

### Optional Integration Variables

```env
# Google Calendar Integration
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=   # OAuth callback URL
GOOGLE_OAUTH_ENCRYPTION_KEY= # AES key for storing OAuth refresh token (min 32 chars)

# Brivo Door Access Control (first five required for Brivo to activate)
BRIVO_CLIENT_ID=             # Brivo OAuth2 client ID
BRIVO_CLIENT_SECRET=         # Brivo OAuth2 client secret
BRIVO_USERNAME=              # Brivo account username (for password grant)
BRIVO_PASSWORD=              # Brivo account password (for password grant)
BRIVO_API_KEY=               # Brivo API key (sent as api-key header)
BRIVO_BASE_URL=              # Optional; Brivo API host (normalized, then /v1/api appended; default: https://api.brivo.com/v1/api)
BRIVO_AUTH_BASE_URL=         # Optional; Brivo OAuth base URL (default: https://auth.brivo.com)
BRIVO_WEBHOOK_SECRET=        # Optional; HMAC secret for webhook signature verification
BRIVO_ACCESS_GROUP_LEVEL4=   # Optional; comma-separated Brivo group IDs (fallback if not set in AdminSettings)
```

Missing any of the five required Brivo variables disables the integration gracefully (warnings logged, no errors thrown).

### Stripe Environment Notes

- Live keys (`sk_live_`/`pk_live_`) for production; test keys (`sk_test_`/`pk_test_`) for development
- After switching Stripe keys, all `stripeProductId` values in the DB must be cleared and re-synced via Admin Settings → Stripe Products → Clear & Re-sync

## User Documentation

### For Unregistered Users (Guests)

**Public Website Access:**
- View public pages: Home, About, Programming, Spaces & Services, Get Involved
- Access information about workshops, equipment, and membership plans
- View event calendar and past workshops
- Contact information and staff details

**Registration Process:**
1. Navigate to `/register` to create an account
2. Fill in personal information, emergency contacts, and consent forms
3. Complete required consent agreements (media, data privacy, community guidelines, operations policy)
4. Optionally sign a digital waiver (PDF generated and encrypted on-server)
5. On success, redirected to `/login?registered=true` — a green confirmation banner appears on the login page

### For Registered Users (Members)

**Dashboard Access:**
After login, users are redirected to role-appropriate dashboards:
- Regular users: `/dashboard/user`
- Admins: `/dashboard/admin`

**Core Features:**

**Workshop Management:**
- Browse available workshops and orientations in `/dashboard/workshops`
- Register for workshops with automatic prerequisite checking
- View workshop details, pricing variations, and capacity information
- Handle multi-day workshops with connected occurrences
- Cancel registrations within the allowed timeframe
- Access workshop history and completion status in `/dashboard/myworkshops`

**Equipment Booking System:**
- View all available equipment in `/dashboard/equipments`
- Book equipment slots through time-based booking grid in `/dashboard/equipmentbooking/:id`
- Check equipment prerequisites and completion status
- View personal equipment bookings in `/dashboard/myequipments`
- Role-based access restrictions for Level 3 and Level 4 users

**Membership Management:**
- View and manage membership plans in `/dashboard/memberships`
- Upgrade, downgrade, or cancel memberships
- Automated billing with Stripe integration (monthly, quarterly, semiannual, or yearly cycles)
- Toggle auto-renew on/off from the Profile page (requires saved payment method)
- Membership status tracking and next billing date display
- Sign membership agreement forms (PDF generated and downloadable)

**Profile & Volunteer System:**
- Manage personal profile information in `/dashboard/profile`
- Update avatar, phone, emergency contacts
- Log volunteer hours with approval workflow in `/dashboard/volunteer`
- Track volunteer status and activity history
- Update payment information at `/user/profile/paymentinformation`
- Download signed waiver and membership agreement PDFs

**Payment Integration:**
- Secure payment processing through Stripe
- Saved payment methods for recurring charges and quick checkout
- GST calculation included in all payments
- Payment success confirmations at `/dashboard/payment/success`

### For Administrators

**Extended Dashboard Features:**

**User Management:**
- View all registered users in `/dashboard/admin/users`
- Modify user roles and permission levels (`allowLevel4` flag)
- Track volunteer status across all users
- Revoke or unrevoke membership access with custom messages
- View Brivo sync status and retry failed syncs

**Workshop Administration:**
- Create new workshops in `/dashboard/addworkshop`
- Edit existing workshops in `/dashboard/editworkshop/:workshopId`
- Offer workshops again with new occurrence scheduling in `/dashboard/workshops/offer/:id`
- Manage workshop pricing variations in `/dashboard/workshops/pricevariations/:workshopId`
- View registrations per workshop at `/dashboard/admin/workshop/:workshopId/users` with:
  - **Result filter** — show only passed / failed / pending / cancelled registrations
  - **Date filter** — show only users who attended on a specific occurrence date (useful for bulk-passing an orientation session)
  - **Sort** — by last name, first name, registration date, or occurrence date(s); ascending or descending
  - Multi-day workshops show a collapsible row with per-day results; all filters work across both single-day and multi-day workshops
  - **Cancel Registration** — kebab menu (⋮) per row lets admins cancel any individual user's registration; works for all workshop types (single-day, multi-day, with/without price variations); sends a distinct admin-cancellation email to the user; creates a `WorkshopCancelledRegistration` audit record with `cancelledByAdmin: true` (always shows as "Yes" in Cancelled Events tab)
  - **Move Registration** — move a user from one occurrence of the workshop to another (`moveUserWorkshopRegistration()`, `actionType: "moveRegistration"`). The move is rejected unless the target occurrence belongs to the same workshop, has status `active`, is single-day (`connectId` is null), is not already booked by that user, and has capacity — including capacity on the user's existing price variation. The registration keeps its price variation, and `sendAdminWorkshopMoveEmail` notifies the user of the old and new dates
- Mark registrations passed/failed/pending, individually (`updateRegistrationResult()`) or in bulk via "Pass All" (`updateMultipleRegistrations()`) — handled by the action in `routes/dashboard/admindashboardlayout.tsx`
- Cancel workshop occurrences and price variations

**Equipment Administration:**
- Add new equipment in `/dashboard/addequipment`
- Edit equipment details and availability in `/dashboard/equipment/edit/:id`
- Configure equipment prerequisites and booking restrictions
- Monitor all equipment bookings in `/dashboard/allequipmentbooking`
- Duplicate equipment items

**System Configuration (`/dashboard/admin/settings`):**
- GST percentage for all payments
- Workshop and equipment visibility windows
- Google Calendar integration (connect/disconnect via OAuth)
- Brivo access group configuration
- Stripe Product Sync — bulk sync all workshops, equipment, and membership plans to Stripe; Clear & Re-sync when switching Stripe environments
- Planned closures and operational hours
- Volunteer hour approval workflow

**Reporting & Monitoring:**
- Access system reports in `/dashboard/admin/reports`
- View Winston server logs in `/dashboard/logs`
- Monitor issue reports and user feedback in `/dashboard/report`
- Access card management and logs in `/dashboard/accesslogs`

## Architecture Overview

### Technology Stack

**Backend:**
- React Router 7 (SSR) + Node.js
- TypeScript
- Prisma ORM + PostgreSQL
- Stripe — `stripe` v17 SDK, pinned to API version `2025-02-24.acacia` in every client instantiation
- Mailgun (transactional email, via `mailgun.js`)
- Winston (structured logging) → `logs/error.log` and `logs/all_logs.log`
- node-cron + setInterval (background jobs)
- Session-based authentication with encrypted cookies (3-hour expiry)

**Frontend:**
- React 19 + TypeScript
- Tailwind CSS + shadcn/ui (New York variant)
- React Hook Form + Zod
- FullCalendar (@fullcalendar/*)
- @tanstack/react-table

**External Integrations:**
- Stripe (payments + product catalog)
- Mailgun (email notifications)
- Google Calendar API (optional, workshop event sync)
- Brivo API (optional, door access control)
- Google OAuth (for Calendar integration)

### Project Structure

**Root Level:**
- `prisma/schema.prisma` — Database schema
- `package.json` — Dependencies and scripts
- `app/routes.ts` — Application routing configuration
- `seed.ts` — Database seed script
- `tests/`, `test-scripts/` — Jest tests and test-data scripts

**Application Structure:**
```
app/
├── routes/              # File-based routing (configured in app/routes.ts)
│   ├── _index.tsx
│   ├── home.tsx
│   ├── authentication/  # Login, register, password reset, logout
│   ├── about/           # About, board, staff, contact
│   ├── programming/     # Workshop calendar, events, special programs
│   ├── spaceandservices/# Spaces, equipment info, rentals, fabrication
│   ├── getinvolved/     # Volunteer, job opportunities
│   ├── api/             # Server-side API endpoints
│   ├── dashboard/       # Protected user/admin routes
│   └── brivo.callback.tsx       # Brivo webhook endpoint
│
├── models/              # Server-side business logic (*.server.ts)
│   ├── user.server.ts           # User management, role sync cron
│   ├── workshop.server.ts       # Workshop lifecycle, registration, occurrence status cron
│   ├── equipment.server.ts      # Equipment booking and management
│   ├── membership.server.ts     # Membership plans, billing cron, revocation
│   ├── payment.server.ts        # Stripe integration, checkout, refunds
│   ├── profile.server.ts        # User profiles, volunteer hours
│   ├── admin.server.ts          # Admin settings, Google Calendar config, planned closures
│   ├── access_card.server.ts    # Access card management
│   ├── accessLog.server.ts      # Access log tracking
│   └── issue.server.ts          # Issue reporting with screenshot uploads
│
├── services/            # External service integrations (*.server.ts)
│   ├── brivo.server.ts               # Brivo API client
│   ├── access-control-sync.server.ts # Door access sync logic
│   └── stripe-sync.server.ts         # Stripe Product sync
│
├── utils/               # Utilities and helpers
│   ├── session.server.ts        # Auth, session management, register, login, waiver
│   ├── db.server.ts             # Prisma client instance (singleton)
│   ├── email.server.ts          # All transactional emails via Mailgun
│   ├── googleCalendar.server.ts # Google Calendar OAuth + event CRUD
│   └── singleton.server.ts      # Server singleton pattern helper
│
├── layouts/             # Shared layout components
│   ├── DashboardLayout.tsx
│   └── MainLayout.tsx
│
├── components/          # UI components (see Components Architecture)
│   ├── data-table.tsx   # Generic TanStack Table wrapper
│   └── ui/
│       └── Dashboard/   # Dashboard-specific components
│
├── schemas/             # Zod validation schemas
│   ├── registrationSchema.tsx
│   ├── loginSchema.tsx
│   ├── resetPasswordSchema.tsx
│   ├── workshopFormSchema.tsx
│   ├── workshopOfferAgainSchema.tsx
│   ├── equipmentFormSchema.tsx
│   ├── membershipPlanFormSchema.tsx
│   ├── membershipAgreementSchema.tsx
│   └── bookingFormSchema.tsx
│
├── config/              # Application configuration
│   └── access-control.ts  # DOOR_PERMISSION_ID, getBrivoGroupsForRole, requiresDoorPermission
│
├── hooks/
│   └── use-mobile.tsx   # Viewport breakpoint hook used by the sidebar
│
├── lib/
│   └── utils.ts         # `cn()` class-name helper (shadcn convention)
│
└── logging/
    └── logger.ts          # Winston logger instance (logs/error.log, logs/all_logs.log)

prisma/
└── schema.prisma        # Database schema and models
```

### Routing Convention

React Router 7 uses file-based routing configured in `app/routes.ts`. Routes export `loader` functions for data fetching and `action` functions for mutations. Both `~` and `@` aliases point to the `app/` directory (configured in `vite.config.ts` and `tsconfig.json`).

### Server-Side Code Convention

All server-side code uses the `*.server.ts` naming convention. These files:
- Execute only on the server (never bundled to client)
- Handle database operations via Prisma
- Implement business logic and data validation
- Manage external service integrations (Stripe, email, Google Calendar, Brivo)

## Core System Concepts

### Role-Based Access Control (RBAC)

- **Roles:** User (roleUserId: 1) and Admin (roleUserId: 2)
- **Role Levels:** Dynamically calculated based on user's membership and workshop completion status:
  - **Level 1**: Registered user only (no orientation completed)
  - **Level 2**: Registered + completed orientation (no active membership)
  - **Level 3**: Registered + completed orientation + active membership
  - **Level 4**: Registered + completed orientation + active membership with `needAdminPermission` plan + admin-granted `allowLevel4` flag
  - All conditions are strict AND chains — e.g. active membership without orientation = Level 1, not Level 3
- **Special Flag:** `allowLevel4` — Boolean flag that must be explicitly granted by admin for Level 4 access
- **Access Requirements:** Most equipment requires Level 3+, some require Level 4 with the flag
- Role checks are enforced in loaders/actions and at the model layer
- **Role Level Sync Cron:** `startRoleLevelSyncCron()` in `app/models/user.server.ts` — runs every 15 seconds (`*/15 * * * * *`), corrects any drift across all users in a single batched DB query

### Cron Jobs

Three background jobs are started from `entry.server.ts` (the server process, run by `npm run dev:server`). They start automatically when the server starts:

| Job | Function | Schedule | File |
|-----|----------|----------|------|
| Role level sync | `startRoleLevelSyncCron()` | Every 15 seconds (node-cron `*/15 * * * * *`) | `app/models/user.server.ts` |
| Membership billing | `startMonthlyMembershipCheck()` | Daily at midnight (node-cron `0 0 * * *`) | `app/models/membership.server.ts` |
| Workshop status update | `startWorkshopOccurrenceStatusUpdate()` | Every 1 second (setInterval) | `app/models/workshop.server.ts` |

The workshop status job runs immediately on startup and then every 1 second, keeping `WorkshopOccurrence.status` up-to-date as time passes.

### Workshop System Architecture

**Workshop Offer Pattern:** Workshops use an `offerId` on `WorkshopOccurrence` to group occurrences:
- Each workshop can have multiple "offers" (sets of scheduled occurrences)
- Users see only the latest active offer when browsing
- Historical data is preserved across offers
- Use `offerWorkshopAgain()` to create new offers without losing registration history

**Workshop Types:**
- **Workshop**: Regular training sessions
- **Orientation**: Prerequisite training for equipment access (affects role level calculation)

**Prerequisites:** Workshops can require completion of other workshops via the `WorkshopPrerequisite` table. Always validate prerequisites before allowing registration.

**Multi-day Workshops:** Connected via shared `connectId` on `WorkshopOccurrence`. All occurrences must be registered together as a single unit.

**Registration Rules:**
- **Cutoff Time**: `Workshop.registrationCutoff`, in minutes before start (schema default 60). Set per-workshop from Admin Settings via `updateWorkshopCutoff()`; enforced in the UI in `workshopdetails.tsx` and server-side in `payment.tsx`
- **Capacity**: Tracked per occurrence or across multi-day series
- **Price Variations**: `WorkshopPriceVariation` records with individual capacity limits
- **Cancellation Policy**: Refund eligible if cancelled at least 48 hours before the workshop start time (eligibility checked in Cancelled Events tab in Admin Settings). The policy text is hardcoded in `app/routes/dashboard/workshopdetails.tsx` — the `Workshop.cancellationPolicy` DB field exists but is no longer rendered in the UI

### Google Calendar Integration (Optional)

When an admin connects their Google Calendar account via OAuth, workshop occurrences are automatically created as calendar events. Events are updated or deleted when occurrences change.

- Workshop create/edit/delete automatically creates/updates/deletes Google Calendar events
- `googleEventId` stored on `WorkshopOccurrence` to track the linked event
- OAuth flow via `/api/google-calendar/connect` → callback → disconnect; admin connects via Admin Settings → Google Calendar tab
- Refresh token stored AES-encrypted in `AdminSettings` (`google_oauth_refresh_token_enc`)
- Requires: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_OAUTH_ENCRYPTION_KEY`

### Equipment Booking System

- **Time-based slots:** 30-minute intervals stored in `EquipmentSlot`
- **Prerequisites:** Equipment access requires completed workshop prerequisites (via `EquipmentPrerequisite`)
- **Role restrictions:** Most equipment requires Level 3+, some require Level 4 with `allowLevel4` flag
- **Booking Features:**
  - Bulk booking support (multiple slots in one transaction)
  - Real-time availability checking
  - Payment via Stripe Checkout or saved card
- **Cancellation Policy:** Eligible for refund if cancelled 2+ days before slot start
  - Partial refunds supported (cancel selected slots from bulk booking)
  - Cancellation record created in `EquipmentCancelledBooking`
- **Conflict detection:** Check availability across all active workshop offers to prevent double-booking
- **Workshop integration:** Equipment can be bulk-booked during workshop registration (`bookedFor: "workshop"`)
- **Schedule restrictions:** Role level-specific time restrictions via `getLevel3ScheduleRestrictions()` and `getLevel4UnavailableHours()` in equipment model

### Membership System

- **Plans:** Defined in `MembershipPlan` with JSON-stored features; `needAdminPermission` flag for Level 4 plans
- **Billing Cycles:** Monthly, quarterly (3 months), semiannually (6 months), yearly (stored in `UserMembership.billingCycle`)
- **Auto-Renew:** Configurable per subscription (defaults to `true` for backward compatibility)
  - When `autoRenew=true`: Membership auto-renews with saved payment method at term end
  - When `autoRenew=false`: Membership expires at term end without charging, status set to "inactive"
  - Toggle on Profile page allows members to enable/disable auto-renew on an active membership (requires payment method)
  - Removing a payment method automatically sets `autoRenew=false` on all active memberships
  - UI treats `autoRenew` as `false` when no payment method is on file, regardless of DB value
- **Membership Agreement Forms:** `UserMembershipForm` tracks signed agreements (encrypted AES signature); status mirrors subscription lifecycle (`pending → active → cancelled/ending/inactive`); downloadable as PDFs
- **Automated Processing:** Daily cron job at midnight (`0 0 * * *`) via `startMonthlyMembershipCheck()` processes due memberships
  - Payment reminders sent 24 hours before charge (only for auto-renew enabled, `autoRenew=true`)
  - Missing payment method sets membership to "inactive" and sends notification
- **Changes:** Support upgrade/downgrade with prorated billing (monthly→monthly only)
  - **Upgrade**: Prorated charge, immediate activation, old membership marked "ending"
  - **Downgrade**: Scheduled at next payment date, old membership "ending", new "active" at transition
- **Cancellation:** Status "cancelled", access retained until `nextPaymentDate`, then deleted
- **Revocation (Admin):** Admin can globally ban users from all memberships with custom message
  - All memberships set to "revoked" status, user cannot resubscribe until admin unrevokes
  - `membershipStatus`, `membershipRevokedAt`, `membershipRevokedReason` stored on `User`
  - Revocation and unrevocation emails sent via `sendMembershipRevokedEmail` / `sendMembershipUnrevokedEmail`
- **Access Control:** Membership status affects role levels and equipment access

### Stripe Product Sync

Each workshop, membership plan, and equipment item is automatically linked to a named Stripe Product. This enables Stripe coupons to be restricted to specific items (e.g., "LASER20" only applies to the Laser Cutter workshop).

- **Schema:** `stripeProductId String?` on `Workshop`, `MembershipPlan`, and `Equipment` models
- **Service:** `app/services/stripe-sync.server.ts`
  - `syncWorkshopToStripe(id)` — creates or updates Stripe Product for a workshop
  - `syncMembershipPlanToStripe(id)` — creates or updates Stripe Product for a membership plan
  - `syncEquipmentToStripe(id)` — creates or updates Stripe Product for equipment
  - `archiveStripeProduct(stripeProductId)` — marks Stripe Product inactive (used on delete; items are archived, not deleted)
  - `bulkSyncToStripe(clearExisting = false)` — syncs all three categories in one pass; `clearExisting: true` backs the Clear & Re-sync action
- **Auto-Sync Hooks:** Called non-blocking (`.catch()`) from model create/update/delete functions in workshop, membership, and equipment models
- **Checkout:** `payment.server.ts` and `payment.tsx` use `price_data.product` when `stripeProductId` exists, falling back to inline `price_data.product_data` if not set
- **Admin API:** `POST /api/stripe-sync` with actions: `bulkSync`, `clearAndResync`, `getSyncStatus`
- **Admin UI:** Admin Settings → "Stripe Products" tab — Sync All, Clear & Re-sync buttons with status display
- **Metadata:** Each Stripe Product has `{ portal_type: "workshop"|"membership"|"equipment", portal_id: "N" }` for dashboard identification
- **Environment note:** `stripeProductId` values are Stripe account-specific. Switching between test/live keys requires a Clear & Re-sync
- A point-in-time write-up of the original implementation is kept in [docs/implementations/](./docs/implementations/); this section is the maintained description

### Volunteer Management

- **Time Logging:** `VolunteerTimetable` with approval workflow (pending → approved/denied → resolved)
- **Fields:** `isResubmission` flag for resubmitted entries; `previousStatus` tracks prior state
- **Overlap Detection:** `checkVolunteerHourOverlap()` prevents duplicate time entries for the same period
- **Resubmission:** Denied entries can be modified and resubmitted
- **Volunteer Periods:** `Volunteer` model tracks volunteer start/end dates; `updateUserVolunteerStatus()` manages active periods

### Payment Integration

- **Stripe:** Primary payment processor (API version: `2025-02-24.acacia`)
- **Two checkout methods:**
  - **Stripe Checkout Session** (`createCheckoutSession`): Full hosted payment flow with card input; GST and billing cycle price applied server-side
  - **Quick Checkout** (`quickCheckout`): One-click purchases using saved payment method via `PaymentIntent`
- **Payment Methods:** Stored via Stripe customer IDs; card tokenized via `stripe.tokens.create`; saved in `UserPaymentInformation`
- **Payment Types:**
  - Workshop registration (single or multi-day), with optional price variation
  - Equipment booking (single slot or bulk)
  - Membership subscription (new, upgrade proration, resubscription, downgrade)
- **GST Handling:**
  - Dynamic GST percentage from admin settings (`gst_percentage`, default: 5%)
  - GST calculated and included in all payment amounts
  - GST metadata stored in Stripe payment intents (`original_amount`, `gst_amount`, `gst_percentage`)
  - Membership confirmation emails show GST-inclusive price with breakdown
- **Refunds:** `refundWorkshopRegistration`, `refundEquipmentBooking`, `refundMembershipSubscription` in `payment.server.ts`
- **Coupon Restrictions:** Enabled by Stripe Product Sync — Stripe coupons can be restricted to specific portal items once linked to a Stripe Product

### Brivo Access Control Integration (Optional)

**Two Separate Door Access Systems:**
- **Brivo** — controls the physical door lock. Automatically provisioned/revoked for Level 4 members based on membership + role level via `syncUserDoorAccess()`
- **ESP32 + local fobs** — used for equipment sign-in/out logging. Fobs assigned at orientation; `accessCard.permissions` are **admin-managed only** and are **never auto-modified** by any sync trigger

**Brivo Access Requirements:**
- Active membership subscription (`UserMembership.status = "active"`)
- Membership status not `"revoked"` (`User.membershipStatus`)
- Role level ≥ 4 (`requiresDoorPermission(roleLevel)` in `app/config/access-control.ts`)
- Configured Brivo access groups (`brivo_access_group_level4` in AdminSettings)

**Automatic Sync Triggers — `syncUserDoorAccess()` is called when:**
- New membership subscription registered (`registerMembershipSubscription()`)
- Membership plan deleted (`deleteMembershipPlan()`) — resyncs every affected member
- Membership cancelled (`cancelMembership()`)
- User role level updated (`updateUserRole()`)
- User `allowLevel4` flag updated (`updateUserAllowLevel()`)
- Admin revokes membership (`revokeUserMembershipByAdmin()`)
- Admin unrevokes membership (`unrevokeUserMembershipByAdmin()`)
- Automated billing cron updates role levels (`startMonthlyMembershipCheck()`)
- Role level sync cron corrects incorrect levels (`startRoleLevelSyncCron()`)
- Membership refund processed (`refundMembershipSubscription()`)

**Integration Features:**
- Brivo person record creation/updates (firstName, lastName, email, phone)
- Access group assignment based on role level
- Mobile pass credential generation and invitation email via Brivo
- Automatic access revocation on membership changes
- Webhook-based access event logging (enter/exit/denied) via `/brivo/callback`

**Error Handling:**
- Sync errors stored in `User.brivoSyncError` field
- Admin can retry sync from Admin Settings UI
- Graceful degradation when Brivo not configured (warnings logged, no errors thrown)
- Webhook signature verification via HMAC SHA256 (`BRIVO_WEBHOOK_SECRET`)

**Required Brivo Env Vars (all must be set for Brivo to be enabled; missing any disables integration gracefully):**
`BRIVO_CLIENT_ID`, `BRIVO_CLIENT_SECRET`, `BRIVO_USERNAME`, `BRIVO_PASSWORD`, `BRIVO_API_KEY`
Optional: `BRIVO_BASE_URL` (default: `https://api.brivo.com/v1/api` — any host you supply is normalized and `/v1/api` appended), `BRIVO_AUTH_BASE_URL` (default: `https://auth.brivo.com`), `BRIVO_WEBHOOK_SECRET`, `BRIVO_ACCESS_GROUP_LEVEL4`

**Key Files:**
- `app/services/brivo.server.ts` — Brivo API client (OAuth, person management, groups, mobile passes)
- `app/services/access-control-sync.server.ts` — Sync logic; `syncUserDoorAccess()`
- `app/config/access-control.ts` — `DOOR_PERMISSION_ID = 0`, `requiresDoorPermission()`, `getBrivoGroupsForRole()`
- `app/routes/brivo.callback.tsx` — Webhook endpoint for access events
- `app/models/access_card.server.ts` — Card management: `getAccessCardByUUID`, `getAccessCardByEmail`, `getAccessCardByBrivoCredentialId`, `updateAccessCard`

See [docs/apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md](./docs/apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md) for the Brivo API reference.

## System Architecture & Database Schema

### Core Models

#### User Management
- **User**: Central user entity — personal info, emergency contacts, four consent booleans (`mediaConsent`, `dataPrivacy`, `communityGuidelines`, `operationsPolicy`), `roleLevel`, `allowLevel4`, `avatarUrl`, encrypted `waiverSignature`, revocation fields (`membershipStatus` — `"active"`/`"revoked"`, `membershipRevokedAt`, `membershipRevokedReason`), and Brivo sync fields (`brivoPersonId`, `brivoLastSyncedAt`, `brivoSyncError`)
- **RoleUser**: Role definitions — User (id: 1) and Admin (id: 2)
- **UserPaymentInformation**: Stripe customer and payment method storage

#### Membership System
- **MembershipPlan**: Subscription plans — `title`, `description`, four price columns (`price` monthly, plus nullable `price3Months`, `price6Months`, `priceYearly`), `feature` (Json, singular), `needAdminPermission` flag, `stripeProductId`
- **UserMembership**: Active subscriptions — status, billingCycle, nextPaymentDate, autoRenew, paymentIntentId
- **UserMembershipForm**: Signed membership agreements — encrypted signature, status lifecycle

#### Workshop & Training System
- **Workshop**: Workshop definitions — pricing, capacity, type (workshop/orientation), registrationCutoff, `stripeProductId`
- **WorkshopOccurrence**: Scheduled instances — `startDate`/`endDate` plus nullable `startDatePST`/`endDatePST`, `status`, `connectId` (multi-day), `offerId` (default 1), `googleEventId`. Status values actually written by the app are `"active"` (default), `"past"` (set by the 1-second cron once `startDate` passes), and `"cancelled"` — the `// "open", "closed", "cancelled"` comment in `schema.prisma` is stale
- **UserWorkshop**: Enrollment records — `result` (`"passed"` default, `"failed"`, `"pending"`, `"cancelled"`), `date`, `paymentIntentId`, `priceVariationId`
- **WorkshopPrerequisite**: Prerequisite chains between workshops
- **WorkshopPriceVariation**: Alternative pricing tiers with individual capacity limits
- **WorkshopCancelledRegistration**: Cancellation audit trail — `registrationDate`, `cancellationDate`, `paymentIntentId`, `resolved`, `cancelledByAdmin`

#### Equipment Management
- **Equipment**: Equipment inventory — availability, `stripeProductId`
- **EquipmentSlot**: 30-minute time slots — `startTime`/`endTime`, `isAvailable`, `isBooked`, optional `workshopOccurrenceId`
- **EquipmentBooking**: Booking records — `status` (default `"pending"`), `bookedFor` (`"user"` or `"workshop"`), `paymentIntentId`, optional `workshopId`
- **EquipmentPrerequisite**: Workshop prerequisites required for equipment access
- **EquipmentCancelledBooking**: Cancellation records — `totalSlotsBooked`, `slotsRefunded`, `totalPricePaid`, `priceToRefund`, `eligibleForRefund` (computed from the 2-day rule at cancellation time), `resolved`, and slot-level detail in JSON `cancelledSlotTimes`

#### Access Control
- **AccessCard**: Fob/card records — permissions (Int[]), `brivoCredentialId`, `brivoMobilePassId`; linked to user
- **AccessLog**: Event log — `accessCardId`, optional `userId`, `equipment` (equipment or door name), `state` (`"enter"`, `"exit"`, or `"denied"`), `createdAt`

#### Volunteer Management
- **Volunteer**: Volunteer period tracking — volunteerStart, volunteerEnd
- **VolunteerTimetable**: Time log entries — `startTime`, `endTime`, `description`, `status` (`"pending"` default, `"approved"`, `"denied"`, `"resolved"`), `isResubmission`, `previousStatus`

#### Administrative Tools
- **AdminSettings**: Key-value system configuration store
- **Issue**: User-reported issues — `title`, `description`, `status` (`"open"` default, `"in_progress"`, `"resolved"`), `priority` (default `"medium"`; the form field is named `severity`), `reportedById`
- **IssueScreenshot**: Screenshot attachments for issues (stored at `public/uploads/issues/`, max 5MB, max 5 per issue)

### Key Features & Relationships

**Role-Based Access Control:**
- Role levels 1-4 with strict AND chain requirements
- `allowLevel4` flag for admin-granted advanced access
- `startRoleLevelSyncCron()` corrects drift every 15 seconds

**Workshop Offer System:**
- `offerId` on `WorkshopOccurrence` groups scheduling rounds
- Users see only the latest active offer
- Historical data preserved across offers

**Cascade Deletions:**
- User deletion cascades to all bookings, memberships, volunteer records, access cards, logs

**Unique Constraints:**
- One registration per user per occurrence — `@@unique([userId, occurrenceId])` on `UserWorkshop`
- One payment information record per user — `@@unique` on `UserPaymentInformation.userId`
- One prerequisite edge per pair — `@@unique([workshopId, prerequisiteId])` on `WorkshopPrerequisite`, `@@unique([equipmentId, workshopPrerequisiteId])` on `EquipmentPrerequisite`
- One price variation name per workshop — `@@unique([workshopId, name])` on `WorkshopPriceVariation`
- `brivoPersonId` on `User`, and `brivoCredentialId` / `brivoMobilePassId` on `AccessCard`
- **`EquipmentBooking` has no unique constraint on `slotId`.** The `@@unique([slotId])` line is deliberately commented out in the schema so that a cancelled booking and a new booking can coexist for the same slot. Double-booking is prevented in application code (`EquipmentSlot.isBooked` plus availability checks), not by the database

**Soft Deletion:**
- Some entities use status flags instead of hard deletes (memberships: "inactive", "ending", "cancelled", "revoked")

**Indexes:**
- Applied to frequently queried fields (userId, workshopId, createdAt, etc.)

### Database Relationships

- **One-to-Many**: User → UserMembership, User → UserWorkshop, User → EquipmentBooking, User → AccessCard
- **Many-to-Many**: Workshop ↔ Workshop (prerequisites via WorkshopPrerequisite), Equipment ↔ Workshop (via EquipmentPrerequisite)
- **Cascade Deletions**: User → bookings, memberships, volunteer records, access cards, logs
- **Unique Constraints**: Prevent duplicate workshop registrations, duplicate prerequisite edges, and duplicate price variation names. Equipment slot double-booking is enforced in application code, not by a DB constraint

### Prisma Query Patterns

- Use `include` to load relationships (avoid N+1 queries)
- Use `select` when only specific fields are needed
- Transaction blocks for operations requiring atomicity
- Generated types provide compile-time safety

### AdminSettings Keys

Key-value configuration storage for system-wide settings:

| Key | Default | Description |
|-----|---------|-------------|
| `gst_percentage` | `"5"` | GST percentage for all payments |
| `workshop_visibility_days` | `"60"` | How far in advance workshops are visible |
| `equipment_visible_registrable_days` | `"7"` | Equipment booking window in days |
| `past_workshop_visibility` | `"180"` | Days of past workshop history to show |
| `google_calendar_id` | `""` | Selected Google Calendar ID |
| `google_calendar_timezone` | `"America/Yellowknife"` | Timezone for Google Calendar events |
| `google_oauth_refresh_token_enc` | `""` | AES-encrypted Google OAuth refresh token |
| `brivo_access_group_level4` | `""` | Comma-separated Brivo group IDs for Level 4 access (falls back to the `BRIVO_ACCESS_GROUP_LEVEL4` env var) |
| `planned_closures` | `""` | JSON array of planned closure periods (managed via `getPlannedClosures`/`updatePlannedClosures`) |
| `level3_start_end_hours` | `""` | JSON map of weekday → `{ start, end }` booking hours for Level 3 users. Empty falls back to 9–17 every day (`getLevel3ScheduleRestrictions()`) |
| `level4_unavaliable_hours` | *(unset)* | JSON `{ start, end }` window during which Level 4 users cannot book. Unset falls back to `{ start: 0, end: 0 }` — no restriction. **Note the misspelling `unavaliable` in the key** — it must be matched exactly (`getLevel4UnavailableHours()`) |
| `max_number_equipment_slots_per_day` | `"4"` | Maximum equipment slots a user may book in one day |
| `max_number_equipment_slots_per_week` | `"14"` | Maximum equipment slots a user may book in one week |

All values are stored as strings; helpers in `app/models/admin.server.ts` and `app/models/equipment.server.ts` parse them. Defaults listed above are the fallbacks supplied at each call site — a key may be absent from the table entirely.

## Components Architecture

### Component Organization

#### shadcn/ui Foundation

The project uses **shadcn/ui** configured with:
- **Style**: New York variant
- **Base Color**: Zinc
- **Icon Library**: Lucide React
- **CSS Variables**: Enabled for dynamic theming

**Core shadcn Components:** Form, Button, Badge, Textarea, Tabs, AlertDialog, Tooltip, Sidebar, Select, Checkbox, RadioGroup, Popover, Command, Dialog, DropdownMenu, ScrollArea, Sheet, Skeleton, Table, Pagination, Collapsible, Card, Alert, Input, Label, Separator

#### Custom Component Structure

```
app/components/
├── data-table.tsx          # Generic TanStack Table wrapper
└── ui/
    ├── Navbar.tsx
    ├── HeroSection.tsx
    ├── GridSection.tsx
    ├── layout.tsx
    ├── Iissues.tsx         # Issue reporting component
    ├── country-dropdown.tsx
    ├── button.tsx, form.tsx, table.tsx, …  # shadcn primitives live as flat files here,
    │                                       # not in a subdirectory (26 in total)
    ├── Dashboard/          # Dashboard-specific components
    │   ├── sidebar.tsx              # User sidebar (AppSidebar)
    │   ├── adminsidebar.tsx         # Admin sidebar
    │   ├── guestsidebar.tsx         # Guest sidebar
    │   ├── ConfirmButton.tsx        # Action confirmation with loading state
    │   ├── DateTypeRadioGroup.tsx   # Single/multi-day/recurring selector
    │   ├── GenericFormField.tsx     # Reusable form field with validation
    │   ├── MembershipCard.tsx       # Membership plan display card
    │   ├── MembershipPlanForm.tsx   # Membership plan create/edit form
    │   ├── MultiSelectField.tsx     # Multi-selection dropdown
    │   ├── PrerequisitesField.tsx   # Workshop prerequisite selector
    │   ├── OccurrenceRow.tsx        # Workshop occurrence row display
    │   ├── OccurrenceTabs.tsx       # Tabbed occurrence management
    │   ├── RepetitionScheduleInputs.tsx  # Recurring schedule inputs
    │   ├── ShadTable.tsx            # Styled table wrapper
    │   ├── TimeIntervalPicker.tsx   # Time range selector
    │   ├── equipmentbookinggrid.tsx # Time-slot booking grid
    │   ├── equipmentcard.tsx        # Equipment item card
    │   ├── equipmentlist.tsx        # Equipment list component
    │   ├── quickcheckout.tsx        # Saved-card quick checkout
    │   ├── workshopcard.tsx         # Workshop display card
    │   └── workshoplist.tsx         # Workshop list component
    ├── About/              # About page sections
    ├── Home/               # Home page sections (hero, facilities, calendar, etc.)
    ├── Programming/        # Programming/workshops public sections
    ├── Spaces and Services/# Space rental and equipment info sections
    ├── Get Involved/       # Volunteer and community sections
    ├── MakertoMarket/      # Maker to Market program sections
    └── MuralProject/       # Mural project page sections
```

### Dashboard Components

**Layout & Navigation:**
- **AppSidebar** (`sidebar.tsx`): Main user navigation sidebar
- **AdminAppSidebar** (`adminsidebar.tsx`): Enhanced admin sidebar
- **GuestAppSidebar** (`guestsidebar.tsx`): Limited guest navigation

**Form & Input Components:**
- **GenericFormField**: Reusable form field wrapper with validation and error handling
- **DateTypeRadioGroup**: Workshop date type selector (single, multi-day)
- **MultiSelectField**: Multi-selection dropdown for equipment and prerequisites
- **PrerequisitesField**: Prerequisite workshop selector
- **RepetitionScheduleInputs**: Time-based inputs for recurring schedules
- **TimeIntervalPicker**: Time range picker for schedule inputs

**Workshop Components:**
- **WorkshopList** (`workshoplist.tsx`): Workshop list — supports user and admin views
- **WorkshopCard** (`workshopcard.tsx`): Individual workshop display
- **OccurrenceRow**: Workshop occurrence row with date/time formatting
- **OccurrenceTabs**: Tabbed interface for occurrence management
- **ConfirmButton**: Action confirmation with loading state

**Equipment Components:**
- **EquipmentBookingGrid** (`equipmentbookinggrid.tsx`): Time-slot grid for equipment reservations
- **EquipmentCard** (`equipmentcard.tsx`): Equipment item display
- **EquipmentList** (`equipmentlist.tsx`): Equipment listing component

**Payment Components:**
- **QuickCheckout** (`quickcheckout.tsx`): One-click payment with saved card

**Data Display:**
- **ShadTable**: Styled table wrapper
- **DataTable** (`data-table.tsx`): Generic TanStack Table with sorting/filtering

## Backend Models & Data Layer

### Model Organization

All models are in `app/models/` (*.server.ts). Some API logic is also in `app/routes/api/`.

### Core Model Functions

#### User Management (`user.server.ts`)
- `getAllUsers()`, `getUserById()`, `getAllUsersWithVolunteerStatus()`
- `updateUserRole()`, `updateUserAllowLevel()`
- `makeUserAdmin()`, `removeUserAdmin()`, `countAdmins()`, `getRoleIdByName()`
- `savePaymentMethod()`, `getSavedPaymentMethod()`, `deletePaymentMethod()`, `chargePaymentMethod()`
- `getOrCreateStripeCustomer()`
- `updateUserVolunteerStatus()`, `getUserVolunteerHistory()`, `getUserCurrentVolunteerStatus()`
- **`startRoleLevelSyncCron()`** — every 15 seconds, corrects all user role levels in batch

#### Workshop Management (`workshop.server.ts`)
- `getWorkshops()`, `getWorkshopById()`, `getWorkshopWithPriceVariations()`
- `addWorkshop()`, `updateWorkshop()`, `updateWorkshopWithOccurrences()`, `deleteWorkshop()`
- `duplicateWorkshop()`, `offerWorkshopAgain()`
- `registerForWorkshop()`, `registerUserForAllOccurrences()`
- `cancelUserWorkshopRegistration()`, `cancelMultiDayWorkshopRegistration()`
- `cancelWorkshopOccurrence()`, `cancelWorkshopPriceVariation()`
- `getUserWorkshops()`, `getUserWorkshopRegistrations()`, `getUserWorkshopsWithOccurrences()`
- `getUserWorkshopsWithRegistrationDetails()`
- `checkWorkshopCapacity()`, `checkMultiDayWorkshopCapacity()`
- `getUserCompletedPrerequisites()`, `getUserCompletedOrientations()`
- `getAllWorkshopCancellations()`, `getWorkshopCancellationsByStatus()`, `createWorkshopCancellation()`, `updateWorkshopCancellationResolved()`
- `moveUserWorkshopRegistration()` — admin move between occurrences of the same workshop
- `updateRegistrationResult()`, `updateMultipleRegistrations()` — mark pass/fail, single and bulk
- `getWorkshopOccurrence()`, `getWorkshopOccurrencesByConnectId()`, `getActiveOccurrencesForWorkshop()`, `duplicateOccurrence()`
- `getWorkshopRegistrationCounts()`, `getMultiDayWorkshopRegistrationCounts()`, `getMultiDayWorkshopUserCount()`, `getMaxRegistrationCountsPerWorkshopPriceVariation()`
- `getAllRegistrations()`, `checkUserRegistration()`, `getUserWorkshopRegistrationInfo()`, `getUserWorkshopRegistrationsByWorkshopId()`, `getWorkshopPriceVariation()`
- `updateWorkshopOccurrenceStatuses()` — flips `active` occurrences to `past` once `startDate` has passed
- **`startWorkshopOccurrenceStatusUpdate()`** — runs immediately on startup, then every 1 second via `setInterval`

#### Equipment Management (`equipment.server.ts`)
- `getAvailableEquipment()`, `getAvailableEquipmentForAdmin()`, `getAllEquipment()`, `getEquipmentById()`
- `addEquipment()`, `updateEquipment()`, `deleteEquipment()`, `duplicateEquipment()`
- `bookEquipment()`, `bookEquipmentBulkByTimes()`, `bulkBookEquipment()`
- `cancelEquipmentBooking()`, `approveEquipmentBooking()`
- `getUserBookedEquipments()`, `getAllEquipmentWithBookings()`
- `getEquipmentSlotsWithStatus()`, `createEquipmentSlot()`, `createEquipmentSlotsForOccurrence()`
- `toggleEquipmentAvailability()`, `setSlotAvailability()`
- `hasUserCompletedEquipmentPrerequisites()`, `getUserCompletedEquipmentPrerequisites()`
- `createEquipmentCancellation()`, `getAllEquipmentCancellations()`, `getCancelledEquipmentBookings()`, `getEquipmentCancellationsByStatus()`, `updateEquipmentCancellationResolved()`
- `checkSlotAvailability()`, `getAvailableSlots()`, `getAvailableEquipmentSlotsForWorkshopRange()`, `createEquipmentSlotForWorkshop()`
- `getEquipmentByName()`, `getBookingEmailDetails()`
- `getLevel3ScheduleRestrictions()`, `getLevel4UnavailableHours()`

#### Profile & Volunteer Management (`profile.server.ts`)
- `getProfileDetails()` — comprehensive profile with membership and payment info
- `checkActiveVolunteerStatus()`, `getVolunteerHours()`, `getAllVolunteerHours()`
- `logVolunteerHours()`, `checkVolunteerHourOverlap()`
- `updateVolunteerHourStatus()`, `getRecentVolunteerHourActions()`
- `updateUserAvatar()`, `updateUserPhone()`, `updateEmergencyContact()`

#### Membership Management (`membership.server.ts`)
- `getMembershipPlans()`, `getMembershipPlan()`, `getMembershipPlanById()`
- `addMembershipPlan()`, `updateMembershipPlan()`, `deleteMembershipPlan()`
- `registerMembershipSubscription()`, `registerMembershipSubscriptionWithForm()`
- `cancelMembership()`, `updateMembershipAutoRenew()`
- `getUserMemberships()`, `getUserActiveMembership()`, `getUserActiveOrCancelledMemberships()`
- `createMembershipForm()`, `activateMembershipForm()`, `updateMembershipFormStatus()`
- `getUserMembershipForm()`, `invalidateExistingMembershipForms()`
- `decryptMembershipAgreement()`
- `revokeUserMembershipByAdmin()`, `unrevokeUserMembershipByAdmin()`
- `calculateProratedUpgradeAmount()`, `getAccessHours()`, `getCancelledMembership()`
- `MEMBERSHIP_REVOKED_ERROR` — exported error constant thrown when a revoked user attempts to subscribe
- **`startMonthlyMembershipCheck()`** — daily at midnight (`0 0 * * *`)

#### Administrative Controls (`admin.server.ts`)
- `getAdminSetting()`, `updateAdminSetting()`
- `getWorkshopVisibilityDays()`, `getEquipmentVisibilityDays()`, `getPastWorkshopVisibility()`
- `updateWorkshopCutoff()`
- `getGoogleCalendarConfig()`, `clearGoogleCalendarAuth()`
- `getPlannedClosures()`, `updatePlannedClosures()`

#### Payment Processing (`payment.server.ts`)
- `createPaymentIntentWithSavedCard()` — saved card quick checkout
- `quickCheckout()` — one-click purchase for workshops, equipment, memberships
- `createCheckoutSession()` — Stripe hosted checkout session
- `createOrUpdatePaymentMethod()` — payment method management
- `deletePaymentMethod()`
- `refundWorkshopRegistration()`, `refundEquipmentBooking()`, `refundMembershipSubscription()`

#### Access Card & Log Management
- `access_card.server.ts`: `getAccessCardByUUID()`, `getAccessCardByEmail()`, `getAccessCardByBrivoCredentialId()`, `getUserIdByAccessCard()`, `hasPermissionForType()`, `updateAccessCard()`
- `accessLog.server.ts`: `logAccessEvent()`, `getAccessLogs()`

#### Issue Reporting (`issue.server.ts`)
- `createIssue()` — with screenshot upload (PNG/JPEG, max 5MB each, max 5 per issue)
- `getIssues()`, `updateIssueStatus()`
- Screenshots saved to `public/uploads/issues/` with random UUID filenames

## Development Patterns

### Form Handling

```typescript
// Pattern: React Hook Form + Zod
const form = useForm<FormValues>({
  resolver: zodResolver(formSchema),
  defaultValues: { ... }
});
```

### Authentication Flow

1. Session stored in a signed cookie named `RJ_session` via `createCookieSessionStorage` (3-hour `maxAge`, `sameSite: "lax"`, `secure` only in production)
2. The session holds three values, set by `createUserSession()`: `userId`, `userPassword` (the raw password submitted at login), and `loginTime`
3. There is **no** `requireAuth()` helper. Routes call `getRoleUser(request)` (used by ~42 route files), `getUser(request)`, or `getUserId(request)` in their loader/action and issue their own `redirect()` when the result is null or the role is wrong
4. `getUserId()` runs three checks on every request and calls `logout()` if any fails:
   - `userId` and `userPassword` are present in the session
   - `loginTime` is within the last 3 hours (`SESSION_DURATION_MS = 3 * 60 * 60 * 1000`)
   - `bcrypt.compare(userPassword, user.password)` still matches the stored hash — this is what invalidates every existing session when a password changes
5. Full user data is loaded in loaders rather than stored in the session
6. Role checks happen at route level and in business logic
7. All email lookups (login, password reset, access card provisioning) use case-insensitive matching (`mode: "insensitive"` in Prisma); new registrations store emails as lowercase

### Registration Flow

On successful registration, the action redirects to `/login?registered=true`. The login page reads the `?registered=true` param and displays a green "Registration successful!" banner. There is no "stay on register page" behavior.

### Waiver Generation

- Template PDF in `public/documents/msyk-waiver-template.pdf`
- User signatures overlaid using pdf-lib (PNG image embedded on page 2)
- Final document encrypted with AES before storage using `WAIVER_ENCRYPTION_KEY`
- Decryption happens on-demand for downloads via `/dashboard/profile/download-waiver`

### Membership Agreement Forms

- Signature captured and encrypted similarly to waivers; stored in `UserMembershipForm.agreementSignature`
- `decryptMembershipAgreement()` decrypts on-demand for downloads via `/dashboard/profile/download-membership-agreement/:formId`

### Logging

```typescript
import { logger } from "~/logging/logger";
logger.info("Operation successful", { userId, context });
logger.error("Operation failed", { error, userId, context });
```
- Log level is `info` in production and `debug` in development
- `logs/error.log` receives `error` level only; `logs/all_logs.log` receives everything at or above the active level
- In development a Console transport is added as well, in Winston's `simple` format
- File output is structured JSON with timestamps and error stacks (`winston.format.errors({ stack: true })`)

### Email Integration

**Email Provider:** Mailgun — requires `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM_EMAIL`

**All transactional emails in `app/utils/email.server.ts`:**

| Function | Trigger |
|----------|---------|
| `sendRegistrationConfirmationEmail` | New user registration |
| `sendResetEmail` | Password reset request |
| `sendWorkshopConfirmationEmail` | Workshop registration (with ICS attachment) |
| `sendWorkshopCancellationEmail` | Workshop registration cancelled by user |
| `sendAdminWorkshopCancellationEmail` | Workshop registration cancelled by admin (distinct wording: "cancelled by an administrator") |
| `sendAdminWorkshopMoveEmail` | Admin moved a registration to a different occurrence (shows old and new dates) |
| `sendWorkshopPriceVariationCancellationEmail` | Price variation cancelled (single) |
| `sendWorkshopPriceVariationCancellationEmailMultiDay` | Price variation cancelled (multi-day) |
| `sendWorkshopOccurrenceCancellationEmail` | Occurrence cancelled by admin (single) |
| `sendWorkshopOccurrenceCancellationEmailMultiDay` | Occurrence cancelled by admin (multi-day) |
| `sendEquipmentConfirmationEmail` | Single equipment slot booked |
| `sendEquipmentBulkConfirmationEmail` | Multiple equipment slots booked |
| `sendEquipmentCancellationEmail` | Equipment booking cancelled |
| `sendMembershipConfirmationEmail` | New membership subscription (includes auto-renew status, GST breakdown) |
| `sendMembershipPaymentReminderEmail` | 24h before auto-renew charge (`autoRenew=true` only) |
| `sendMembershipPaymentSuccessEmail` | Successful recurring membership charge |
| `sendMembershipDowngradeEmail` | Membership downgrade scheduled |
| `sendMembershipCancellationEmail` | Membership cancelled |
| `sendMembershipResubscribeEmail` | Membership resubscribed (includes auto-renew status) |
| `sendMembershipEndedNoPaymentMethodEmail` | Membership expired — no payment method on file |
| `sendMembershipRevokedEmail` | Admin revokes user membership (includes custom reason) |
| `sendMembershipUnrevokedEmail` | Admin unrevokes user membership |

`app/utils/email.server.ts` also exports `checkPaymentMethodStatus`, a helper used to decide whether payment-method reminder copy is included in membership emails.

**Email Features:**
- HTML and plain text versions for all emails
- ICS calendar attachments for workshop registration confirmation
- Google Calendar event links in workshop emails

### Security & Authorization

#### Role-Based Access Control
- Admin functions verified at route loader/action level
- Role level and `allowLevel4` flag checked before equipment/feature access
- Data isolation: users can only access their own data

#### Input Sanitization
- Prisma parameterized queries prevent SQL injection
- Zod schema validation on all form inputs
- File upload validation: MIME type, extension, and size checks

#### Cryptography
- `bcryptjs` for password hashing (note: `bcrypt` is also a dependency but the auth path uses `bcryptjs`)
- AES via crypto-js for waiver and membership agreement PDF encryption
- JWT (jsonwebtoken) for password reset tokens (1-hour expiry)
- HMAC SHA256 for Brivo webhook signature verification

## Testing Strategy

- Jest with ts-jest; Testing Library for component tests; MSW available for mocking external APIs
- Run with `npm test`

**Model tests** (`tests/models/`):
`equipment.basic`, `equipment.booking`, `equipment.cancellation`, `equipment.settings`, `equipment.slots`, `membership.cron`, `membership.server`, `workshop.basic`, `workshop.cancellation`, `workshop.capacity`, `workshop.registration`

**Route tests** (`tests/routes/dashboard/`):
`addequipment.test.ts`, `addworkshop.test.ts`

**Support:**
- `tests/helpers/db.mock.ts`, `tests/helpers/test-utils.ts`
- Fixtures in `tests/fixtures/` — `equipment/`, `membership/`, `session/`, `workshop/`

**Seed data:**
- `seed.ts` provides consistent test data; **requires `NODE_ENV=development`** — it logs `Seed aborted` and exits immediately otherwise. Occurrence dates are relative to `now` (e.g. `addDays(now, 7)`) so workshops always appear upcoming regardless of when the seed runs. It truncates and reseeds `RoleUser`, restarting the sequence so `User` = 1 and `Admin` = 2

**Additional scripts** (`test-scripts/`, run with `npx tsx`):
- `seed-orientation-registrations.ts` — populates any workshop with 20 test users across 5 past sessions with varied results (passed/failed/pending/cancelled) and optional price variations; supports multi-day via `--days=N`. Run: `npx tsx test-scripts/seed-orientation-registrations.ts [workshopId|name] [--days=N]`
- `test-refunds.ts` — exercises refund paths against Stripe
- `test-waiver-decrypt.ts` — decrypts a stored waiver to verify `WAIVER_ENCRYPTION_KEY` round-trips
- `coordinate-finder.ts` — helper for positioning text and signatures on the waiver PDF template

## Complete Route Map

### Public Routes
| Path | File |
|------|------|
| `/` | `routes/_index.tsx` |
| `/home` | `routes/home.tsx` |
| `/about` | `routes/about/about.tsx` |
| `/board` | `routes/about/board.tsx` |
| `/staff` | `routes/about/staff.tsx` |
| `/contact` | `routes/about/contact.tsx` |
| `/programming` | `routes/programming/programming.tsx` |
| `/workshopregistration` | `routes/programming/workshopregistration.tsx` |
| `/pastworkshops` | `routes/programming/pastworkshops.tsx` |
| `/makertomarket` | `routes/programming/makertomarket.tsx` |
| `/muralproject` | `routes/programming/muralproject.tsx` |
| `/dontfakeit` | `routes/programming/dontfakeit.tsx` |
| `/makermarket2024` | `routes/programming/makermarket2024.tsx` |
| `/spaces` | `routes/spaceandservices/spaces.tsx` |
| `/SpaceRental` | `routes/spaceandservices/SpaceRental.tsx` |
| `/SpacesEquipment` | `routes/spaceandservices/SpacesEquipment.tsx` |
| `/resourcetoolbox` | `routes/spaceandservices/resourcetoolbox.tsx` |
| `/fabricationservices` | `routes/spaceandservices/fabricationservices.tsx` |
| `/get-involved` | `routes/getinvolved/getinvolved.tsx` |
| `/volunteer` | `routes/getinvolved/volunteer.tsx` |
| `/jobopportunities` | `routes/getinvolved/jobopportunities.tsx` |

### Authentication Routes
| Path | File |
|------|------|
| `/register` | `routes/authentication/register.tsx` |
| `/login` | `routes/authentication/login.tsx` |
| `/logout` | `routes/authentication/logout.tsx` |
| `/passwordReset` | `routes/authentication/passwordReset.tsx` |

### Dashboard Routes (Protected)
| Path | File |
|------|------|
| `/dashboard` | `routes/dashboard/dashboardlayout.tsx` |
| `/dashboard/user` | `routes/dashboard/userdashboardlayout.tsx` |
| `/dashboard/admin` | `routes/dashboard/admindashboardlayout.tsx` |
| `/dashboard/workshops` | `routes/dashboard/workshops.tsx` |
| `/dashboard/workshops/:id` | `routes/dashboard/workshopdetails.tsx` |
| `/dashboard/workshops/pricevariations/:workshopId` | `routes/dashboard/workshoppricingvariation.tsx` |
| `/dashboard/workshops/offer/:id` | `routes/dashboard/workshopofferagain.tsx` |
| `/dashboard/addworkshop` | `routes/dashboard/addworkshop.tsx` |
| `/dashboard/editworkshop/:workshopId` | `routes/dashboard/editworkshop.tsx` |
| `/dashboard/myworkshops` | `routes/dashboard/myworkshops.tsx` |
| `/dashboard/equipments` | `routes/dashboard/equipments.tsx` |
| `/dashboard/equipments/:id` | `routes/dashboard/equipmentdetails.tsx` |
| `/dashboard/equipmentbooking/:id` | `routes/dashboard/equipmentbooking.tsx` |
| `/dashboard/equipment/edit/:id` | `routes/dashboard/equipmentsedit.tsx` |
| `/dashboard/addequipment` | `routes/dashboard/addequipment.tsx` |
| `/dashboard/myequipments` | `routes/dashboard/myequipments.tsx` |
| `/dashboard/memberships` | `routes/dashboard/memberships.tsx` |
| `/dashboard/memberships/:membershipId` | `routes/dashboard/membershipdetails.tsx` |
| `/dashboard/addmembershipplan` | `routes/dashboard/addmembershipplan.tsx` |
| `/dashboard/editmembershipplan/:planId` | `routes/dashboard/editmembershipplan.tsx` |
| `/dashboard/profile` | `routes/dashboard/profile.tsx` |
| `/dashboard/volunteer` | `routes/dashboard/volunteer.tsx` |
| `/dashboard/events` | `routes/dashboard/events.tsx` |
| `/dashboard/report` | `routes/dashboard/issue.tsx` |
| `/dashboard/logs` | `routes/dashboard/serverlogs.tsx` |
| `/dashboard/accesslogs` | `routes/dashboard/accesslogs.tsx` |
| `/dashboard/accessusage` | `routes/dashboard/accessusage.tsx` |
| `/dashboard/admin/users` | `routes/dashboard/allusersregistered.tsx` |
| `/dashboard/admin/workshop/users` | `routes/dashboard/alluserworkshop.tsx` |
| `/dashboard/admin/workshop/:workshopId/users` | `routes/dashboard/userworkshop.tsx` — loader + action; action handles `adminCancelRegistration` |
| `/dashboard/allequipmentbooking` | `routes/dashboard/allequipmentbooking.tsx` |
| `/dashboard/admin/settings` | `routes/dashboard/adminsettings.tsx` |
| `/dashboard/admin/reports` | `routes/dashboard/adminreports.tsx` |

### Payment Routes
| Path | File |
|------|------|
| `dashboard/payment/:workshopId/:occurrenceId` | `routes/dashboard/payment.tsx` |
| `dashboard/payment/:workshopId/:occurrenceId/:variationId` | `routes/dashboard/payment.tsx` |
| `dashboard/payment/:workshopId/connect/:connectId` | `routes/dashboard/payment.tsx` |
| `dashboard/payment/:workshopId/connect/:connectId/:variationId` | `routes/dashboard/payment.tsx` |
| `dashboard/payment/:membershipPlanId` | `routes/dashboard/payment.tsx` |
| `dashboard/payment/success` | `routes/dashboard/paymentsuccess.tsx` |
| `dashboard/payment/downgrade` | `routes/api/paymentdowngrade.tsx` |
| `dashboard/payment/upgrade` | `routes/api/paymentupgrade.tsx` |
| `dashboard/payment/resubscribe` | `routes/api/paymentresubscribe.tsx` |
| `dashboard/paymentprocess` | `routes/api/paymentprocess.tsx` |

### API Routes
| Path | File |
|------|------|
| `/dashboard/register/:id` | `routes/api/register.tsx` |
| `/dashboard/equipments/book-slot` | `routes/api/bookequipmentslot.tsx` |
| `/dashboard/equipment/delete/:id` | `routes/api/equipmentsdelete.tsx` |
| `/dashboard/profile/download-waiver` | `routes/api/download-waiver.tsx` |
| `/dashboard/profile/download-membership-agreement/:formId` | `routes/api/download-membership-agreement.tsx` |
| `/user/profile/paymentinformation` | `routes/dashboard/paymentinformation.tsx` |
| `/access` | `routes/api/access.tsx` (ESP32 access card API) |
| `/api/google-calendar/connect` | `routes/api/google-calendar.connect.tsx` |
| `/api/google-calendar/callback` | `routes/api/google-calendar.callback.tsx` |
| `/api/google-calendar/disconnect` | `routes/api/google-calendar.disconnect.tsx` |
| `/api/brivo/status` | `routes/api/brivo.status.tsx` |
| `/api/brivo/provisioning` | `routes/api/brivo.provisioning.tsx` |
| `/api/stripe-sync` | `routes/api/stripe-sync.tsx` |
| `/brivo/callback` | `routes/brivo.callback.tsx` (webhook) |

## Common Tasks

### Adding a New Route
1. Create file in `app/routes/` following file-based routing conventions
2. Register the route in `app/routes.ts`
3. Export `loader` for data fetching (server-side)
4. Export `action` for mutations (server-side)
5. Implement component with TypeScript types

### Creating Database Changes
1. Modify `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name descriptive_name`
3. Run `npx prisma generate` to update types
4. Update `seed.ts` if needed for new test data

### Adding Business Logic
1. Add functions to appropriate model file in `app/models/`
2. Export typed functions with error handling
3. Use Prisma client from `app/utils/db.server.ts`
4. Call from route loaders/actions

### Workshop Prerequisite Chains
When creating workshops that require others:
1. Create the workshop first
2. Add entries to `WorkshopPrerequisite` linking `prerequisiteId → workshopId`
3. Validation automatically prevents registration without completed prerequisites
4. Equipment prerequisites work similarly via `EquipmentPrerequisite`

### Working with Stripe Products
When adding a new purchasable entity type:
1. Add `stripeProductId String?` to the Prisma model
2. Add a sync function to `app/services/stripe-sync.server.ts`
3. Call sync non-blocking from model create/update/delete functions
4. Update checkout logic in `payment.server.ts` to use `price_data.product` when available
5. Add to the bulk sync endpoint in `routes/api/stripe-sync.tsx`

## Further Documentation

**Maintained docs** — kept in sync with the code:

- **[MSYK-OVERVIEW.md](./MSYK-OVERVIEW.md)** — Detailed functional overview covering all core features (authentication, workshops, equipment, memberships, volunteers, payments), business logic, end-to-end workflows, and test plan
- **[CLAUDE.md](./CLAUDE.md)** — Quick-reference guidance and critical gotchas for agentic coding tools
- **[.claude/README.md](./.claude/README.md)** — The repo's Claude Code slash commands and when to use each

**Supporting material** — lives in [docs/](./docs/) because the repo root is reserved for the three primary docs above. Being in `docs/` says nothing about how useful a file is; several are the best source for what they cover:

- **[docs/README.md](./docs/README.md)** — Index of the folder, with a table of every file and whether it is maintained. Start here
- **[docs/apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md](./docs/apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md)** — Vendor snapshot of the Brivo API reference. The authoritative description of the endpoints `app/services/brivo.server.ts` calls — read it before changing the door access integration. Never edited
- **[docs/implementations/](./docs/implementations/)** — Point-in-time write-ups of individual implementations (a feature, a migration, an integration), each written once when the work landed. Deliberately *not* updated as the code evolves, so treat them as historical records rather than a description of current behavior. See [docs/implementations/README.md](./docs/implementations/README.md)
