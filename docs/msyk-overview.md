# MSYK Membership

## Overview

The MSYK Membership Management System is a comprehensive platform for managing makerspace operations, including member subscriptions, workshop registrations, equipment bookings, volunteer coordination, and administrative controls.

### Key Roles & Access Levels

**User Roles:**
- **User**: Standard member role (default)
- **Admin**: Administrative privileges with full system access

**Access Levels (Role Levels 1-4):**
- **Level 1**: Basic user (registered, no orientation)
- **Level 2**: Completed orientation(s)
- **Level 3**: Active membership (standard)
- **Level 4**: Advanced membership with special permissions (`allowLevel4` flag required)

**Special Permissions:**
- `allowLevel4`: Boolean flag enabling Level 4 access for advanced equipment (requires membership plan with `needAdminPermission`)

### Technology Stack

- **Frontend**: React Router 7 (SSR), React 19, TypeScript 5.7, Tailwind CSS
- **Backend**: Node.js, Express (via React Router)
- **Database**: PostgreSQL with Prisma ORM 6
- **External Services**: 
  - Stripe (payment processing)
  - Mailgun (email notifications)
  - Google Calendar API (optional, for workshop events)
  - Brivo API (access control system for door access)
- **Testing**: Jest with Testing Library

---

## Core Functional Areas

### 1. Authentication & Session Management

**Features:**
- Email/password login with session cookie storage
- Session validation on protected routes
- Automatic session invalidation on password change or tampering
- Secure cookie-based session management (30-day expiry)

**Key Files:**
- `app/utils/session.server.ts` - Session creation, validation, logout
- `app/routes/authentication/login.tsx` - Login form and action
- `app/routes/authentication/logout.tsx` - Logout handler

### 2. Registration & Waiver Management

**Features:**
- User registration with comprehensive profile data
- Required consent agreements (media, data privacy, community guidelines, operations policy)
- Emergency contact information collection
- Digital waiver signature capture and encrypted PDF generation
- Automated registration confirmation email

**Waiver Process:**
- Signature captured as base64 image
- PDF template populated with user name, signature, and date
- Encrypted with AES encryption (key: `WAIVER_ENCRYPTION_KEY`)
- Stored in database as encrypted string

**Key Files:**
- `app/utils/session.server.ts` - `register()`, `generateSignedWaiver()`
- `app/schemas/registrationSchema.tsx` - Validation schema
- `app/routes/authentication/register.tsx` - Registration form

### 3. Password Reset

**Features:**
- JWT-based password reset token generation
- 1-hour token expiration
- Email delivery via Mailgun
- Secure token validation before password update

**Key Files:**
- `app/utils/email.server.ts` - `sendResetEmail()`, `generateResetToken()`
- `app/routes/authentication/passwordReset.tsx` - Reset form and validation

### 4. Membership Management

**Subscription Features:**
- Multiple membership plans with flexible pricing
- Billing cycles: monthly, quarterly (3 months), semiannually (6 months), yearly
- Role level management tied to membership status
- Membership agreement PDF generation and signing

**Subscription Lifecycle:**
- **New Subscription**: Creates active membership with `nextPaymentDate` based on billing cycle
- **Upgrade** (monthly→monthly only): Prorated charge, immediate activation, old membership marked "ending"
- **Downgrade**: Scheduled at next payment date, old membership "ending", new "active" at transition
- **Cancellation**: 
  - Before cycle end: Status "cancelled", access retained until `nextPaymentDate`
  - After cycle end: Deleted, role level recalculated
- **Resubscription**: Reactivates cancelled membership without payment

**Automated Billing:**
- Daily cron job (`0 0 * * *`) processes due memberships
- Monthly memberships auto-renew with saved payment method
- Non-monthly memberships expire when due (no auto-renew)
- Payment reminders sent 24 hours before charge
- Missing payment method sets membership to "inactive" and sends notification

**Role Level Impact:**
- Level 3: Active membership (standard plan)
- Level 4: Active membership + `needAdminPermission` plan + `allowLevel4` flag
- Level 2: Cancelled membership but completed orientation(s)
- Level 1: No membership and no orientation

**Membership Revocation (Admin Action):**
- Admin can revoke a user's membership access globally (ban status)
- Revocation sets all active/ending/cancelled memberships to "revoked" status
- Admin provides custom message when revoking
- Revoked users cannot subscribe to any new memberships
- Revoked users' role level recalculated based on orientation completion
- Email notification sent to user with revocation reason and timestamp
- User can only re-subscribe after admin explicitly unrevokes them
- Unrevocation clears ban status but does not reactivate past memberships
- Historical memberships remain marked as "revoked"

**Key Files:**
- `app/models/membership.server.ts` - Subscription lifecycle, billing, role management, revocation
- `app/models/payment.server.ts` - Payment processing, proration calculation
- `app/routes/dashboard/memberships.tsx` - Membership management UI
- `app/routes/dashboard/adminsettings.tsx` - Admin revocation controls

### 5. Workshop Management

**Workshop Types:**
- **Workshop**: Regular training sessions
- **Orientation**: Prerequisite training for equipment access

**Features:**
- Single-session and multi-day workshop support
- Price variations (e.g., student, early bird, standard)
- Prerequisite chain management
- Capacity tracking and registration limits
- Registration cutoff (default: 60 minutes before start)
- Google Calendar integration (optional, creates events when connected)

**Registration Process:**
- Prerequisite validation before registration
- Capacity check (single occurrence or multi-day series)
- Payment via Stripe Checkout or saved card
- Automatic registration confirmation email with ICS attachment
- Multi-day workshops linked via `connectId`

**Cancellation:**
- Cancellation within 48 hours: Full refund eligibility
- Registration removed from database
- Stripe refund processed
- Cancellation confirmation email sent

**Key Files:**
- `app/models/workshop.server.ts` - Workshop CRUD, occurrence management, registration
- `app/models/payment.server.ts` - Workshop payment and refund processing
- `app/routes/dashboard/workshops.tsx` - Workshop browsing and registration

### 6. Equipment Booking System

**Features:**
- Time-slot based booking (30-minute intervals)
- Role-based restrictions (Level 3+ required for most equipment)
- Prerequisite workshop validation
- Bulk booking support (multiple slots in one transaction)
- Equipment-workshop integration (equipment can be booked during workshop registration)
- Real-time availability checking

**Booking Process:**
- Slot grid displays available time slots
- Prerequisites checked before booking allowed
- Multiple slots can be selected and booked together
- Payment via Stripe Checkout or saved card
- Confirmation email sent with booking details

**Cancellation & Refunds:**
- Cancellation eligible for refund if 2+ days before slot start
- Partial refunds supported (cancel selected slots from bulk booking)
- Stripe refund processed
- Slots freed for rebooking
- Cancellation record created in `EquipmentCancelledBooking`

**Key Files:**
- `app/models/equipment.server.ts` - Equipment CRUD, booking, prerequisites
- `app/models/payment.server.ts` - Equipment payment and refund processing
- `app/routes/dashboard/equipmentbooking/:id.tsx` - Booking interface

### 7. Payment Processing

**Payment Methods:**
- **Stripe Checkout Session**: Full payment flow with card input
- **Quick Checkout**: Saved payment method for one-click purchases
- Payment method storage (Stripe Customer + Payment Method)

**GST Handling:**
- Dynamic GST percentage from admin settings (default: 5%)
- GST calculated and included in all payment amounts
- GST metadata stored in Stripe payment intents
- Receipt includes GST breakdown

**Payment Types:**
- Workshop registration (single or multi-day)
- Equipment booking (single or bulk)
- Membership subscription (new, upgrade, resubscription)
- Membership upgrade proration (monthly→monthly only)

**Key Files:**
- `app/models/payment.server.ts` - Payment intent creation, checkout sessions, refunds
- `app/routes/api/paymentupgrade.tsx` - Quick checkout endpoint
- `app/routes/dashboard/payment/success.tsx` - Payment success handler

### 8. Email Notifications

**Transactional Emails (via Mailgun):**
- Registration confirmation
- Workshop registration confirmation (with ICS calendar attachment)
- Workshop cancellation confirmation
- Equipment booking confirmation
- Equipment cancellation confirmation
- Membership confirmation
- Membership payment reminder (24 hours before charge)
- Membership downgrade notification
- Membership cancellation notification
- Membership resubscription confirmation
- Membership ended (no payment method)
- Password reset link

**Email Features:**
- HTML and plain text versions
- ICS calendar attachments for workshop events
- Google Calendar links for multi-day workshops

**Key Files:**
- `app/utils/email.server.ts` - All email composition and sending

### 9. Admin Settings

**Configurable Settings:**
- GST percentage (default: 5%)
- Workshop visibility days (how far in advance workshops appear)
- Equipment visibility days (booking window)
- Google Calendar ID and timezone (for event creation)
- Google OAuth refresh token (encrypted storage)
- Brivo access group for Level 4 members (`brivo_access_group_level4`)

**Brivo Configuration:**
- Brivo access group for Level 4 members (`brivo_access_group_level4`) - Comma-separated list of group IDs
- Webhook subscription management (create/delete event subscriptions)
- User sync status display and retry functionality
- Integration status indicator (shows if Brivo credentials are configured)

**Admin Functions:**
- User management (role assignment, `allowLevel4` flag)
- Workshop CRUD operations
- Equipment CRUD operations
- Membership plan management
- System configuration updates
- Issue tracking and resolution

**Key Files:**
- `app/models/admin.server.ts` - Settings management
- `app/routes/dashboard/admin/settings.tsx` - Admin settings UI

### 10. Access Cards & Logs (Optional)

**Features:**
- Access card UID storage and linking to users
- Access log tracking (equipment/door entries and exits)
- Permission-based access control

**Key Files:**
- `app/models/access_card.server.ts` - Card management
- `app/models/accessLog.server.ts` - Log tracking
- `app/routes/brivo.callback.tsx` - Access system webhook

### 11. Brivo Access Control Integration

**Features:**
- Automatic door access provisioning for Level 4 members (roleLevel >= 4)
- Requires active membership and non-revoked status
- Brivo person record creation/updates
- Access group assignment based on role level
- Mobile pass credential generation
- Automatic access revocation on membership cancellation/revocation
- Webhook-based access event logging (enter/exit/denied)

**Access Requirements:**
- Active membership subscription
- Membership status not "revoked"
- Role level 4 (requiresDoorPermission)
- Configured Brivo access groups (admin setting: `brivo_access_group_level4`)

**Integration Points:**
The `syncUserDoorAccess()` function is automatically called when:
- New membership subscription is registered (`registerMembershipSubscription()`)
- Membership is cancelled (`cancelMembership()`)
- User role level is updated (`updateUserRole()`)
- User `allowLevel4` flag is updated (`updateUserAllowLevel()`)
- Admin revokes membership (`revokeUserMembershipByAdmin()`)
- Admin unrevokes membership (`unrevokeUserMembershipByAdmin()`)
- Automated billing cron updates role levels (`startMonthlyMembershipCheck()`)
- Membership refund is processed (`refundMembershipSubscription()`)

**Error Handling:**
- Sync errors stored in `brivoSyncError` field on User table
- Admin can retry sync from admin settings UI
- Graceful degradation when Brivo not configured (warnings logged, no errors thrown)
- Webhook signature verification failures return 401 status

**Key Files:**
- `app/services/brivo.server.ts` - Brivo API client (OAuth, person management, groups, mobile passes)
- `app/services/access-control-sync.server.ts` - Door access synchronization logic
- `app/config/access-control.ts` - Door permission configuration
- `app/routes/brivo.callback.tsx` - Webhook endpoint for access events
- `app/models/access_card.server.ts` - Access card management with Brivo credential IDs

---

## End-to-End Workflows

### Workflow 1: User Registration & Login

1. User navigates to `/register`
2. Fills registration form:
   - Personal information (name, email, phone, DOB)
   - Emergency contact details
   - Consent agreements (media, data privacy, community guidelines, operations policy)
   - Digital waiver signature (optional)
3. System validates data via Zod schema
4. Password hashed with bcrypt
5. Waiver PDF generated and encrypted (if signature provided)
6. User record created in database
7. Registration confirmation email sent
8. User redirected to `/login`
9. User enters email and password
10. Session created with userId and password hash stored in cookie
11. User redirected to `/dashboard/user` (or `/dashboard/admin` if admin role)

**Validation Points:**
- Email uniqueness check
- Password strength requirements
- Required consent agreements
- Emergency contact information

### Workflow 2: Password Reset

1. User navigates to `/login` and clicks "Forgot Password"
2. Enters email address
3. System generates JWT token (1-hour expiration)
4. Reset email sent with tokenized link
5. User clicks link, navigates to `/passwordReset?token=...`
6. System validates token (expiration, signature)
7. User enters new password
8. Password hashed and updated in database
9. User redirected to login

**Validation Points:**
- Token expiration check
- Token signature verification
- Password strength requirements

### Workflow 3: Membership Purchase

**New Monthly Membership:**
1. User browses membership plans in `/dashboard/memberships`
2. Selects plan and billing cycle (monthly/quarterly/semiannually/yearly)
3. Reviews plan details and pricing
4. Clicks "Subscribe"
5. If payment method not saved: Redirected to Stripe Checkout
6. If payment method saved: Quick checkout via saved card
7. Payment processed with GST
8. Membership subscription created with `nextPaymentDate` based on cycle
9. Membership agreement form created (status: "pending")
10. User signs membership agreement
11. Form status updated to "active" and linked to subscription
12. User role level updated (Level 3 or Level 4 based on plan)
13. Confirmation email sent with plan details and next billing date

**Key Dates:**
- `date`: Subscription start date (now)
- `nextPaymentDate`: Calculated based on billing cycle
  - Monthly: +1 month
  - Quarterly: +3 months
  - Semiannually: +6 months
  - Yearly: +1 year

### Workflow 4: Membership Upgrade (Monthly→Monthly)

1. User has active monthly membership
2. User selects higher-tier membership plan
3. System calculates prorated upgrade amount:
   - Remaining days in current cycle × (new price - old price) / total cycle days
4. User confirms upgrade
5. Payment processed for proration amount (with GST)
6. Old membership status updated to "ending"
7. New membership created with status "active"
8. Old membership's `nextPaymentDate` preserved for new membership
9. Old membership form status updated to "ending"
10. New membership form status updated to "active"
11. User role level updated if needed
12. Upgrade confirmation email sent

**Note:** Only monthly→monthly upgrades are supported. Other cycle changes require cancellation and new subscription.

### Workflow 5: Membership Downgrade

1. User has active membership
2. User selects lower-tier membership plan
3. System schedules downgrade at next payment date
4. Old membership status updated to "ending"
5. Old membership form status updated to "ending"
6. New membership created with status "active"
7. New membership's `date` set to old membership's `nextPaymentDate`
8. New membership's `nextPaymentDate` calculated from transition date
9. New membership form status updated to "active"
10. User retains current plan benefits until transition date
11. Downgrade confirmation email sent

**Note:** No payment required for downgrade. Transition occurs at next billing cycle.

### Workflow 6: Membership Cancellation

**Cancellation Before Cycle End:**
1. User cancels membership from dashboard
2. System checks if `now < nextPaymentDate`
3. Membership status updated to "cancelled"
4. Membership form status updated to "cancelled"
5. User retains access until `nextPaymentDate`
6. Role level unchanged (remains Level 3/4 until cycle ends)
7. Cancellation confirmation email sent

**Cancellation After Cycle End:**
1. User cancels membership from dashboard
2. System checks if `now >= nextPaymentDate`
3. Membership record deleted
4. Membership form status updated to "inactive"
5. Role level recalculated:
   - If orientation completed: Level 2
   - Otherwise: Level 1
6. Cancellation confirmation email sent

### Workflow 7: Membership Resubscription

1. User has cancelled membership (not expired)
2. User selects same or different plan
3. System finds cancelled membership record
4. Cancelled membership status updated to "active"
5. `nextPaymentDate` recalculated from now
6. Membership form status updated to "active"
7. User role level restored (Level 3 or Level 4)
8. Resubscription confirmation email sent

**Note:** No payment required if resubscribing to same plan. Payment required if different plan (treated as new subscription).

### Workflow 7B: Membership Revocation (Admin)

1. Admin navigates to user management in admin settings
2. Admin selects user and clicks "Revoke Membership"
3. Revocation dialog opens with required custom message field
4. Admin enters revocation reason/message (required)
5. Admin confirms revocation
6. System sets user's `membershipStatus` to "revoked"
7. System records `membershipRevokedAt` timestamp and `membershipRevokedReason` message
8. All active/ending/cancelled memberships for user set to "revoked" status
9. All membership forms updated to "inactive"
10. User role level recalculated (Level 2 if orientation completed, else Level 1)
11. Membership revocation email sent to user with reason and timestamp
12. User is blocked from subscribing to new memberships (ban check on subscription flows)

**Note:** Revocation is permanent until admin explicitly unrevokes. Historical memberships remain "revoked".

### Workflow 7C: Membership Unrevocation (Admin)

1. Admin navigates to user management
2. Admin selects revoked user and clicks "Unrevoke Membership"
3. Admin confirms unrevocation
4. System clears user's `membershipStatus` (set to null/"active")
5. System clears `membershipRevokedAt` and `membershipRevokedReason` fields
6. Historical "revoked" memberships remain unchanged (not retroactively reactivated)
7. User role level remains at current level (Level 1 or 2)
8. Membership unrevocation email sent to user
9. User can now subscribe to new memberships

**Note:** Unrevocation removes ban but does not reactivate past memberships.

### Workflow 8: Workshop Registration (Single Occurrence)

1. User browses workshops in `/dashboard/workshops`
2. Selects workshop
3. System checks prerequisites:
   - If prerequisites exist, verifies user completed required workshops
   - Blocks registration if prerequisites not met
4. User selects occurrence (if multiple available)
5. User selects price variation (if applicable)
6. System checks capacity:
   - Verifies available spots in occurrence
7. User proceeds to payment
8. Payment processed (Stripe Checkout or saved card)
9. Registration created in `UserWorkshop` table
10. Payment intent ID stored in registration
11. Confirmation email sent with:
    - Workshop details
    - Date and time
    - Location
    - Pricing information
    - ICS calendar attachment
    - Google Calendar link
12. User redirected to `/dashboard/myworkshops`

### Workflow 9: Workshop Registration (Multi-Day Series)

1. User browses workshops
2. Selects multi-day workshop (has `connectId`)
3. System checks prerequisites for all occurrences
4. User reviews all sessions in series
5. User selects price variation (if applicable)
6. System checks capacity across all occurrences
7. Payment processed (single payment for entire series)
8. Multiple registrations created (one per occurrence) with same `connectId`
9. Single payment intent ID stored in all registrations
10. Confirmation email sent with:
    - All session dates and times
    - Multi-event ICS calendar attachment
    - Per-session Google Calendar links
11. User redirected to `/dashboard/myworkshops`

### Workflow 10: Workshop Cancellation & Refund

1. User cancels workshop registration from `/dashboard/myworkshops`
2. System finds registration(s) with payment intent ID
3. System checks cancellation policy (default: 48-hour refund window)
4. Stripe refund processed for payment intent
5. Registration record(s) deleted from database
6. Cancellation confirmation email sent
7. User refunded via Stripe

**Note:** Multi-day workshop cancellations refund all occurrences in the series.

### Workflow 11: Equipment Booking (Single Slot)

1. User browses equipment in `/dashboard/equipments`
2. Clicks "Book Equipment" for selected item
3. System checks role level (Level 3+ required)
4. System checks prerequisites:
   - Verifies user completed required orientation workshops
5. User navigates to booking grid (`/dashboard/equipmentbooking/:id`)
6. User selects available time slot
7. System validates slot availability
8. Payment processed (Stripe Checkout or saved card)
9. Equipment slot marked as booked (`isBooked: true`)
10. Booking record created in `EquipmentBooking`
11. Payment intent ID stored in booking
12. Confirmation email sent with booking details
13. User redirected to `/dashboard/myequipments`

### Workflow 12: Equipment Booking (Multiple Slots / Bulk)

1. User navigates to equipment booking grid
2. User selects multiple time slots
3. System validates all slots available
4. System calculates total price (price per slot × slot count + GST)
5. Payment processed for total amount
6. Multiple booking records created (one per slot)
7. All bookings share same payment intent ID
8. All slots marked as booked
9. Bulk confirmation email sent with all slot times
10. User redirected to `/dashboard/myequipments`

### Workflow 13: Equipment Cancellation & Refund

1. User cancels equipment booking from `/dashboard/myequipments`
2. System finds booking(s) with payment intent ID
3. System checks refund eligibility:
   - Cancellation 2+ days before slot start: Eligible
   - Cancellation < 2 days before: Not eligible
4. If eligible:
   - Stripe refund processed
   - Slot(s) marked as available (`isBooked: false`)
   - Booking record(s) deleted
   - Cancellation record created in `EquipmentCancelledBooking`
5. Cancellation confirmation email sent
6. User refunded via Stripe (if eligible)

**Partial Cancellation:**
- User can cancel individual slots from bulk booking
- Refund calculated proportionally (price per slot × cancelled slots)
- Remaining slots remain booked

### Workflow 14: Automated Membership Billing (Cron Job)

**Daily Process (runs at midnight):**
1. System queries memberships with `nextPaymentDate <= now` and status "active", "ending", or "cancelled"
2. For each due membership:
   - **If status "active" and billing cycle "monthly":**
     - Calculate charge amount (base price + GST)
     - Retrieve saved payment method
     - If payment method exists:
       - Create Stripe payment intent with saved card
       - Charge user
       - Update `nextPaymentDate` to next month
       - Store payment intent ID
     - If no payment method:
       - Set membership status to "inactive"
       - Set form status to "inactive"
       - Send "membership ended" email
   - **If status "ending" or "cancelled":**
     - Set status to "inactive"
     - Set form status to "inactive"
   - **If billing cycle non-monthly:**
     - Set status to "inactive" (no auto-renew)
3. Update user role levels based on membership status
4. Send payment reminders for memberships due within 24 hours

**Role Level Updates:**
- If active membership exists: Level 3 or Level 4 (based on plan and `allowLevel4`)
- If no active membership: Level 2 (if orientation completed) or Level 1

### Workflow 15: Google Calendar Integration (Optional)

**Initial Setup:**
1. Admin navigates to Google Calendar settings
2. Clicks "Connect Google Calendar"
3. Redirected to Google OAuth consent screen
4. Admin grants calendar access
5. Refresh token received and encrypted
6. Token stored in `AdminSettings` (key: `google_oauth_refresh_token_enc`)
7. Admin selects target calendar from dropdown
8. Calendar ID stored in `AdminSettings` (key: `google_calendar_id`)

**Event Creation:**
1. Admin creates workshop occurrence
2. System checks if Google Calendar connected
3. If connected:
   - Creates Google Calendar event with workshop details
   - Stores `googleEventId` in `WorkshopOccurrence`
4. Event appears in selected calendar

**Event Updates:**
1. Admin updates workshop occurrence
2. System checks if `googleEventId` exists
3. If exists:
   - Updates Google Calendar event
4. Event updated in calendar

**Event Deletion:**
1. Admin deletes workshop occurrence
2. System checks if `googleEventId` exists
3. If exists:
   - Deletes Google Calendar event
4. Event removed from calendar

**Key Files:**
- `app/utils/googleCalendar.server.ts` - OAuth, event CRUD
- `app/models/admin.server.ts` - Settings storage

### Workflow 16: Brivo Door Access Provisioning

1. User subscribes to membership plan with `needAdminPermission` flag
2. User has `allowLevel4` flag set to true
3. User role level updated to 4
4. `syncUserDoorAccess()` called automatically
5. System checks: active membership + roleLevel >= 4 + not revoked
6. Brivo person record created/updated (firstName, lastName, email, phone)
7. User assigned to Brivo access groups (from `brivo_access_group_level4` setting)
8. Mobile pass credential created and invitation sent to user email
9. `brivoPersonId` and `brivoMobilePassId` stored in database
10. Access card permissions updated to include door permission (ID: 0)
11. Sync timestamp and status recorded

**Validation Points:**
- Active membership must exist
- User must not have revoked membership status
- Role level must be 4 or higher
- Brivo access groups must be configured in admin settings

### Workflow 17: Brivo Door Access Revocation

1. User cancels membership OR admin revokes membership
2. Membership status changes or role level drops below 4
3. `syncUserDoorAccess()` called automatically
4. System determines user no longer qualifies for door access
5. User removed from all Brivo access groups
6. Mobile pass revoked in Brivo
7. Access card door permission removed (permission ID 0)
8. `brivoMobilePassId` cleared from access cards
9. Sync timestamp updated

**Note:** Access revocation occurs immediately when user no longer meets requirements, regardless of membership cancellation timing.

### Workflow 18: Brivo Access Event Webhook

1. User uses Brivo credential (mobile pass or physical card) at door/equipment
2. Brivo system sends webhook POST to `/brivo/callback`
3. Webhook signature verified (HMAC SHA256) if `BRIVO_WEBHOOK_SECRET` configured
4. Event payload parsed (securityAction, credentials, eventData)
5. Access card identified by `brivoCredentialId` or `brivoMobilePassId`
6. Event state resolved: "enter", "exit", or "denied"
7. Equipment/door name extracted from event
8. Access event logged to `AccessLog` table
9. Response sent to Brivo

**Webhook Security:**
- Signature verification using HMAC SHA256
- Returns 401 if signature missing or invalid
- Returns 400 if payload cannot be parsed
- Unknown credentials are logged and ignored (returns 200)

---

## Test Plan

### Test Strategy

**Testing Framework:**
- **Jest** for unit and integration tests
- **Testing Library** for React component testing
- **MSW (Mock Service Worker)** for external API mocking

**Test Focus Areas:**
- Model functions (business logic)
- Route actions and loaders
- Form validation schemas
- Payment processing workflows
- Email composition
- Database operations

**Test Data:**
- Fixtures in `tests/fixtures/**` for consistent test data
- Seed script (`seed.ts`) for database setup
- Mock database helpers in `tests/helpers/db.mock.ts`

**Execution:**
```bash
npm test
```

**Environment Requirements:**
- Test database (separate from development)
- Mock Stripe API keys
- Mock Mailgun credentials
- Mock Google OAuth credentials (for calendar tests)

---

## Acceptance Criteria & Test Cases

The acceptance criteria are organized into three categories:
- **Covered by Jest Tests**: Tests that have been implemented and are running
- **Need Jest Tests**: Test cases that need to be written
- **Manual Testing**: Acceptance criteria for QA to test manually in the application

---

### Covered by Jest Tests

| AC Number | Test Case | Description | Test File |
|-----------|-----------|-------------|-----------|
| AC46 | Membership Revocation | Admin revokes user membership; all active/ending/cancelled memberships set to "revoked"; membership forms set to "inactive"; user's `membershipStatus` set to "revoked"; role level recalculated; email sent | `tests/models/membership.server.test.ts` |
| AC47 | Membership Unrevocation | Admin unrevokes user; `membershipStatus` cleared; `membershipRevokedAt` and `membershipRevokedReason` cleared; historical memberships remain "revoked"; email sent | `tests/models/membership.server.test.ts` |
| AC48 | Revoked User Subscription Guard | Revoked user attempts to subscribe to new membership; registration blocked with `MEMBERSHIP_REVOKED_ERROR`; no membership created | `tests/models/membership.server.test.ts` |
| AC13 | New Monthly Membership | Payment processed with GST; membership created with status "active"; `nextPaymentDate` set to 1 month from now; user role level updated; membership form created | `tests/models/membership.server.test.ts` |
| AC14 | Membership Upgrade (Monthly→Monthly) | Proration calculated; payment processed; old membership status "ending"; new membership "active"; `nextPaymentDate` preserved; role level updated | `tests/models/membership.server.test.ts` |
| AC15 | Membership Downgrade | Old membership "ending"; new membership "active"; new membership's `date` = old membership's `nextPaymentDate`; no payment required | `tests/models/membership.server.test.ts` |
| AC16 | Membership Cancellation (Before Cycle End) | Membership status "cancelled"; membership form "cancelled"; user retains access until `nextPaymentDate`; role level unchanged | `tests/models/membership.server.test.ts` |
| AC17 | Membership Cancellation (After Cycle End) | Membership record deleted; membership form "inactive"; user role level recalculated (Level 2 if orientation completed, else Level 1) | `tests/models/membership.server.test.ts` |
| AC18 | Membership Resubscription | Cancelled membership status "active"; `nextPaymentDate` recalculated; membership form "active"; role level restored | `tests/models/membership.server.test.ts` |
| AC19 | Automated Monthly Billing (Cron) | Finds memberships with `nextPaymentDate <= now`; charges monthly memberships with saved payment method; sets non-monthly to "inactive"; updates role levels; sends payment reminders | `tests/models/membership.cron.test.ts` |
| AC20 | Membership Payment Reminder | Membership due within 24 hours; payment reminder email sent with plan title, next payment date, amount due, payment method reminder | `tests/models/membership.cron.test.ts` |
| AC21 | Workshop Prerequisites | System checks user completed required workshops; registration blocked if prerequisites not met | `tests/models/workshop.registration.test.ts` |
| AC22 | Workshop Capacity | System checks available spots; registration blocked if capacity exceeded | `tests/models/workshop.capacity.test.ts` |
| AC23 | Single Occurrence Registration | User registers for single workshop occurrence; registration created in `UserWorkshop` | `tests/models/workshop.registration.test.ts` |
| AC24 | Multi-Day Workshop Registration | Multiple registrations created (one per occurrence); all share same payment intent ID | `tests/models/workshop.registration.test.ts` |
| - | Workshop Basic Operations | Workshop CRUD operations, occurrence management, duplication and offering | `tests/models/workshop.basic.test.ts` |
| - | Workshop Cancellation | Workshop cancellation logic and registration removal | `tests/models/workshop.cancellation.test.ts` |
| AC28 | Equipment Prerequisites | System checks user completed required workshops; booking blocked if prerequisites not met | `tests/models/equipment.basic.test.ts` |
| AC29 | Equipment Slot Availability | System validates slot not already booked; slot marked as booked (`isBooked: true`) | `tests/models/equipment.booking.test.ts` |
| AC30 | Equipment Bulk Booking | Multiple booking records created; all bookings share same payment intent ID; all slots marked as booked | `tests/models/equipment.booking.test.ts` |
| AC31 | Equipment Refund Eligibility | System checks cancellation date vs slot start time; eligible if 2+ days before; cancellation record created | `tests/models/equipment.cancellation.test.ts` |
| AC33 | Equipment Partial Cancellation | User cancels individual slots from bulk booking; remaining slots remain booked | `tests/models/equipment.cancellation.test.ts` |
| - | Equipment Basic Operations | Equipment CRUD operations, slot management, settings | `tests/models/equipment.basic.test.ts`, `tests/models/equipment.slots.test.ts`, `tests/models/equipment.settings.test.ts` |
| - | Admin Workshop Creation | Admin creates new workshop; workshop form validation | `tests/routes/dashboard/addworkshop.test.ts` |
| - | Admin Equipment Creation | Admin creates new equipment; equipment form validation | `tests/routes/dashboard/addequipment.test.ts` |

---

### Need Jest Tests

| AC Number | Test Case | Description | Recommended Test File |
|-----------|-----------|-------------|----------------------|
| AC1 | Valid Login | Session cookie created with `userId` and `userPassword`; user redirected to appropriate dashboard; session persists for 30 days | `tests/utils/session.server.test.ts` or `tests/models/user.server.test.ts` |
| AC2 | Invalid Credentials | Error message displayed; no session created; user remains on login page | `tests/utils/session.server.test.ts` or `tests/models/user.server.test.ts` |
| AC3 | Session Invalidation | User password changed externally; session validation fails; user automatically logged out | `tests/utils/session.server.test.ts` |
| AC4 | Tampered Session Cookie | Session cookie modified or expired; session validation fails; user automatically logged out | `tests/utils/session.server.test.ts` |
| AC5 | Valid Registration | User record created; password hashed with bcrypt; registration confirmation email sent; user redirected to login | `tests/utils/session.server.test.ts` |
| AC6 | Waiver Signature | PDF template loaded; user name, signature, and date added; PDF encrypted with AES; encrypted PDF stored in `User.waiverSignature` | `tests/utils/session.server.test.ts` |
| AC7 | Duplicate Email | Validation error displayed; no user record created; registration form shows error message | `tests/utils/session.server.test.ts` |
| AC8 | Missing Required Fields | Zod schema validation fails; field-specific error messages displayed; no user record created | `tests/schemas/registrationSchema.test.ts` |
| AC9 | Password Reset Request | JWT token generated (1-hour expiration); reset email sent with tokenized link | `tests/utils/email.server.test.ts` |
| AC10 | Password Reset Token Validation | Token validated (expiration, signature); password reset form displayed; user can enter new password | `tests/routes/authentication/passwordReset.test.ts` |
| AC11 | Expired Reset Token | Token validation fails; error message displayed; user redirected to password reset request page | `tests/routes/authentication/passwordReset.test.ts` |
| AC12 | Invalid Reset Token | Token validation fails; error message displayed; user redirected to password reset request page | `tests/routes/authentication/passwordReset.test.ts` |
| AC25 | Workshop Price Variation | Selected variation price applied to payment; variation name and description included in confirmation email | `tests/models/workshop.server.test.ts` or `tests/models/payment.server.test.ts` |
| AC26 | Workshop Refund | System finds registration(s) with payment intent ID; Stripe refund processed; registration record(s) deleted; cancellation confirmation email sent | `tests/models/payment.server.test.ts` |
| AC27 | Equipment Role Level Restriction | Equipment requires Level 3+ access; user with Level 2 attempts booking; booking blocked; error message displayed | `tests/models/equipment.server.test.ts` |
| AC32 | Equipment Refund | Stripe refund processed; slot(s) marked as available; booking record(s) deleted; cancellation confirmation email sent | `tests/models/payment.server.test.ts` |
| AC34 | GST Calculation | GST percentage retrieved from admin settings; GST amount calculated; total amount includes GST; GST metadata stored in Stripe payment intent | `tests/models/payment.server.test.ts` |
| AC35 | Quick Checkout (Saved Card) | Payment intent created with saved payment method; payment processed automatically (`off_session: true`); no redirect to Stripe Checkout | `tests/models/payment.server.test.ts` |
| AC36 | Stripe Checkout Session | Stripe Checkout session created; session metadata includes userId, item IDs, amounts, GST info; user redirected to Stripe Checkout | `tests/models/payment.server.test.ts` |
| AC37 | Payment Method Storage | Stripe customer created; payment method attached; payment method set as default; details stored in `UserPaymentInformation` | `tests/models/payment.server.test.ts` |
| AC38 | Workshop Confirmation Email | Email sent with workshop name, date/time, location, pricing, ICS attachment, Google Calendar links | `tests/utils/email.server.test.ts` |
| AC39 | Equipment Confirmation Email | Email sent with equipment name, time slot(s), price | `tests/utils/email.server.test.ts` |
| AC40 | Membership Confirmation Email | Email sent with plan title, description, price, billing cycle, next billing date, features, access hours, payment method reminder | `tests/utils/email.server.test.ts` |
| AC41 | Membership Payment Reminder Email | Email sent with plan title, next payment date, amount due, payment method reminder | `tests/utils/email.server.test.ts` |
| AC42 | GST Percentage Setting | Setting stored in `AdminSettings`; GST applied to all future payments; GST metadata included in payment intents | `tests/models/admin.server.test.ts` |
| AC43 | Workshop Visibility Days | Setting stored in `AdminSettings`; workshops only visible if within visibility window; past workshops hidden | `tests/models/admin.server.test.ts` |
| AC44 | Equipment Visibility Days | Setting stored in `AdminSettings`; equipment slots only visible if within visibility window | `tests/models/admin.server.test.ts` |
| AC45 | Google Calendar Connection | OAuth flow completed; refresh token encrypted with AES; encrypted token stored; calendar ID stored; system can create/update/delete events | `tests/utils/googleCalendar.server.test.ts` |
| AC49 | Brivo Door Access Provisioning | User with Level 4 role and active membership gets Brivo person created, assigned to groups, mobile pass generated | `tests/services/access-control-sync.server.test.ts` |
| AC50 | Brivo Door Access Revocation | User loses Level 4 access; Brivo groups revoked, mobile pass cancelled, door permission removed | `tests/services/access-control-sync.server.test.ts` |
| AC51 | Brivo Webhook Signature Verification | Webhook with valid/invalid signature handled correctly | `tests/routes/brivo.callback.test.ts` |
| AC52 | Brivo Access Event Logging | Access events (enter/exit/denied) logged correctly with card ID and user ID | `tests/routes/brivo.callback.test.ts` |

---

### Manual Testing and Testing Overview

The following acceptance criteria should be manually tested by QA in the application to verify end-to-end user workflows and UI behavior:

| AC Number | Test Case | Manual Testing Steps | Expected Results | Jest Test File | Last Manually Tested |
|-----------|-----------|----------------------|------------------|----------------|----------------------|
| AC1 | Valid **Login** | Navigate to `/login`; enter valid email and password | Session cookie created; redirect to appropriate dashboard (user/admin); session persists across browser sessions (30 days) | `N/A` | `11/09/2025`
| AC2 | **Login** Invalid Credentials | Navigate to `/login`; enter incorrect email or password | Error message displayed; no session created; user remains on login page | `N/A` | `11/09/2025`
| AC3 | **Session** Invalidation | Login as user; change password externally (via admin or database); attempt to access protected route | Automatic logout; redirect to login page | `N/A` | `11/09/2025`
| AC4 | Tampered **Session** Cookie | Login as user; modify session cookie in browser dev tools; attempt to access protected route | Automatic logout; redirect to login page | `N/A` | `11/09/2025`
| AC5 | **Register** Valid Registration | Navigate to `/register`; fill all required fields with valid data; provide all required consents; submit form | User record created; registration confirmation email received; redirect to login page | `N/A` | `11/09/2025`
| ---- | **Register** Age Input | Navigate to `/register` and input age | If less than 18 years old, then register should not complete | `N/A` | `11/09/2025`
| ---- | **Register** Agreements | Navigate to `/register` and have to check the boxes to agree and read agreements | If unchecked, then register should not complete | `N/A` | `11/09/2025`
| AC6 | **Register** Waiver Signature | During registration, provide digital waiver signature; complete registration | Waiver PDF can be downloaded (admin view); waiver contains user name, signature, and date; waiver is encrypted in database | `N/A` | `11/09/2025`
| AC7 | **Register** Duplicate Email | Attempt registration with existing email | Validation error displayed; no duplicate user record created; error message shows on form | `N/A` | `11/09/2025`
| ---- | **Register** Welcome Email | Register account successfully | You should see a welcome email after you have registered | `N/A` | `11/17/2025`
| AC8 | **Register** Missing Required Fields | Attempt registration with missing required fields | Field-specific error messages displayed; no user record created; form highlights missing fields | `N/A` | `11/09/2025`
| AC9 | **Password Reset** Request | Navigate to login page; click "Forgot Password"; enter valid email address | Reset email received; email contains tokenized link; link expires in 1 hour | `N/A` | `11/09/2025`
| AC10 | **Password Reset** Token Validation | Click reset link from email; enter new password; submit form | Password reset form displayed; password updated; redirect to login page | `N/A` | `N/A`
| AC11 | **Password Reset** Expired Token | Request password reset; wait more than 1 hour; click reset link from email | Error message displayed; redirect to password reset request page | `N/A` | `N/A`
| AC12 | **Password Reset** Invalid Token | Modify reset token in URL; attempt to access password reset page | Error message displayed; redirect to password reset request page | `N/A` | `N/A`
| ---- | Showcase Membership Details in **Profile** | Subscribe/Cancel/End Membership | Shows details of membership if subscribed with status active, shows details of membership if cancelled with status cancelled, shows no details of membership with status inactive | `N/A` | `11/09/2025`
| ---- | Add Payment Information in **Profile** | Add payment method | Shows payment information of card if added | `N/A` | `11/09/2025`
| ---- | Payment Method Validation in **Profile** | Validate all fields when inputting the payment method | If all fields validated, add the payment method | `N/A` | `11/09/2025`
| ---- | Update Payment Method in **Profile** | Update payment method by pressing update payment button and by removing the current one and adding one | Able to remove current payment method and add a new one if you want | `N/A` | `11/09/2025`
| ---- | Orientation History in **Profile** | Register for an orientation and pass | Should show all orientations a person has registered for and passes with the price variation and workshop type? | `N/A` | `TODO/TOFIX`
| ---- | **Volunteer:** Log Hours | Log volunteer hours | Logs hours successfully if end time after start time, volunteer hours not for future dates, volunteer hours does not end in the future, volunteer session not longer than 24 hours, time period does not overlap with existing volunteer hours | `N/A` | `11/09/2025`
| ---- | **Volunteer:** Log Hours Field Validation | Input fields required for volunteer validation | Should log successfully if all required fields filled | `N/A` | `11/09/2025`
| ---- | **Volunteer:** Recent Hours and Filter | Look at recent hours after logging and the filters | Should show all successfully logged hours with proper filtering| `N/A` | `TODO/TOFIX`
| ---- | **Volunteer:** Accessing Volunteer Hours Section | Check in profile page if Volunteer Hours section is accessible or not | Should show that it is accessible if the admin has allowed them to be a volunteer | `N/A` | `11/17/2025`
| ---- | **Volunteer:** Waiver and Hold Harmless Agreement Document Download | Register for an account and go to profile page to see the document | Should show that the document download button is there and is a valid document with valid date, name, and signature | `N/A` | `11/17/2025`
| AC13 | New Monthly Membership | Browse membership plans in `/dashboard/memberships`; select monthly plan and subscribe; complete payment; sign membership agreement | Membership created with status "active"; `nextPaymentDate` set correctly; role level updated (Level 3 or 4); confirmation email received; membership agreement form status "pending" then "active" |
| AC14 | Membership Upgrade (Monthly→Monthly) | Have active monthly membership; select higher-tier monthly plan; verify proration amount; complete payment | Old membership status "ending"; new membership status "active"; new `nextPaymentDate` equals old `nextPaymentDate`; upgrade confirmation email received |
| AC15 | Membership Downgrade | Have active membership; select lower-tier plan | No payment required; old membership status "ending"; new membership scheduled at next payment date; downgrade confirmation email received; user retains current benefits until transition |
| AC16 | Membership Cancellation (Before Cycle End) | Cancel membership before `nextPaymentDate` | Membership status "cancelled"; user retains access until `nextPaymentDate`; role level unchanged; cancellation confirmation email received |
| AC17 | Membership Cancellation (After Cycle End) | Cancel membership after `nextPaymentDate` | Membership record deleted; role level recalculated (Level 2 if orientation completed, else Level 1); cancellation confirmation email received |
| AC18 | Membership Resubscription | Have cancelled membership (not expired); resubscribe to same or different plan | Cancelled membership reactivated; `nextPaymentDate` recalculated; role level restored; resubscription confirmation email received |
| AC19 | Automated Monthly Billing (Cron) | Set membership `nextPaymentDate` to past date; trigger cron job (or wait for scheduled run) | Monthly membership charged with saved payment method; `nextPaymentDate` updated to next month; payment intent ID stored; non-monthly memberships set to "inactive"; role levels updated correctly; payment reminders sent |
| AC20 | Membership Payment Reminder | Set membership `nextPaymentDate` to within 24 hours; trigger cron job (or wait for scheduled run) | Payment reminder email sent; email includes all required information |
| ---- | **Workshop:** Active Workshops, Orientations, Past Events | Go to /dashboard/workshops route and see the avaliable workshops | Workshops should be categorized as active workshops, orientations, or past events properly. Past events are determined if all days in the workshop have past while active ones have at least one date in the future | `NA` | `11/17/2025`
| ---- | **Workshop:** Add Workshop Button | Go to /dashboard/workshops and click Add Workshop (should show up) and type the URL as a admin and user | Workshops can only be added by admins and no one else | `NA` | `TODO/TOFIX`
| ---- | **Workshop:** Edit Workshop Button | Go to /dashboard/workshops and click Edit Workshop (should show up) on a card and type the URL as a admin and user | Workshops can only be edited by admins and no one else | `NA` | `TODO/TOFIX`
| ---- | **Workshop:** Delete Workshop Button | Go to /dashboard/workshops and click Delete Workshop (should show up) on a card | Workshops can only be deleted by admins and no one else | `NA` | `11/17/2025`
| ---- | **Workshop Details:** Single Occurrence Workshop Dates | Go to workshop details | All dates created by workshop should show up and register individually | `NA` | `11/17/2025`
| ---- | **Workshop Details:** Multi-day Workshop Dates | Go to workshop details | All dates created by workshop should show up and register together | `NA` | `11/17/2025`
| ---- | **Workshop Details:** Single Occurrence Registration Cutoff | Go to workshop details | Dates that are within the cut off date before (from admin panel) it starts should not allow registration, even when typing in the URL | `NA` | `TODO/TOFIX`
| ---- | **Workshop Details:** Multi-day Occurrence Registration Cutoff | Go to workshop details | The first date in the multi-day workshop and is within the cut off date (from admin panel) should not allow registration, even when typing in the URL | `NA` | `TODO/TOFIX`
| ---- | **Workshop Details:** Single Occurrence Active Dates | Go to workshop details | All dates that are in the future and greater than the cut off date should be active (allowed for users to register) | `NA` | `11/17/2025`
| ---- | **Workshop Details:** Multi-day Occurrence Active Dates | Go to workshop details | The first workshop date in the multi-day workshop that ius in the future and greater than the cut off date should be active (allowed for users to register) | `NA` | `11/17/2025`
| ---- | **Workshop Details:** Single Occurrence Past Dates | Go to workshop details | All dates that are in the past and should not be registerable, even when putting in the URL | `NA` | `11/17/2025`
| ---- | **Workshop Details:** Multi-day Occurrence Past Dates | Go to workshop details | The first date in the multi day workshop if is in the past should not be registerable, even when putting in the URL| `NA` | `11/17/2025`
| ---- | **Workshop Details:** Single Occurrence Cancelled Dates | Go to workshop details | All dates that are cancelled and should not be registerable, even when putting in the URL | `NA` | `11/17/2025`
| ---- | **Workshop Details:** Multi-day Occurrence Cancelled Dates | Go to workshop details | When multi-day workshop is cancelled, users cannot register for the workshop, even when putting in the URL | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Edit Workshop Cancel Single Occurrence | Go to edit workshop | If users registered > 0 in that occurrence, then that occurrence can only be cancelled and moved to cancelled tab and status set to cancelled in database | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Edit Workshop Delete Single Occurrence Occurrence | Go to edit workshop | If no user registered in that occurrence, then that occurrence can only be deleted | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Edit Workshop Cancel Multi-day Occurrence | Go to edit workshop | If users registered > 0 in the multi-day workshop, then all the occurrences can only be cancelled and moved to cancelled tab and status set to cancelled in database and you may not add new dates for multi-day workshop | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Edit Workshop Delete Multi-day Occurrence | Go to edit workshop | If no users registered in the multi-day workshop, then all the occurrences can only be deleted and you may add new dates to change the dates for multi-day workshop | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Edit Workshop Add Workshop Dates Multi-day | Go to edit workshop | If no users registered in the multi-day workshop, then you can add occurrences to the multi-day workshop. If users registered, then you cannot add dates anymore in multi-day workshop | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Edit Workshop Add Workshop Dates Single Occurrence | Go to edit workshop | If no users registered or has users registered in the single occurrence workshop, then you can add occurrences to the regular workshop | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Edit Workshop Edit Workshop Date Multi-day | Go to edit workshop | If users registered in the multi-day workshop, then you cannot edit any of the occurrences | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Edit Workshop Edit Workshop Date Single Occurrence | Go to edit workshop | If users registered in single occurrence workshop (regular workshop), then you cannot edit that occurrence in which has a user registered | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Edit Workshop to 0 Occurrences for both Multi-day and Single Occurrence | Go to edit workshop| If a admin deletes all workshop dates (and there are none in the past or cancelled tabs), then that workshop should not be able to update until a proper date is added | `NA` | `TODO/TOFIX`
| ---- | **Workshop:** Admin Add Workshop Required Fields | Go to add workshop | When admin wants to create a workshop, everything that is necessary should be required and fail to create a workshop if those fields not provided (name, price, location, capacity, description, at least one occurrence) | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Add Workshop Price Field | Go to add workshop | If not price variation not selected, price cannot be less than 0. If price variation selected, price input is -1 but price determined off variation price | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Add Workshop Workshop Type | Go to add workshop | If workshop type is orientation, the workshop will have type orientation in the backend. If workshop type is workshop, the workshop will have type workshop in the backend, | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Add Workshop Workshop Image | Go to add workshop | Admins can choose to add an image to a workshop. If added, it should howcase in the workshop card | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Add/Edit Workshop Workshop Image Size | Go to add/edit workshop | Admins can choose to add an image to a workshop. If added, it should be maximum 5 MB | `NA` | `TODO/TOFIX`
| ---- | **Workshop:** Admin Add/Edit Workshop Workshop Append Weekly Dates | Go to add/edit workshop | You can append weekly dates when selecting the append weekly dates button | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Add/Edit Workshop Workshop Append Monthly Dates | Go to add/edit workshop | You can append monthly dates when selecting the append monthly dates button | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Add Workshop User Equipment Booking Conflicts | Go to add workshop | When adding a workshop date and selecting an equipment, it should cause an error creating a workshop when the workshop times are overlapped with a user, across all equipments selected | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Add Workshop Workshop Equipment Booking Conflicts | Go to add workshop | When adding a workshop date and selecting an equipment, it should cause an error creating a workshop when the workshop times are overlapped with another equipment booking caused by a workshop, across all equipments selected | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Add/Edit Workshop Workshop Time Equipment Booking | Go to add/edit workshop | When adding workshop dates, the equipment booking should be by that workshop for all dates across all equipments selected | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Add/Edit Workshop Equipment Booking Timing UI | Go to add/edit workshop | When selecting equpments, it should show the grid for all equipments selected and all the current booking for each equipment respectively | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Add Workshop Add and Remove Equipment Booking | Go to add workshop | You should be able to select any equipment and be able to remove equipments selected for the workshop | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Add/Edit Workshop Equipment Booking Legend | Go to add/edit workshop | The legend for the equipment viewer should correspond to the correct type of booking that is showcased in the equipment avaliability grid | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Add/Edit Workshop Equipment Booking Visibility Days | Go to add/edit workshop | The visibility days for the equipment booking should reflect in the grid and shows corresponding avaliable booking times for the respective equipment | `NA` | `11/17/2025`
| ---- | **Workshop:** Workshop Card Show More | Go to dashboard of respective user role | If the description of a workshop is long enough (299 characters), it should show a Show More button that redirects them to the workshop details page | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Add Workshop Add Avaliable Equipments | Go to add workshop | When trying to add equipments for the workshop, the equipment must be set as avaliable | `NA` | `11/17/2025`
| ---- | **Workshop:** Admin Add Workshop Add Price Variation Required Fields | Go to add workshop and add price variation | When trying to add price variation, errors will show up and not allow to create workshop  | `NA` | `11/18/2025`
| ---- | **Workshop:** Admin Add Workshop Delete Price Variation Required Fields | Go to add workshop and add price variation | When trying to delete price variation, you are able to do so, with price variation fields populated or not | `NA` | `11/18/2025`
| ---- | **Workshop:** Admin Add Workshop Disable Price Variation Required Fields | Go to add workshop and add/disable price variation | When trying to create a workshop, you may uncheck or check the Add Workshop Price Variations checkbox to enable price variations for this workshop or not | `NA` | `11/18/2025`
| ---- | **Workshop:** Admin Workshop Main Price Field When Selectin Price Variations | Go to add/edit workshop and add/disable price variation | When checking Add Workshop Price Variations, the main price field should be -1 in the frontend and backend and non-zero if unchecked | `NA` | `11/18/2025`
| ---- | **Workshop:** Admin Add Workshop Price Variation Sum of All Pricing Option Capacities | Go to add workshop and add/disable price variation | When checking Add Workshop Price Variations and adding price variations: sum of all pricing option capacities cannot exceed the total workshop capacity | `NA` | `11/18/2025`
| ---- | **Workshop:** Workshop Price Variation Standard Selection | Go to add/edit workshop | When adding price variations, the first variation added should be the standard selection in the workshop details | `NA` | `11/18/2025`
| ---- | **Workshop:** Admin Edit Workshop Edit Required Fields | Go to edit workshop | When editing the workshop, editing required fields will change the workshop fields properly. Deleting any required fields and not filling in required information should throw an error | `NA` | `TODO/TOFIX`
| ---- | **Workshop:** Admin Edit Workshop Workshop Image | Go to edit workshop | When editing the workshop, if an image was added, the image should show up there. The image should also to be able to be replaced and removed | `NA` | `11/19/2025`
| ---- | **Workshop:** Workshop Card Image | Go to dashboard | When a workshop is added that has a workshop image, it should show that image, otherwise it will show the default image | `NA` | `11/19/2025`
| ---- | **Workshop:** Admin Edit Workshop Multi-day Workshop Checkbox | Go to edit workshop | When an admin adds a workshop that is multi-day and an admin wants to edit it, they cannot uncheck it to make it not multi-day anymore. When an admin adds a workshop that is not multi-day and an admin wants to edit it, they cannot heck it to make it multi-day | `NA` | `11/19/2025`
| ---- | **Workshop:** Admin Edit Workshop Delete Price Variation | Go to edit workshop | You can only delete a price variation if  one is registered in it and that deleted price variation should not show up in workshop details | `NA` | `11/19/2025`
| ---- | **Workshop:** Admin Edit Workshop Add Price Variation | Go to edit workshop | You can add a price variation in edit workshop and that added price variation should not show up in workshop details | `NA` | `11/19/2025`
| ---- | **Workshop:** Workshop Card Price | Go to dashboard | If a workshop is not a price variation, there should showcase a single price. If it has a price variation, the price should show in format: "$lowestPriceVariation-$highestPriceVariation" | `NA` | `11/19/2025`
| ---- | **Workshop:** Admin Edit Workshop Cancel Price Variation | Go to edit workshop | You can only cancel a price variation if a user is registered in it and it should show up as cancelled in the workshop details and it should also show up in the Price Variations in the edit workshop route of the cancelled price variations done by the admin
 | `NA` | `11/19/2025`
| ---- | **Workshop:** Admin Edit Workshop Price Variation User Registration Count for Regular and Multi-day Workshop | Go to edit workshop | In a workshop price variation, when a user registers for it, it should up the correct number of users. This case should be considered for regular and multi-day workshops | `NA` | `11/19/2025`
| ---- | **Workshop:** Admin Edit Workshop Cancelled Price Variation Registration Email | Go to edit workshop | When an admin cancels a price variation, you need to send an email to all the people registered in that variation to notify them | `NA` | `TODO/TOFIX`
| ---- | **Workshop:** Admin Edit Workshop Cancelled Price Variation Registration Into Workshop Cancelled Events | Go to edit workshop | When an admin cancels a price variation, you need to put all these users who got cancelled in Workshop Cancelled Events to process refunds | `NA` | `TODO/TOFIX`
| ---- | **Workshop:** Admin Edit Workshop Price Variation Prices | Go to edit workshop | In a workshop price variation, the prices cannot be modified, whenever there are users registered or not | `NA` | `11/19/2025`
| ---- | **Workshop:** Admin Edit Workshop Price Variation Required Fields | Go to edit workshop | Changing any value of required fields for price variation should reflect in the price variation details shown in workshop details | `NA` | `11/19/2025`
| ---- | **Workshop:** Admin Edit Workshop Prerequisites | Go to edit workshop | If no prereqs added, then it should not show. If prereqs were added, it should show up. You are not able to modify anything related to prereqs | `NA` | `11/19/2025`
| ---- | **Workshop:** Admin Edit Workshop Remove Equipment | Go to edit workshop | You may remove equipments that have been booked because of the workshop time(s) and that should free up those time slots once removed | `NA` | `TODO/TOFIX`
| ---- | **Workshop:** Admin Edit Workshop Add Equipment | Go to edit workshop | You may add equipments that will be booked because of the workshop times and the equipments added will book those time slots if avaliable | `NA` | `11/19/2025`
| ---- | **Workshop:** Admin Edit Workshop Equipment Conflict Check | Go to edit workshop | Anytime you add a equipment to be reserved by the workshop time(s), it will check properly if it will conflict with any bookings made by users or other workshops | `NA` | `TODO/TOFIX`
| ---- | **Workshop Details:** Workshop Single Occurrence Registration With No Price Variation | Go workshop details | When a user registers for a regular workshop for a particular date, it should say register in green and a hover to cancel. If they cancel their registration, it should show up in Cancelled Events tab in admin settings with proper fields (Price Variation as NA) | `NA` | `11/19/2025`
| ---- | **Workshop Details:** Workshop Single Occurrence Registration With Price Variation | Go workshop details | When a user registers for a regular workshop for a particular date, it should say register in green and hovering over it will show you the option you registered for and its price and the cancel button. If they cancel their registration, it should show up in Cancelled Events tab in admin settings with proper fields (Price Variation as not NA) | `NA` | `11/19/2025`
| ---- | **Workshop Details:** Workshop Multi-day Registration With No Price Variation | Go workshop details | When a user registers for a multi-day workshop, it should say register in green and a hover to cancel. If they cancel their registration, it should show up in Cancelled Events tab in admin settings with proper fields (Price Variation as NA and Workshop Time(s) says Multi-Day Workshop
Connect ID: # where # a number and Multi-Day Workshop links you to the workshop details for the multi-day workshop) | `NA` | `11/19/2025`
| ---- | **Workshop Details:** Workshop Multi-day Registration With Price Variation | Go workshop details | When a user registers for a multi-day workshop, it should say register in green and a hover to cancel. Hovering over it will show you the option you registered for and its price as well. If they cancel their registration, it should show up in Cancelled Events tab in admin settings with proper fields (Price Variation as not NA and Workshop Time(s) says Multi-Day Workshop Connect ID: # where # a number and Multi-Day Workshop links you to the workshop details for the multi-day workshop) | `NA` | `11/19/2025`
| ---- | **Workshop Details:** Workshop Cancelled Button Hover on Single Occurrence Registration With No Price Variation | Go workshop details | When a user cancels their workshop registration, hovering over the cancelled button should show a register again button | `NA` | `11/19/2025`
| ---- | **Workshop Details:** Workshop Cancelled Button Hover on Multi-day Registration With No Price Variation | Go workshop details | When a user cancels their workshop registration, hovering over the cancelled button should show a register again button | `NA` | `11/19/2025`
| ---- | **Workshop Details:** Workshop Cancelled Button Hover on Single Occurrence Registration With Price Variation | Go workshop details | When a user cancels their workshop registration, hovering over the cancelled button should show a register again button and also the details of the price variation name and price | `NA` | `11/19/2025`
| ---- | **Workshop Details:** Workshop Cancelled Button Hover on Multi-day Registration With Price Variation | Go workshop details | When a user cancels their workshop registration, hovering over the cancelled button should show a register again button and also the details of the price variation name and price | `NA` | `11/19/2025`
| ---- | **Workshop:** Registering for a workshop again after cancelling their registration | Go workshop details and register again after you have cancelled a registration | When a user cancels a workshop registration and then registers again, it should be under a new Stripe Payment ID and if this registration is cancelled, the cancelled event should show that new Stripe Payment ID. Works for and should test for: Workshop Single Occurrence Registration With No Price Variation, Workshop Single Occurrence Registration With Price Variation, Workshop Multi-day Registration With No Price Variation, Workshop Multi-day Registration With Price Variation | `NA` | `11/19/2025`
| ---- | **Admin Settings:** Workshop Cancelled Events | Go admin settings and cancelled events tab | Workshops that have been cancelled by the user should show up with the correct fields: Regular workshop with no price variation, | `NA` | `11/19/2025`
| ---- | **Admin Settings:** Workshop Cancelled Events Eligible for Refund | Go admin settings and cancelled events tab | Users who cancelled within 48 hours of their registration should be fully refunded or is it if they refund 48 hours or more before the workshop start date | `NA` | `TODISCUSS`
| ---- | **Admin Settings:** Workshop Cancelled Events Resolved and Unresolved | Go admin settings and cancelled events tab | Workshop Cancelled Events that are resolved should go to the Resolved Workshop Cancelled Events and unresolved should go to Workshop Cancelled Events. These events should move depending on the Resolved checkbox | `NA` | `11/19/2025`
| ---- | **Workshop Details:** Workshop of type Workshop View Users | In a workshop of type workshop, the View Users should just show all users registered for that workshop and their result (should auto default to passed; can also be cancelled) | `NA` | `11/19/2025`
| ---- | **Workshop Details:** Workshop of type Orientation View Users | In a workshop of type orientation, the View Users should just show all users registered for that workshop and their result, it should be by default pending and admins can change users to passed individually or pass all | `NA` | `11/19/2025`
| ---- | **Workshop Details:** Duplicate Workshop | When duplicating the workshop, it can only duplicate if the workshop is Multi-day and it copies absoutely everything except Workshop Dates | `NA` | `11/19/2025`
| ---- | **Workshop Details:** Offer Again Workshop | Offer again only works for regular workshop. Offering a new workshop offering will not show any past dates from the past offering and in the edit workshop page, it will show the new offer number and adding any more dates in that edit workshop page will be of that new offer. In the workshop details page, it will still show any active days in the past offering. In the offer again page, it will the Most Recent Workshop Dates (Reference) section should show all dates from the most recent offering | `NA` | `11/19/2025`
| ---- | **Workshop Details:** Regular Workshop and Multi-day Workshop with and without Price Variations UI | The UI for workshop details should reflect if it is dependent on if it is a regular workshop or multi-day workshop and if it has or does not have a workshop price variation | `NA` | `11/19/2025`
| AC21 | **Workshop** Prerequisites | Create workshop with prerequisites; attempt registration without completing prerequisites; complete prerequisite workshop; attempt registration again | Registration blocked initially; error message displayed; registration allowed after completing prerequisites |
| ---- | **Workshop**: Admin Add Workshop Active Prerequisites | Go to add workshop | Workshops can only have prerequisites that are ACTIVE workshops of type orientation | `NA` | `11/17/2025`
| AC22 | **Workshop** Capacity | Create workshop with capacity limit (e.g., 10 spots); register 10 users; attempt registration as 11th user | Registration blocked; capacity error message displayed |
| AC23 | **Workshop** Single Occurrence Registration | Browse workshops in `/dashboard/workshops`; select workshop with single occurrence; complete registration and payment | Registration created in `UserWorkshop`; confirmation email received with workshop details, date/time, ICS attachment, Google Calendar link; redirect to `/dashboard/myworkshops` |
| AC24 | Multi-Day **Workshop** Registration | Browse workshops; select multi-day workshop (has `connectId`); review all sessions; complete registration and payment (single payment) | Multiple registrations created (one per occurrence); all registrations share same payment intent ID; confirmation email received with all session dates/times, multi-event ICS attachment, per-session Google Calendar links |
| AC25 | **Workshop** Price Variation | Create workshop with price variations (e.g., student, early bird); select price variation during registration; complete registration | Selected variation price applied to payment; variation name and description included in confirmation email |
| AC26 | **Workshop** Refund | Register for workshop; cancel workshop registration from `/dashboard/myworkshops` | Stripe refund processed; registration record deleted; cancellation confirmation email received; refund appears in Stripe dashboard |
| AC27 | Equipment Role Level Restriction | Login as Level 2 user; attempt to book equipment requiring Level 3+; upgrade to Level 3 (via membership); attempt booking again | Booking blocked initially; error message displayed; booking allowed after upgrade |
| AC28 | Equipment Prerequisites | Create equipment with prerequisite workshops; attempt booking without completing prerequisites; complete prerequisite workshop; attempt booking again | Booking blocked initially; error message displayed; booking allowed after completing prerequisites |
| AC29 | Equipment Slot Availability | Navigate to equipment booking grid; select available time slot; complete booking and payment; attempt to book same slot as another user | Booking created; slot marked as booked; booking blocked for same slot (slot unavailable) |
| AC30 | Equipment Bulk Booking | Navigate to equipment booking grid; select multiple time slots; verify total price; complete payment for total amount | Total price calculated (price per slot × slot count + GST); multiple booking records created; all bookings share same payment intent ID; all slots marked as booked; bulk confirmation email received with all slot times |
| AC31 | Equipment Refund Eligibility | Book equipment slot more than 2 days in advance; cancel booking; book equipment slot less than 2 days in advance; cancel booking | Cancellation record created with `eligibleForRefund: true` for first case; `eligibleForRefund: false` for second case |
| AC32 | Equipment Refund | Book eligible equipment slot; cancel booking | Stripe refund processed; slot marked as available; booking record deleted; cancellation confirmation email received |
| AC33 | Equipment Partial Cancellation | Book multiple equipment slots in bulk; cancel individual slots from bulk booking | Refund calculated proportionally; remaining slots remain booked; cancellation record created for cancelled slots only |
| AC34 | GST Calculation | Make payment for workshop, equipment, or membership; check Stripe dashboard | GST percentage retrieved from admin settings; GST amount calculated correctly; total amount includes GST; GST metadata stored in Stripe payment intent |
| AC35 | **Quick Checkout** (Saved Card) | Have saved payment method; select "Use Saved Card" option during checkout; complete quick checkout | Payment processed automatically; no redirect to Stripe Checkout; payment successful |
| AC36 | **Stripe Checkout Session** | Do not have saved payment method (or choose new payment); initiate checkout; complete payment on Stripe | Redirect to Stripe Checkout; redirect to success page; payment successful; session metadata correct |
| AC37 | Payment Method Storage | Add payment method during checkout; complete payment; view payment information in dashboard | Stripe customer created; payment method attached to customer; payment method set as default; payment method details stored in `UserPaymentInformation`; card details displayed correctly |
| AC38 | **Workshop** Confirmation Email | Register for workshop | Confirmation email received; email contains workshop name, date/time, location, pricing, ICS calendar attachment (downloadable), Google Calendar links (clickable) |
| AC39 | Equipment Confirmation Email | Book equipment | Confirmation email received; email contains equipment name, time slot(s), price |
| AC40 | Membership Confirmation Email | Subscribe to membership | Confirmation email received; email contains plan title, description, price (with GST breakdown), billing cycle, next billing date (for monthly), features list, access hours, payment method reminder (if needed) |
| AC41 | Membership Payment Reminder Email | Set membership due for charge within 24 hours; trigger cron job or wait for scheduled run | Payment reminder email received; email contains plan title, next payment date, amount due (with GST), payment method reminder (if needed) |
| AC42 | GST Percentage Setting | Login as admin; navigate to admin settings; update GST percentage; save settings; make a payment | New GST percentage applied; GST metadata in Stripe payment intent |
| AC43 | **Workshop** Visibility Days | Login as admin; set workshop visibility days (e.g., 30 days); create workshop with occurrence beyond visibility window; login as user; create workshop with occurrence within visibility window | Workshop not visible if beyond window; workshop visible if within window |
| AC44 | Equipment Visibility Days | Login as admin; set equipment visibility days (e.g., 14 days); create equipment slots beyond visibility window; login as user; create equipment slots within visibility window | Slots not visible in booking grid if beyond window; slots visible if within window |
| AC45 | Google Calendar Connection | Login as admin; navigate to Google Calendar settings; click "Connect Google Calendar"; complete OAuth flow; select target calendar; create/update/delete workshop occurrence | Event created in Google Calendar; event updated in Google Calendar; event deleted from Google Calendar |
| AC46 | Membership Revocation (Admin) | Login as admin; navigate to user management; select user and click "Revoke Membership"; enter custom revocation message; confirm revocation | Revocation alert shown on user's memberships page; user receives revocation email with reason and timestamp; all user memberships show "revoked" status; revocation reason and date visible in admin user list |
| AC47 | Revoked User Subscription Block | Login as revoked user; navigate to memberships page | Prominent alert displayed at top explaining membership access revoked; subscribe buttons on all membership cards disabled with tooltip; redirect to memberships page if attempting to access membership details or payment |
| AC48 | Membership Unrevocation (Admin) | Login as admin; navigate to user management; select revoked user and click "Unrevoke Membership"; confirm unrevocation | Unrevocation alert shown; user receives unrevocation email; user can now subscribe to new memberships; no historical memberships are retroactively reactivated |
| AC49 | **Brivo** Door Access Provisioning (Level 4 member) | Login as admin; ensure user has active membership with `needAdminPermission` plan; set user's `allowLevel4` flag to true; verify user role level is 4; check Brivo integration is configured; navigate to admin settings and verify user's Brivo sync status | User's `brivoPersonId` populated in database; user assigned to Brivo access groups (check Brivo dashboard); mobile pass invitation sent to user email; `brivoMobilePassId` stored in access card; door permission (ID: 0) added to access card permissions; `brivoLastSyncedAt` timestamp recorded; sync status shows "Provisioned" in admin settings | `N/A` | `11/29/2025` |
| AC50 | **Brivo** Door Access Revocation (membership cancellation) | Have Level 4 user with active membership and Brivo access provisioned; cancel user's membership; check admin settings for user's Brivo sync status; verify in Brivo dashboard | User removed from Brivo access groups (check Brivo dashboard); mobile pass revoked in Brivo; door permission (ID: 0) removed from access card permissions; `brivoMobilePassId` cleared from access cards; `brivoLastSyncedAt` timestamp updated; sync status updated in admin settings | `N/A` | `11/29/2025` |
| AC51 | **Brivo** Webhook Event Processing | Configure Brivo webhook subscription pointing to `/brivo/callback`; set `BRIVO_WEBHOOK_SECRET` environment variable; use Brivo credential (mobile pass or card) at door/equipment; check application logs; query `AccessLog` table | Webhook request received and signature verified; access event logged in `AccessLog` table with correct card ID, user ID, equipment name, and state (enter/exit/denied); response sent to Brivo with status "ok"; no errors in application logs | `N/A` | `N/A` |
| AC52 | **Brivo** Admin Configuration | Login as admin; navigate to admin settings; scroll to "Brivo Access Control" section; verify integration status; select Brivo access group from dropdown; save settings; create/delete webhook subscription | Integration status shows "✓ Brivo API Connected" if credentials configured; access group dropdown populated with available Brivo groups; selected group ID saved to `brivo_access_group_level4` setting; webhook subscription created/deleted successfully; webhook URL shows `/brivo/callback` | `N/A` | `11/29/2025` |
| AC53 | **Brivo** Sync Error Handling | Configure Brivo with invalid credentials or simulate API failure; attempt to provision user with Level 4 access; check admin settings for user's sync status; click "Retry Sync" button | Sync error message stored in `brivoSyncError` field; error badge displayed in admin user list; error details shown in sync status dialog; retry button triggers new sync attempt; if retry succeeds, error cleared and status updated | `N/A` | `11/29/2025` |
| AC54 | **Brivo** Access Event Logging | Use Brivo credential at door; check access logs in admin settings or database; verify event details | Access event appears in `AccessLog` table with: correct `accessCardId`, `userId` (if card linked), `equipment` name (door or equipment name), `state` (enter/exit/denied), `createdAt` timestamp; event visible in access logs UI if implemented | `N/A` | `N/A` |

---

### Findings and Bugs
Last Updated: 11/19/2025

- **Findings**:
  - In add payment method, the country is not all countries
  - Recent Activity in Profile does nothing
  - In a multi day orientation, you still have to pass individual times even though it is multi day [ARIQ WILL DO THIS]
  - Orientation History confusing on if workshop is single occurrence or multi day [ARIQ WILL DO THIS]
  - When we create a workshop that is not a price variation, do we want to be able to edit the workshop to add price variations and vise versa? [ARIQ WILL DO THIS]
    - STILL NEED TO DO TESTING AFTER THE OUTCOME OF THIS (EDIT WORKSHOP PRICE VARIATIONS); related to the cases of what happens if I uncheck Add Workshop Price Variation after creating a workshop that has it with or without users registered
    - The case where a user registered for a workshop with price variaitons and then we decide to remove it later causes bugs (same reasoning why we made it so that multi-day cannot be changed because of the fact that users can register and cause problems)
  - When inputing start date and time and end date and time, it should be inclusive by start date and time
    - If filter is on 2025-11-03 at 10:00 and 2025-11-05 at 10:00, it should show entries that all have a start date inside that bound
  - ~~Non-admins can access add a workshop route by going into the route /addworkshop :skull-emoji:~~
  - ~~Non-admins can access edit a workshop route by going into the route /editworkshop/workshopId :skull-emoji:~~
  - Workshop that are in the register cut-off phase can still be accessed and registered by typing URL: http://localhost:5173/dashboard/payment/:workshopID/:workshopOccurrenceID for single occurrence and http://localhost:5173/dashboard/payment/:workshopID/connect/:connectID for multi-day workshops
   - When a admin deletes all workshop dates (and there are none in the past or cancelled tabs), then admin should not be able to update workshop until a date is added, but right now, it is able to do that and is stuck on "Updating..." when pressing Update Workshop. This is for single occurrence and multi-day workshops
   - ~~When uploading anything above 5 MB as workshop image, adding the workshop in it will just be stuck on loading rather than giving an error message~~
   - When creating a price variation and it has errors of All pricing option prices must be unique and The sum of all pricing option capacities cannot exceed the total workshop capacity, in the price variation card, it shows as "All pricing option prices must be unique., The sum of all pricing option capacities cannot exceed the total workshop capacity". Fix the ".,"
   - You can create duplicate workshop dates in the same workshop (is this what we want?)
   - When editing the workshop, deleting any required fields (name, location, capacity, description, occurrences) and not filling in required information should throw an error but right now, it is stuck on loading
   - Sometimes when you replace a workshop that has a workshop image with a new image, it will redirect back to the workshops and the new image is not shown until you refresh the page
   - Need to notify users via email for users registered in a price variation that has been it cancelled by the admin
   - People whos price variation got cancelled should go into Workshop Cancelled Events to process refunds
   - When editing a workshop with a total capacity of 10 and then price variation with capacity 2 and capacity 1 (3 capacity taken by the variation). Now, when you change the capacity 2 to capacity 10, it will be obviously 11 > 10 and when you press update workshop, it will be stuck on "Updating..."
   - When having a workshop that books equipments during its workshop occurrence times slots, editing the workshop and removing that equipment and pressing Update Workshop, it does not remove the equipment from the workshop at all and in turn, does not free up the time slot (this for some reason only if you have a workshop for example with equipment Lazer Cutter and then you want to remove Lazer Cutter; the equipment will not be removed and so the slots do not free up. But if you have like Lazer Cutter and CNC Milling equipment and you remove CNC Milling, it will remove properly)
   - ~~When using quick checkout, when it is redirecting, disable the Proceed button for regular checkout~~
   - Should users who cancelled within 48 hours of their registration should be fully refunded or is it if they refund 48 hours or more before the workshop start date? [TODISCUSS]; I think right now, it is if hey refund 48 hours or more before the workshop start date
   - People could technically spam register, cancel register, register, cancel register, etc. [TODISCUSS]
   - In Workshops of type Workshop, we should probably remove the pass all button (because some users can be status cancelled)
   - Add a UI to go back to the workshßop details for View Users
   - Multi-day workshop says "Workshop Registration Has Past" or not dependent on the first occurrence in the multi day workshop (which is intended). However, it will still show up as active workshops (because the multi day can have dates in the future which is probably the reason why it will be put in active workshop). Make this show in past events, even if the multi-day workshop has other dates in the future 


- **Open Bugs**:
  - Add Workshop with Price Variation not working **[Resolved]**

---

## Developer Pointers

### Key Files

**Models (Business Logic):**
- `app/models/membership.server.ts` - Membership lifecycle, billing, role management
- `app/models/workshop.server.ts` - Workshop CRUD, occurrence management, registration
- `app/models/equipment.server.ts` - Equipment CRUD, booking, prerequisites
- `app/models/payment.server.ts` - Payment processing, refunds, Stripe integration
- `app/models/user.server.ts` - User management, role assignment
- `app/models/profile.server.ts` - Profile data, volunteer tracking
- `app/models/admin.server.ts` - Admin settings management

**Services:**
- `app/services/brivo.server.ts` - Brivo API integration (OAuth, person management, groups, mobile passes)
- `app/services/access-control-sync.server.ts` - Door access synchronization

**Utilities:**
- `app/utils/session.server.ts` - Authentication, session management, waiver generation
- `app/utils/email.server.ts` - Email composition and sending
- `app/utils/db.server.ts` - Database singleton instance
- `app/utils/googleCalendar.server.ts` - Google Calendar OAuth and event management

**Configuration:**
- `app/config/access-control.ts` - Access control configuration (door permissions, Brivo groups)

**Database:**
- `prisma/schema.prisma` - Database schema and model definitions

**Routes:**
- `app/routes/authentication/*` - Login, registration, password reset
- `app/routes/dashboard/*` - Protected user and admin interfaces
- `app/routes/api/*` - API endpoints for payments, webhooks, etc.
- `app/routes/brivo.callback.tsx` - Brivo webhook handler for access events

**Schemas (Validation):**
- `app/schemas/*.tsx` - Zod validation schemas for forms

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Type checking
npm run typecheck

# Database migrations
npx prisma migrate dev

# Database seeding
npx tsx seed.ts

# Prisma Studio (database GUI)
npx prisma studio
```

### Test Helpers

**Test Utilities:**
- `tests/helpers/test-utils.ts` - Common test utilities
- `tests/helpers/db.mock.ts` - Mock database helpers

**Fixtures:**
- `tests/fixtures/user/*` - User test data
- `tests/fixtures/workshop/*` - Workshop test data
- `tests/fixtures/equipment/*` - Equipment test data
- `tests/fixtures/session/*` - Session test data

### Testing External Services

**Stripe:**
- Use Stripe test API keys
- Mock Stripe API calls with MSW
- Test payment intents, refunds, and webhooks

**Mailgun:**
- Use Mailgun test domain
- Mock email sending with MSW
- Verify email composition and recipients

**Google Calendar:**
- Use test Google OAuth credentials
- Mock Google Calendar API calls with MSW
- Test event creation, updates, and deletion

**Brivo:**
- Use test Brivo API credentials
- Mock Brivo API calls with MSW
- Test person creation, group assignment, mobile pass generation
- Test webhook signature verification and event processing

---

## Appendix

### Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret for session cookie encryption
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_PUBLIC_KEY` - Stripe API public key
- `BASE_URL` - Application base URL (for email links)
- `WAIVER_ENCRYPTION_KEY` - AES encryption key for waiver PDFs

**Email (Mailgun):**
- `MAILGUN_API_KEY` - Mailgun API key
- `MAILGUN_DOMAIN` - Mailgun domain
- `MAILGUN_FROM_EMAIL` - Sender email address

**Password Reset:**
- `JWT_SECRET` - JWT signing secret for password reset tokens

**Google Calendar (Optional):**
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_OAUTH_REDIRECT_URI` - OAuth redirect URI
- `GOOGLE_OAUTH_ENCRYPTION_KEY` - AES encryption key for refresh token (min 32 chars)

**Brivo Access Control (Optional):**
- `BRIVO_CLIENT_ID` - Brivo OAuth client ID
- `BRIVO_CLIENT_SECRET` - Brivo OAuth client secret
- `BRIVO_USERNAME` - Brivo API username
- `BRIVO_PASSWORD` - Brivo API password
- `BRIVO_API_KEY` - Brivo API key
- `BRIVO_BASE_URL` - Brivo API base URL (optional, defaults to https://api.brivo.com/v1/api)
- `BRIVO_AUTH_BASE_URL` - Brivo OAuth base URL (optional, defaults to https://auth.brivo.com)
- `BRIVO_ACCESS_GROUP_LEVEL4` - Comma-separated list of Brivo group IDs for Level 4 access
- `BRIVO_WEBHOOK_SECRET` - Secret for webhook signature verification (optional, but recommended for production)

### Error Handling Conventions

**Model Functions:**
- Throw descriptive errors for business logic failures
- Log errors with context (userId, operation, etc.)
- Return null/empty for "not found" cases (not errors)

**Route Actions:**
- Return JSON responses with error messages for API endpoints
- Redirect with error flash messages for form submissions
- Handle Stripe errors gracefully (payment requires authentication, etc.)

**Validation:**
- Use Zod schemas for all user input
- Return field-specific error messages
- Validate at route level before model calls

**External Services:**
- Graceful degradation (email failures don't block registration)
- Retry logic for transient failures
- Comprehensive error logging

---
