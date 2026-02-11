# PROJECT.md

This file provides guidance to agentic coding tools when working with code in this repository.

## Documentation References

For comprehensive understanding of the MSYK Makerspace Membership system, refer to these documentation files:

- **[README.md](./README.md)** - Complete project overview, setup instructions, user documentation, technical architecture, and database schema
- **[docs/msyk-overview.md](./docs/msyk-overview.md)** - Detailed functional overview covering all core features (authentication, workshops, equipment, memberships, volunteers, payments), business logic, and test plans
- **[docs/apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md](./docs/apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md)** - Brivo API reference for the door access control system integration

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
- **Payments:** Stripe integration
- **UI:** shadcn/ui (New York variant) + Tailwind CSS
- **Forms:** React Hook Form + Zod validation
- **Authentication:** Session-based with encrypted cookies

### Project Structure
```
app/
├── routes/              # File-based routing
│   ├── _index.tsx
│   ├── authentication/  # Login, register, password reset
│   ├── api/            # Server-side API endpoints
│   └── dashboard/      # Protected user/admin routes
├── models/             # Server-side business logic (*.server.ts)
│   ├── user.server.ts
│   ├── workshop.server.ts
│   ├── equipment.server.ts
│   ├── membership.server.ts
│   ├── payment.server.ts
│   ├── profile.server.ts
│   └── admin.server.ts
├── utils/              # Utilities and helpers (*.server.ts)
│   ├── session.server.ts    # Authentication & session management
│   ├── db.server.ts         # Prisma client instance
│   └── email.server.ts      # Email integration
├── components/ui/      # UI components
│   └── Dashboard/      # Dashboard-specific components
└── schemas/           # Zod validation schemas

prisma/
└── schema.prisma      # Database schema and models
```

### Routing Convention
React Router 7 uses file-based routing from `app/routes/`. Routes export `loader` functions for data fetching and `action` functions for mutations. The `~` alias points to the `app/` directory.

### Server-Side Code Convention
All server-side code uses the `*.server.ts` naming convention. These files:
- Execute only on the server (never bundled to client)
- Handle database operations via Prisma
- Implement business logic and data validation
- Manage external service integrations (Stripe, email)

## Core System Concepts

### Role-Based Access Control (RBAC)
- **Roles:** User (roleUserId: 1) and Admin (roleUserId: 2)
- **Role Levels:** Dynamically calculated based on user's membership and workshop completion status:
  - **Level 1**: Basic user (registered, no orientation completed)
  - **Level 2**: Completed orientation(s) but no active membership
  - **Level 3**: Active membership (standard plans)
  - **Level 4**: Active membership with `needAdminPermission` plan + admin-granted `allowLevel4` flag
- **Special Flag:** `allowLevel4` - Boolean flag that must be explicitly granted by admin for Level 4 access
- **Access Requirements:** Most equipment requires Level 3+, some require Level 4 with the flag
- Role checks are enforced in loaders/actions and at the model layer
- Role levels are automatically recalculated on membership changes, workshop completion, or admin actions

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

**Multi-day Workshops:** Connected via shared `multiDayWorkshopId`. All occurrences must be registered together as a single unit.

**Registration Rules:**
- **Cutoff Time**: 60 minutes before workshop start (configurable)
- **Capacity**: Tracked per occurrence or across multi-day series
- **Cancellation Policy**: Full refund if cancelled within 48 hours of registration
- **Price Variations**: Support for student, early bird, and standard pricing tiers

**Google Calendar Integration (Optional):**
- When configured, workshop registrations automatically create Google Calendar events
- Requires Google OAuth credentials and calendar ID in admin settings
- Events include workshop details and multi-day schedules

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
- **Workshop integration:** Equipment can be bulk-booked during workshop registration

### Membership System
- **Plans:** Defined in `MembershipPlan` with JSON-stored features
- **Billing Cycles:** Monthly, quarterly (3 months), semiannually (6 months), yearly
- **Auto-Renew:** Configurable per subscription (defaults to `true` for backward compatibility)
  - When `autoRenew=true`: Membership auto-renews with saved payment method at term end
  - When `autoRenew=false`: Membership expires at term end without charging
  - Auto-renew toggle disabled in UI when user has no saved payment method
- **Automated Processing:** Daily cron job at midnight (`0 0 * * *`) processes due memberships
  - Payment reminders sent 24 hours before charge (only for auto-renew enabled)
  - Missing payment method sets membership to "inactive" and sends notification
- **Changes:** Support upgrade/downgrade with prorated billing (monthly→monthly only)
  - **Upgrade**: Prorated charge, immediate activation, old membership marked "ending"
  - **Downgrade**: Scheduled at next payment date, old membership "ending", new "active" at transition
- **Cancellation:** Status "cancelled", access retained until `nextPaymentDate`, then deleted
- **Revocation (Admin):** Admin can globally ban users from all memberships with custom message
  - All memberships set to "revoked" status, user cannot resubscribe until admin unrevokes
- **Access Control:** Membership status affects role levels and equipment access

### Volunteer Management
- **Time Logging:** `VolunteerTimetable` with approval workflow (pending → approved/denied)
- **Overlap Detection:** Prevents duplicate time entries for the same period
- **Resubmission:** Denied entries can be modified and resubmitted
- **Integration:** Volunteer status affects role levels and membership benefits

### Payment Integration
- **Stripe:** Primary payment processor with two checkout methods:
  - **Stripe Checkout Session**: Full payment flow with card input (for new customers)
  - **Quick Checkout**: One-click purchases using saved payment method
- **Payment Methods:** Stored via Stripe customer IDs, retrieved with `getSavedPaymentMethod()`
- **Security:** Card details stored encrypted in `UserPaymentInformation`
- **Payment Types:**
  - Workshop registration (single or multi-day)
  - Equipment booking (single or bulk)
  - Membership subscription (new, upgrade, resubscription)
  - Membership upgrade proration (monthly→monthly only)
- **GST Handling:**
  - Dynamic GST percentage from admin settings (default: 5%)
  - GST calculated and included in all payment amounts
  - GST metadata stored in Stripe payment intents
  - Receipt includes GST breakdown
- **Webhooks:** Handle subscription lifecycle events
- **Refunds:** Automated refund processing for workshop/equipment cancellations within policy window

## Database Patterns

### Key Relationships
- **Cascade Deletions:** User deletion cascades to bookings, memberships, and volunteer records
- **Unique Constraints:** Prevent duplicate workshop registrations and equipment bookings
- **Soft Deletion:** Some entities use status flags instead of hard deletes
- **Indexes:** Applied to frequently queried fields (userId, workshopId, etc.)

### Prisma Query Patterns
- Use `include` to load relationships (avoid N+1 queries)
- Use `select` when only specific fields are needed
- Transaction blocks for operations requiring atomicity
- Generated types provide compile-time safety

### AdminSettings
Key-value configuration storage for system-wide settings:
- `workshopVisibilityDays`: How far in advance users can see workshops
- `equipmentVisibilityDays`: Equipment booking window
- `pastWorkshopVisibility`: Whether to show historical workshops
- `gstPercentage`: Tax calculation

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
1. Session stored in encrypted cookie via `createCookieSessionStorage`
2. `requireAuth()` helper checks session and redirects if needed
3. User data loaded in loaders, not stored in session (session contains only userId)
4. Role checks happen at route level and in business logic

### Waiver Generation
- Template PDF in `public/documents/msyk-waiver-template.pdf`
- User signatures overlaid using pdf-lib
- Final document encrypted with AES before storage
- Decryption happens on-demand for downloads

### Email Integration
**Email Provider:** Mailgun configured in `app/utils/email.server.ts`

**Transactional Emails Sent:**
- Registration confirmation
- Workshop registration confirmation (with ICS calendar attachment)
- Workshop cancellation confirmation
- Equipment booking confirmation
- Equipment cancellation confirmation
- Membership confirmation
- Membership payment reminder (24 hours before charge, only for auto-renew enabled)
- Membership downgrade notification
- Membership cancellation notification
- Membership resubscription confirmation
- Membership ended (no payment method)
- Membership revocation notification (admin action)
- Password reset link (JWT token, 1-hour expiration)

**Email Features:**
- HTML and plain text versions
- ICS calendar attachments for workshop events
- Google Calendar links for multi-day workshops
- Custom messages for admin actions (revocation)

## Testing Strategy
- Jest configured for unit testing
- Test database operations use separate test environment
- Seed script provides consistent test data

## Environment Variables & Configuration

### Required Environment Variables
Required in `.env`:
- `DATABASE_URL`: PostgreSQL connection string (format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA`)
- `SESSION_SECRET`: Cookie encryption key (30-day session expiry)
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`: Stripe API keys
  - **Live**: `sk_live_...` and `pk_live_...` for production
  - **Test**: `sk_test_...` and `pk_test_...` for development
  - Switch between environments by replacing keys in `.env`
- `BASE_URL`: Application base URL (dev: `http://localhost:5173`)
- `WAIVER_ENCRYPTION_KEY`: AES encryption key for waiver PDFs

### Optional Integration Variables
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: For Google Calendar integration
- `BRIVO_API_KEY`, `BRIVO_API_URL`: For door access control system
- Mailgun credentials: Configured in `app/utils/email.server.ts`

## Brivo Access Control Integration (Optional)

**Purpose:** Automatic door access provisioning for Level 4 members

**Access Requirements:**
- Active membership subscription
- Membership status not "revoked"
- Role level 4 (requires `allowLevel4` flag)
- Configured Brivo access groups in admin settings (`brivo_access_group_level4`)

**Automatic Sync Triggers:**
The `syncUserDoorAccess()` function is automatically called when:
- New membership subscription registered
- Membership cancelled or revoked
- User role level updated
- User `allowLevel4` flag updated
- Admin revokes/unrevokes membership
- Automated billing cron updates role levels
- Membership refund processed

**Integration Features:**
- Brivo person record creation/updates
- Access group assignment based on role level
- Mobile pass credential generation
- Automatic access revocation on membership changes
- Webhook-based access event logging (enter/exit/denied)

**Error Handling:**
- Sync errors stored in `brivoSyncError` field on User table
- Admin can retry sync from admin settings UI
- Graceful degradation when Brivo not configured (warnings logged, no errors)

**Key Files:**
- `app/services/brivo.server.ts` - Brivo API client
- `app/services/access-control-sync.server.ts` - Sync logic
- `app/config/access-control.ts` - Permission configuration
- `app/routes/brivo.callback.tsx` - Webhook endpoint

## Common Tasks

### Adding a New Route
1. Create file in `app/routes/` following file-based routing conventions
2. Export `loader` for data fetching (server-side)
3. Export `action` for mutations (server-side)
4. Implement component with TypeScript types

### Creating Database Changes
1. Modify `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name descriptive_name`
3. Run `npx prisma generate` to update types
4. Update seed.ts if needed for new test data

### Adding Business Logic
1. Add functions to appropriate model file in `app/models/`
2. Export typed functions with error handling
3. Use Prisma client from `app/utils/db.server.ts`
4. Call from route loaders/actions

### Workshop Prerequisite Chains
When creating workshops that require others:
1. Create the workshop first
2. Add entries to `WorkshopPrerequisite` linking prerequisiteId → workshopId
3. Validation automatically prevents registration without completed prerequisites
4. Equipment prerequisites work similarly via `EquipmentPrerequisite`
