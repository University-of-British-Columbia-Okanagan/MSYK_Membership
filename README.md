# MYSK Membership Management System

A comprehensive membership management platform built with React Router 7, TypeScript, and Prisma, designed to manage makerspace memberships, workshops, equipment bookings, and volunteer coordination.

## Table of Contents

- [Local Development Setup](#local-development-setup)
- [User Documentation](#user-documentation)
- [Technical Documentation](#technical-documentation)
- [System Architecture & Database Schema](#system-architecture--database-schema)
- [Components Architecture](#components-architecture)
- [Backend Models & Data Layer](#backend-models--data-layer)
- [Functional Overview & Test Plan](./docs/msyk-overview.md)

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

   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA"

   # Session
   SESSION_SECRET=

   # Stripe
   STRIPE_SECRET_KEY=        # sk_live_... (production) or sk_test_... (development)
   STRIPE_PUBLIC_KEY=        # pk_live_... (production) or pk_test_... (development)

   # Application
   BASE_URL=                 # http://localhost:5173 for development

   # Document encryption
   WAIVER_ENCRYPTION_KEY=

   # JWT (for password reset tokens)
   JWT_SECRET=

   # Email (Mailgun)
   MAILGUN_API_KEY=
   MAILGUN_DOMAIN=
   MAILGUN_FROM_EMAIL=
   ```

   **Optional integrations:**
   ```env
   # Google Calendar
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   GOOGLE_OAUTH_REDIRECT_URI=
   GOOGLE_OAUTH_ENCRYPTION_KEY=  # Must be at least 32 characters

   # Brivo Door Access Control (all five required for Brivo to activate)
   BRIVO_CLIENT_ID=
   BRIVO_CLIENT_SECRET=
   BRIVO_USERNAME=
   BRIVO_PASSWORD=
   BRIVO_API_KEY=
   BRIVO_BASE_URL=              # Optional; default: https://api.brivo.com
   BRIVO_AUTH_BASE_URL=         # Optional; default: https://auth.brivo.com
   BRIVO_WEBHOOK_SECRET=        # Optional; for webhook signature verification
   BRIVO_ACCESS_GROUP_LEVEL4=   # Optional; comma-separated Brivo group IDs (fallback)
   ```

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

### Additional Development Commands

- **Type checking:** `npm run typecheck`
- **Database seeding:** `npx tsx seed.ts`
- **Prisma Studio:** `npx prisma studio`
- **Run tests:** `npm test`

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
- View all workshop registrations in `/dashboard/admin/workshop/users`
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

## Technical Documentation

### Implemented Features

**Stripe Product Sync:**
Each workshop, membership plan, and equipment item is automatically linked to a named Stripe Product. This enables Stripe coupons to be restricted to specific items (e.g., "LASER20" only applies to the Laser Cutter workshop).
- `stripeProductId` field on `Workshop`, `MembershipPlan`, `Equipment` models
- Auto-synced on create/update; archived (not deleted) on item deletion
- Bulk sync and Clear & Re-sync available via Admin Settings → Stripe Products tab
- Checkout sessions use `price_data.product` when available, fall back to inline `product_data`
- See [docs/implementations/stripe-product-sync.md](./docs/implementations/stripe-product-sync.md) for full details

**Google Calendar Integration:**
When an admin connects their Google Calendar account via OAuth, workshop occurrences are automatically created as calendar events. Events are updated or deleted when occurrences change.
- OAuth flow via `/api/google-calendar/connect` → callback → disconnect
- Refresh token stored AES-encrypted in `AdminSettings`
- `googleEventId` stored on `WorkshopOccurrence` for event tracking

**Registration Success Redirect:**
On successful registration, the server redirects to `/login?registered=true`. The login page shows a green "Registration successful!" banner.

**3-Hour Session Timeout:**
Sessions expire after 3 hours. `loginTime` is stored in the cookie and validated on every request. Users are automatically logged out on expiry.

**Email Case Sensitivity:**
All email lookups (login, password reset, access card provisioning) use case-insensitive matching. New registrations store emails as lowercase.

**Workshop Offer Pattern:**
Workshops use `offerId` on `WorkshopOccurrence` to group scheduling rounds. `offerWorkshopAgain()` creates a new offer without losing historical registration data.

**Membership Agreement Forms:**
`UserMembershipForm` tracks signed membership agreements. Signatures are AES-encrypted and downloadable as PDFs. Form status mirrors the membership lifecycle (pending → active → cancelled/ending/inactive).

**Brivo Access Control (Two Separate Systems):**
- **Brivo**: physical door lock for Level 4 members — auto-provisioned via `syncUserDoorAccess()`
- **ESP32 + local fobs**: equipment sign-in/out logging — assigned at orientation, admin-managed only, never auto-modified by membership or role syncs

### Project Structure

**Root Level:**
- `prisma/schema.prisma` — Database schema
- `package.json` — Dependencies and scripts
- `app/routes.ts` — Application routing configuration

**Application Structure:**
```
app/
├── routes/              # File-based routing
│   ├── authentication/  # Login, registration, password reset
│   ├── about/           # About, board, staff, contact pages
│   ├── programming/     # Workshop calendar, special programs
│   ├── spaceandservices/# Spaces, rentals, fabrication
│   ├── getinvolved/     # Volunteer, jobs
│   ├── api/             # Server-side API endpoints
│   └── dashboard/       # Protected user and admin interfaces
│
├── models/              # Server-side business logic
│   ├── user.server.ts          # User management, role sync cron
│   ├── workshop.server.ts      # Workshop lifecycle, registration, occurrence status cron
│   ├── equipment.server.ts     # Equipment booking and management
│   ├── membership.server.ts    # Membership plans, billing cron, revocation
│   ├── payment.server.ts       # Stripe integration, checkout, refunds
│   ├── profile.server.ts       # User profiles, volunteer hours
│   ├── admin.server.ts         # Admin settings, Google Calendar config, planned closures
│   ├── access_card.server.ts   # Access card management
│   ├── accessLog.server.ts     # Access log tracking
│   └── issue.server.ts         # Issue reporting with screenshot uploads
│
├── services/            # External service clients
│   ├── brivo.server.ts              # Brivo API client
│   ├── access-control-sync.server.ts # Door access sync logic
│   └── stripe-sync.server.ts         # Stripe Product sync
│
├── utils/               # Utility functions
│   ├── session.server.ts      # Auth, session management, register, login, waiver
│   ├── db.server.ts           # Prisma singleton
│   ├── email.server.ts        # All transactional emails via Mailgun
│   ├── googleCalendar.server.ts # Google Calendar OAuth + event CRUD
│   └── singleton.server.ts    # Server singleton pattern helper
│
├── layouts/             # Layout wrappers
│   ├── DashboardLayout.tsx
│   └── MainLayout.tsx
│
├── schemas/             # Zod validation schemas
│   ├── registrationSchema.tsx
│   ├── loginSchema.tsx
│   ├── workshopFormSchema.tsx
│   ├── equipmentFormSchema.tsx
│   ├── membershipPlanFormSchema.tsx
│   ├── membershipAgreementSchema.tsx
│   ├── bookingFormSchema.tsx
│   └── ...
│
├── config/
│   └── access-control.ts  # Door permission IDs and Brivo group helpers
│
└── logging/
    └── logger.ts           # Winston logger (logs/error.log, logs/all_logs.log)
```

## System Architecture & Database Schema

### Core Models

#### User Management
- **User**: Central user entity — personal info, emergency contacts, consent records, role level, Brivo sync status, membership revocation status, avatar
- **RoleUser**: Role definitions — User (id: 1) and Admin (id: 2)
- **UserPaymentInformation**: Stripe customer and payment method storage

#### Membership System
- **MembershipPlan**: Subscription plans — title, pricing tiers (monthly/quarterly/semiannual/yearly), features (JSON), `needAdminPermission` flag, `stripeProductId`
- **UserMembership**: Active subscriptions — status, billingCycle, nextPaymentDate, autoRenew, paymentIntentId
- **UserMembershipForm**: Signed membership agreements — encrypted signature, status lifecycle

#### Workshop & Training System
- **Workshop**: Workshop definitions — pricing, capacity, type (workshop/orientation), registrationCutoff, `stripeProductId`
- **WorkshopOccurrence**: Scheduled instances — startDate/endDate (UTC and PST variants), status, `connectId` (multi-day), `offerId`, `googleEventId`
- **UserWorkshop**: Enrollment records — result, paymentIntentId, priceVariationId
- **WorkshopPrerequisite**: Prerequisite chains between workshops
- **WorkshopPriceVariation**: Alternative pricing tiers with individual capacity limits
- **WorkshopCancelledRegistration**: Cancellation audit trail with refund tracking

#### Equipment Management
- **Equipment**: Equipment inventory — availability, `stripeProductId`
- **EquipmentSlot**: 30-minute time slots — isBooked, workshopOccurrenceId
- **EquipmentBooking**: Booking records — `bookedFor` ("user" or "workshop"), paymentIntentId
- **EquipmentPrerequisite**: Workshop prerequisites required for equipment access
- **EquipmentCancelledBooking**: Cancellation records with slot-level refund tracking (JSON `cancelledSlotTimes`)

#### Access Control
- **AccessCard**: Fob/card records — permissions (Int[]), `brivoCredentialId`, `brivoMobilePassId`; linked to user
- **AccessLog**: Event log — equipment/door name, state (enter/exit/denied), timestamp

#### Volunteer Management
- **Volunteer**: Volunteer period tracking — volunteerStart, volunteerEnd
- **VolunteerTimetable**: Time log entries — startTime, endTime, status (pending/approved/denied/resolved), `isResubmission`, `previousStatus`

#### Administrative Tools
- **AdminSettings**: Key-value system configuration store
- **Issue**: User-reported issues — title, description, status, priority
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
- One registration per user per occurrence (`userId, occurrenceId`)
- One payment information record per user (`userId`)

### Database Relationships

- **One-to-Many**: User → UserMembership, User → UserWorkshop, User → EquipmentBooking, User → AccessCard
- **Many-to-Many**: Workshop ↔ Workshop (prerequisites via WorkshopPrerequisite), Equipment ↔ Workshop (via EquipmentPrerequisite)
- **Cascade Deletions**: User → bookings, memberships, volunteer records, access cards, logs
- **Unique Constraints**: Prevent duplicate registrations and double-bookings

### Technology Stack

**Backend:**
- React Router 7 (SSR) + Node.js
- Prisma ORM + PostgreSQL
- Stripe (API version: `2025-02-24.acacia`)
- Mailgun (transactional email)
- Winston (structured logging)
- node-cron + setInterval (background jobs)

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
    ├── [shadcn-ui]/        # Design system primitives
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
- `getAllWorkshopCancellations()`, `getWorkshopCancellationsByStatus()`
- `updateWorkshopOccurrenceStatuses()` — updates occurrence status based on current time
- **`startWorkshopOccurrenceStatusUpdate()`** — runs every 1 second via `setInterval`

#### Equipment Management (`equipment.server.ts`)
- `getAvailableEquipment()`, `getAvailableEquipmentForAdmin()`, `getAllEquipment()`, `getEquipmentById()`
- `addEquipment()`, `updateEquipment()`, `deleteEquipment()`, `duplicateEquipment()`
- `bookEquipment()`, `bookEquipmentBulkByTimes()`, `bulkBookEquipment()`
- `cancelEquipmentBooking()`, `approveEquipmentBooking()`
- `getUserBookedEquipments()`, `getAllEquipmentWithBookings()`
- `getEquipmentSlotsWithStatus()`, `createEquipmentSlot()`, `createEquipmentSlotsForOccurrence()`
- `toggleEquipmentAvailability()`, `setSlotAvailability()`
- `hasUserCompletedEquipmentPrerequisites()`, `getUserCompletedEquipmentPrerequisites()`
- `createEquipmentCancellation()`, `getAllEquipmentCancellations()`
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
- `calculateProratedUpgradeAmount()`, `getAccessHours()`
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
- `access_card.server.ts`: `getAccessCardByUUID()`, `getAccessCardByEmail()`, `getAccessCardByBrivoCredentialId()`, `updateAccessCard()`
- `accessLog.server.ts`: Access event logging

#### Issue Reporting (`issue.server.ts`)
- `createIssue()` — with screenshot upload (PNG/JPEG, max 5MB each, max 5 per issue)
- Screenshots saved to `public/uploads/issues/` with random UUID filenames

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
- bcryptjs for password hashing
- AES via crypto-js for waiver and membership agreement PDF encryption
- JWT (jsonwebtoken) for password reset tokens (1-hour expiry)
- HMAC SHA256 for Brivo webhook signature verification
