# PROJECT.md

This file provides guidance to agentic coding tools when working with code in this repository.

## Documentation References

For comprehensive understanding of the MSYK Makerspace Membership system, refer to these documentation files:

- **[README.md](./README.md)** - Complete project overview, setup instructions, user documentation, technical architecture, and database schema
- **[docs/msyk-overview.md](./docs/msyk-overview.md)** - Detailed functional overview covering all core features (authentication, workshops, equipment, memberships, volunteers, payments), business logic, and test plans
- **[docs/apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md](./docs/apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md)** - Brivo API reference for the door access control system integration
- **[docs/implementations/stripe-product-sync.md](./docs/implementations/stripe-product-sync.md)** - Stripe Product Sync implementation details and testing guide

These files contain detailed information about user workflows, feature specifications, and system behavior that complement the architectural guidance below.

## Development Commands

### Running the Application
```bash
npm run dev              # Start development server (client + server concurrently)
npm run dev:client       # Start React Router dev client only
npm run dev:server       # Start server only
npm run build            # Production build
npm start                # Run production server
npm run typecheck        # Type check and generate React Router types
npm test                 # Run Jest tests
```

### Database Operations
```bash
# Generate Prisma client (required after schema changes)
npx prisma generate --schema prisma/schema.prisma

# Create and apply migrations
npx prisma migrate dev

# Seed database with test data
npx tsx seed.ts

# Open Prisma Studio (visual database manager)
npx prisma studio
```

## Architecture Overview

### Technology Stack
- **Framework:** React Router 7 (with SSR)
- **Language:** TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Payments:** Stripe integration (API version: `2025-02-24.acacia`)
- **UI:** shadcn/ui (New York variant) + Tailwind CSS
- **Forms:** React Hook Form + Zod validation
- **Authentication:** Session-based with encrypted cookies (3-hour expiry)
- **Logging:** Winston → `logs/error.log` and `logs/all_logs.log`
- **Calendar UI:** FullCalendar (@fullcalendar/*)
- **Data Tables:** @tanstack/react-table
- **Email:** Mailgun (via mailgun.js)

### Project Structure
```
app/
├── routes/              # File-based routing (configured in app/routes.ts)
│   ├── _index.tsx
│   ├── home.tsx
│   ├── authentication/  # Login, register, password reset, logout
│   ├── about/           # About, board, staff, contact
│   ├── programming/     # Workshops, events, special programs
│   ├── spaceandservices/# Spaces, equipment info, rentals
│   ├── getinvolved/     # Volunteer, job opportunities
│   ├── api/             # Server-side API endpoints
│   ├── dashboard/       # Protected user/admin routes
│   └── brivo.callback.tsx  # Brivo webhook endpoint
├── models/              # Server-side business logic (*.server.ts)
│   ├── user.server.ts
│   ├── workshop.server.ts
│   ├── equipment.server.ts
│   ├── membership.server.ts
│   ├── payment.server.ts
│   ├── profile.server.ts
│   ├── admin.server.ts
│   ├── access_card.server.ts
│   ├── accessLog.server.ts
│   └── issue.server.ts
├── services/            # External service integrations (*.server.ts)
│   ├── brivo.server.ts           # Brivo API client
│   ├── access-control-sync.server.ts  # Door access sync logic
│   └── stripe-sync.server.ts     # Stripe Product sync
├── utils/               # Utilities and helpers
│   ├── session.server.ts    # Authentication & session management
│   ├── db.server.ts         # Prisma client instance (singleton)
│   ├── email.server.ts      # Mailgun email integration
│   ├── googleCalendar.server.ts  # Google Calendar OAuth + event CRUD
│   └── singleton.server.ts  # Server singleton pattern
├── layouts/             # Shared layout components
│   ├── DashboardLayout.tsx
│   └── MainLayout.tsx
├── components/ui/       # UI components
│   └── Dashboard/       # Dashboard-specific components
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
├── config/              # Application configuration
│   └── access-control.ts    # DOOR_PERMISSION_ID, getBrivoGroupsForRole, requiresDoorPermission
└── logging/             # Logging setup
    └── logger.ts            # Winston logger instance

prisma/
└── schema.prisma        # Database schema and models
```

### Routing Convention
React Router 7 uses file-based routing configured in `app/routes.ts`. Routes export `loader` functions for data fetching and `action` functions for mutations. The `~` alias points to the `app/` directory.

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
- **Special Flag:** `allowLevel4` - Boolean flag that must be explicitly granted by admin for Level 4 access
- **Access Requirements:** Most equipment requires Level 3+, some require Level 4 with the flag
- Role checks are enforced in loaders/actions and at the model layer
- **Role Level Sync Cron:** `startRoleLevelSyncCron()` in `app/models/user.server.ts` — runs every 15 seconds (`*/15 * * * * *`), corrects any drift across all users in a single batched DB query

### Cron Jobs
Three background jobs run automatically when the server starts:

| Job | Function | Schedule | File |
|-----|----------|----------|------|
| Role level sync | `startRoleLevelSyncCron()` | Every 15 seconds | `app/models/user.server.ts` |
| Membership billing | `startMonthlyMembershipCheck()` | Daily at midnight (`0 0 * * *`) | `app/models/membership.server.ts` |
| Workshop status update | `startWorkshopOccurrenceStatusUpdate()` | Every 1 second (setInterval) | `app/models/workshop.server.ts` |

The workshop status job runs immediately on startup and keeps `WorkshopOccurrence.status` up-to-date (open/closed/cancelled) as time passes.

### Workshop System Architecture
**Workshop Offer Pattern:** Workshops use an `offerId` to group occurrences:
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
- **Cutoff Time**: 60 minutes before workshop start (configurable per-workshop via `registrationCutoff`)
- **Capacity**: Tracked per occurrence or across multi-day series
- **Price Variations**: `WorkshopPriceVariation` records with individual capacity limits
- **Cancellation Policy**: Full refund if cancelled within 48 hours of registration (default policy text stored on `Workshop` model)

**Google Calendar Integration (Optional):**
- When configured, workshop create/edit/delete automatically creates/updates/deletes Google Calendar events
- `googleEventId` stored on `WorkshopOccurrence` to track the linked event
- Requires Google OAuth — admin must connect via Admin Settings → Google Calendar tab
- Refresh token stored encrypted in `AdminSettings` (`google_oauth_refresh_token_enc`)
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
- **Membership Agreement Forms:** `UserMembershipForm` tracks signed agreements (encrypted AES signature); status mirrors subscription lifecycle (`pending → active → cancelled/ending/inactive`)
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
- **Purpose:** Links each Workshop, MembershipPlan, and Equipment to a named Stripe Product, enabling Stripe coupon restrictions to specific items
- **Schema:** `stripeProductId String?` on `Workshop`, `MembershipPlan`, and `Equipment` models
- **Service:** `app/services/stripe-sync.server.ts`
  - `syncWorkshopToStripe(id)` — creates or updates Stripe Product for a workshop
  - `syncMembershipPlanToStripe(id)` — creates or updates Stripe Product for a membership plan
  - `syncEquipmentToStripe(id)` — creates or updates Stripe Product for equipment
  - `archiveStripeProduct(stripeProductId)` — marks Stripe Product inactive (used on delete)
  - `bulkSyncToStripe()` — syncs all three categories in one pass
- **Auto-Sync Hooks:** Called non-blocking (`.catch()`) from model create/update/delete functions in workshop, membership, and equipment models
- **Checkout:** `payment.server.ts` and `payment.tsx` use `price_data.product` when `stripeProductId` exists, falling back to `price_data.product_data` if not set
- **Admin API:** `POST /api/stripe-sync` with actions: `bulkSync`, `clearAndResync`, `getSyncStatus`
- **Admin UI:** Admin Settings → "Stripe Products" tab — Sync All, Clear & Re-sync buttons with status display
- **Metadata:** Each Stripe Product has `{ portal_type: "workshop"|"membership"|"equipment", portal_id: "N" }` for dashboard identification
- **Environment note:** `stripeProductId` values are Stripe account-specific. Switching between test/live keys requires a Clear & Re-sync

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

## Database Patterns

### Key Relationships
- **Cascade Deletions:** User deletion cascades to bookings, memberships, volunteer records, access cards, and logs
- **Unique Constraints:** Prevent duplicate workshop registrations (`userId, occurrenceId`) and equipment bookings
- **Soft Deletion:** Some entities use status flags instead of hard deletes (memberships: "inactive", "ending", "cancelled", "revoked")
- **Indexes:** Applied to frequently queried fields (userId, workshopId, createdAt, etc.)

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
| `equipment_visibility_days` | — | Equipment booking window in days |
| `past_workshop_visibility` | `"180"` | Days of past workshop history to show |
| `google_calendar_id` | `""` | Selected Google Calendar ID |
| `google_calendar_timezone` | `"America/Yellowknife"` | Timezone for Google Calendar events |
| `google_oauth_refresh_token_enc` | `""` | AES-encrypted Google OAuth refresh token |
| `brivo_access_group_level4` | `""` | Comma-separated Brivo group IDs for Level 4 access |

**Planned Closures:** Also stored in AdminSettings via `getPlannedClosures()` / `updatePlannedClosures()`.

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
1. Session stored in encrypted cookie via `createCookieSessionStorage` (3-hour `maxAge`)
2. `requireAuth()` helper checks session and redirects if needed
3. `getUserId()` validates `loginTime` on every request; logs out if session older than 3 hours (`SESSION_DURATION_MS = 3 * 60 * 60 * 1000`)
4. User data loaded in loaders, not stored in session (session contains only `userId` and `loginTime`)
5. Role checks happen at route level and in business logic
6. All email lookups use case-insensitive matching (`mode: "insensitive"` in Prisma); new registrations store emails as lowercase

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
- Production: `info` level and above written to files only
- Development: also printed to console in simple format
- Winston structured JSON format with timestamps and error stacks

### Email Integration
**Email Provider:** Mailgun — requires `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM_EMAIL`

**All transactional emails in `app/utils/email.server.ts`:**

| Function | Trigger |
|----------|---------|
| `sendRegistrationConfirmationEmail` | New user registration |
| `sendResetEmail` | Password reset request |
| `sendWorkshopConfirmationEmail` | Workshop registration (with ICS attachment) |
| `sendWorkshopCancellationEmail` | Workshop registration cancelled |
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

**Email Features:**
- HTML and plain text versions for all emails
- ICS calendar attachments for workshop registration confirmation
- Google Calendar event links in workshop emails

## Testing Strategy
- Jest configured for unit testing
- Test files in `tests/` directory
- Key test files: `tests/models/membership.server.test.ts`, `tests/models/membership.cron.test.ts`, `tests/models/workshop.registration.test.ts`, `tests/models/workshop.capacity.test.ts`
- Seed script (`seed.ts`) provides consistent test data

## Environment Variables & Configuration

### Required Environment Variables
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA"
SESSION_SECRET=          # Cookie encryption key (session expiry: 3 hours)
STRIPE_SECRET_KEY=       # Stripe secret key (sk_live_... or sk_test_...)
STRIPE_PUBLIC_KEY=       # Stripe publishable key (pk_live_... or pk_test_...)
BASE_URL=                # Application base URL (dev: http://localhost:5173)
WAIVER_ENCRYPTION_KEY=   # AES key for waiver PDF encryption

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

# Brivo Door Access Control
BRIVO_API_KEY=
BRIVO_API_URL=
BRIVO_WEBHOOK_SECRET=        # HMAC secret for webhook signature verification
BRIVO_ACCESS_GROUP_LEVEL4=   # Fallback if not set in AdminSettings (comma-separated group IDs)
```

**Stripe Environment Notes:**
- Live keys (`sk_live_`/`pk_live_`) for production; test keys (`sk_test_`/`pk_test_`) for development
- After switching Stripe keys, all `stripeProductId` values in the DB must be cleared and re-synced via Admin Settings → Stripe Products → Clear & Re-sync

## Brivo Access Control Integration (Optional)

**Two Separate Door Access Systems:**
- **Brivo** — controls the physical door lock. Automatically provisioned/revoked based on membership + role level
- **ESP32 + local fobs** — used for equipment sign-in/out logging. Fobs assigned at orientation; `accessCard.permissions` are **admin-managed only** and are **never auto-modified** by any sync trigger

**Brivo Access Requirements:**
- Active membership subscription (`UserMembership.status = "active"`)
- Membership status not `"revoked"` (`User.membershipStatus`)
- Role level ≥ 4 (`requiresDoorPermission(roleLevel)` in `app/config/access-control.ts`)
- Configured Brivo access groups (`brivo_access_group_level4` in AdminSettings)

**Automatic Sync Triggers — `syncUserDoorAccess()` is called when:**
- New membership subscription registered (`registerMembershipSubscription()`)
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

**Key Files:**
- `app/services/brivo.server.ts` — Brivo API client (OAuth, person management, groups, mobile passes)
- `app/services/access-control-sync.server.ts` — Sync logic; `syncUserDoorAccess()`
- `app/config/access-control.ts` — `DOOR_PERMISSION_ID = 0`, `requiresDoorPermission()`, `getBrivoGroupsForRole()`
- `app/routes/brivo.callback.tsx` — Webhook endpoint for access events
- `app/models/access_card.server.ts` — Card management: `getAccessCardByUUID`, `getAccessCardByEmail`, `getAccessCardByBrivoCredentialId`, `updateAccessCard`

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
| `/dashboard/admin/workshop/:workshopId/users` | `routes/dashboard/userworkshop.tsx` |
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
