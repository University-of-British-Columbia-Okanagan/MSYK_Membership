# MYSK Membership Management System

A comprehensive membership management platform built with React Router, TypeScript, and Prisma, designed to manage makerspace memberships, workshops, equipment bookings, and volunteer coordination.

## Table of Contents

- [Local Development Setup](#local-development-setup)
- [User Documentation](#user-documentation)
- [Technical Documentation](#technical-documentation)
- [System Architecture & Database Schema](#system-architecture--database-schema)
- [Components Architecture](#components-architecture)
- [Backend Models & Data Layer](#backend-models--data-layer)

## Local Development Setup

### Prerequisites

**Minimum Requirements:**
- Node.js 20+
- React 18+
- React DOM 18+

**Recommended (Latest as of January 2025):**
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
   POSTGRES_USER=
   POSTGRES_PASSWORD=
   POSTGRES_DB=
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA"
   SESSION_SECRET=
   STRIPE_SECRET_KEY=
   STRIPE_PUBLIC_KEY=
   BASE_URL=
   WAIVER_ENCRYPTION_KEY=
   ```
   
   Replace the placeholders with your pgAdmin 4 credentials:
   - `USER`: Your PostgreSQL username
   - `PASSWORD`: Your PostgreSQL password
   - `HOST`: Database host (typically `localhost`)
   - `PORT`: Database port (typically `5432`)
   - `DATABASE`: Your database name
   - `SCHEMA`: Database schema (typically `public`)

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

- **Database Seeding:** `npx tsx seed.ts`
- **Prisma Studio:** `npx prisma studio`

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
3. Complete required consent agreements (media, data privacy, community guidelines)
4. Login with credentials at `/login`

### For Registered Users (Members)

**Dashboard Access:**
After login, users are redirected to role-appropriate dashboards:
- Regular users: `/dashboard/user`
- Admins: `/dashboard/admin`

**Core Features:**

**Workshop Management:**
- Browse available workshops and orientations in `/dashboard/workshops`
- Register for workshops with automatic prerequisite checking
- View workshop details, pricing, and capacity information
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
- Automated monthly billing with Stripe integration
- Membership status tracking and payment history
- Access level changes based on membership status

**Profile & Volunteer System:**
- Manage personal profile information in `/dashboard/profile`
- Log volunteer hours with approval workflow in `/dashboard/volunteer`
- Track volunteer status and activity history
- Update payment information and download waivers

**Payment Integration:**
- Secure payment processing through Stripe
- Saved payment methods for recurring charges
- GST calculation and billing address management
- Payment success confirmations and receipt handling

### For Administrators

**Extended Dashboard Features:**

**User Management:**
- View all registered users in `/dashboard/admin/users`
- Modify user roles and permission levels
- Track volunteer status across all users
- Manage user-specific settings and overrides

**Workshop Administration:**
- Create new workshops in `/dashboard/addworkshop`
- Edit existing workshops with occurrence management in `/dashboard/editworkshop/:id`
- Offer workshops again with new occurrence scheduling in `/dashboard/workshops/offer/:id`
- Manage workshop prerequisites and pricing variations
- View workshop registrations and user management in `/dashboard/admin/workshop/users`

**Equipment Administration:**
- Add new equipment in `/dashboard/addequipment`
- Edit equipment details and availability in `/dashboard/equipment/edit/:id`
- Configure equipment prerequisites and booking restrictions
- Monitor all equipment bookings in `/dashboard/allequipmentbooking`

**System Configuration:**
- Configure system settings in `/dashboard/admin/settings`
- Set visibility days for workshops and equipment booking windows
- Manage GST percentages and operational hours
- Configure planned closures and maintenance schedules

**Reporting & Monitoring:**
- Access system reports in `/dashboard/admin/reports`
- View server logs and system status in `/dashboard/logs`
- Monitor issue reports and user feedback in `/dashboard/report`

## Technical Documentation

### Recent Implementation Changes

**Workshop Offer Again Functionality:**
We implemented the workshop offer system to address the need for recurring workshop scheduling while maintaining historical data integrity. The system now uses an `offerId` approach where:
- Each workshop can have multiple "offers" (sets of occurrences)
- Users see only the latest active offer when browsing
- Historical registrations and data are preserved across offers
- Admins can easily reschedule workshops without losing registration history
- Equipment conflicts are checked across all active offers to prevent double-booking

**Enhanced Equipment Booking System:**
The equipment booking system was redesigned to support both individual user bookings and workshop-integrated equipment usage:
- Time-slot based booking with 30-minute intervals
- Role-based restrictions for Level 3 and Level 4 users
- Workshop prerequisite validation for equipment access
- Bulk equipment booking during workshop registration
- Real-time conflict detection and availability checking

**Membership System Improvements:**
The membership management system was enhanced with:
- Flexible upgrade and downgrade paths with prorated billing
- Automated monthly payment processing with GST calculation
- Payment method storage and recurring billing integration
- Membership status impact on user role levels and access permissions
- Comprehensive cancellation and refund handling through Stripe

**Volunteer Hour Tracking:**
Implemented a comprehensive volunteer management system featuring:
- Time logging with overlap detection to prevent duplicate entries
- Approval workflow for volunteer hour validation
- Resubmission capability for denied or modified entries
- Integration with user role levels and membership benefits
- Historical tracking and reporting for volunteer activities

### Project Structure

**Root Level Configuration:**
- `prisma/schema.prisma`: Database schema and model definitions
- `package.json`: Dependencies and scripts configuration
- `routes.ts`: Application routing configuration
- `.env`: Environment variables and configuration settings

**Application Structure:**
```
~/routes/
├── authentication/          # Login, registration, password reset
├── api/                     # Server-side API endpoints
├── dashboard/              # Protected user and admin interfaces

~/components/
├── ui/
│   ├── Dashboard/         # Dashboard-specific components
│   └── [shadcn-ui]/      # Design system components

~/models/                  # Server-side business logic
├── user.server.ts         # User management and authentication
├── workshop.server.ts     # Workshop lifecycle and registration
├── equipment.server.ts    # Equipment booking and management
├── membership.server.ts   # Membership plans and billing
├── payment.server.ts      # Stripe integration and payments
├── profile.server.ts      # User profiles and volunteer tracking
└── admin.server.ts        # Administrative settings and controls

~/utils/                   # Utility functions and helpers
├── session.server.ts      # Authentication and session management
├── db.server.ts          # Database connection and configuration
└── [other utilities]     # Various helper functions
```

**Key Implementation Details:**

**Role-Based Access Control (RBAC):**
The system implements a sophisticated RBAC system with:
- Role levels 1-4 with increasing privileges
- Special `allowLevel4` flag for advanced equipment access
- Dynamic permission checking throughout the application
- Role-dependent navigation and feature access

**Database Design Patterns:**
- Soft deletion patterns for data integrity
- Cascade relationships for related entity cleanup
- Unique constraints to prevent duplicate bookings
- Indexed fields for performance optimization on frequent queries
- JSON fields for flexible feature storage in membership plans

**Security Implementation:**
- Prisma ORM for SQL injection prevention
- Input validation using Zod schemas throughout
- Session-based authentication with secure cookie handling
- Payment information encryption and PCI compliance considerations
- Role-based data isolation ensuring users can only access appropriate data

**Performance Optimizations:**
- Strategic database indexing on frequently queried fields
- Efficient relationship loading with Prisma include/select
- Caching strategies for frequently accessed admin settings
- Optimized query patterns to minimize N+1 problems

**Integration Architecture:**
- Stripe webhooks for reliable payment processing
- Email integration through Mailgun for notifications
- PDF generation for waivers and documentation
- Server-side rendering with React Router for SEO and performance

**Error Handling and Logging:**
- Comprehensive error logging with structured context
- User-friendly error messages while preserving technical details
- Graceful degradation for external service failures
- Database transaction handling for data consistency

### Testing and Quality Assurance

**Development Workflow:**
- TypeScript for compile-time type checking
- Prisma Client for type-safe database operations
- Real-time development server with hot reloading
- Database migrations with rollback capability

**Database Management:**
- Migration-based schema changes for version control
- Seeding scripts for development and testing data
- Prisma Studio for visual database management
- Backup and restore procedures for production environments

## System Architecture & Database Schema

The MYSK Membership system is built on a robust PostgreSQL database with the following core entities and relationships:

### Core Models

#### User Management
- **User**: Central user entity storing personal information, contact details, emergency contacts, and consent records
- **RoleUser**: Role-based access control with User and Admin roles
- **UserPaymentInformation**: Stripe integration for payment processing with encrypted card details

#### Membership System
- **MembershipPlan**: Flexible membership plans with JSON-stored features and access hours
- **UserMembership**: Active membership tracking with payment schedules and status management

#### Workshop & Training System
- **Workshop**: Workshop definitions with pricing, capacity, and cancellation policies
- **WorkshopOccurrence**: Specific workshop instances with date/time scheduling
- **UserWorkshop**: Workshop enrollment tracking with completion results
- **WorkshopPrerequisite**: Prerequisite chain management for advanced workshops
- **WorkshopPriceVariation**: Flexible pricing options for different workshop configurations

#### Equipment Management
- **Equipment**: Equipment inventory with descriptions and availability status
- **EquipmentSlot**: Time-based booking slots for equipment usage
- **EquipmentBooking**: Booking management with user and workshop allocation
- **EquipmentPrerequisite**: Workshop prerequisites required for equipment access

#### Volunteer Management
- **Volunteer**: Volunteer registration with start/end date tracking
- **VolunteerTimetable**: Time logging system with approval workflow

#### Administrative Tools
- **AdminSettings**: Key-value configuration storage for system settings
- **Issue**: Issue tracking system with priority levels and status management
- **IssueScreenshot**: File attachments for issue documentation

### Key Features & Relationships

**Role-Based Access Control**
- Users assigned roles (User/Admin) with role levels 1-4
- Special `allowLevel4` flag for advanced permissions

**Workshop Prerequisites Chain**
- Workshops can require completion of other workshops
- Equipment access tied to specific workshop completions
- Prevents booking without proper qualifications

**Payment Integration**
- Stripe customer and payment method storage
- Encrypted card information with PCI compliance considerations
- Billing address and payment history tracking

**Booking System**
- Time-slot based equipment reservations
- Workshop capacity management
- Conflict prevention with unique constraints

**Audit & Compliance**
- Comprehensive consent tracking (media, data privacy, community guidelines)
- Waiver signature storage
- Emergency contact information for safety compliance

### Database Relationships

The schema implements several key relationship patterns:

- **One-to-Many**: User → UserMembership, User → UserWorkshop, User → EquipmentBooking
- **Many-to-Many**: Workshop ↔ Workshop (prerequisites), Equipment ↔ Workshop (prerequisites)
- **Cascade Deletions**: User deletions cascade to related bookings and memberships
- **Unique Constraints**: Prevent duplicate bookings and workshop registrations

### Technology Stack

**Backend:**
- **Prisma ORM**: Type-safe database access and migrations
- **PostgreSQL**: Primary database with ACID compliance

**Frontend:**
- **React Router**: Modern full-stack React framework with SSR
- **TypeScript**: Type safety throughout the application
- **Tailwind CSS**: Utility-first styling framework

**External Integrations:**
- **Stripe**: Payment processing and subscription management

## Components Architecture

### Component Organization

#### shadcn/ui Foundation
The project leverages **shadcn/ui** as its design system foundation, configured with:
- **Style**: New York variant for modern aesthetics
- **Base Color**: Zinc for neutral theming
- **Icon Library**: Lucide React for consistent iconography
- **CSS Variables**: Enabled for dynamic theming support

**Core shadcn Components Used:**
- **Form Components**: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormMessage`, `FormControl`
- **UI Elements**: `Button`, `Badge`, `Textarea`, `Tabs`, `AlertDialog`, `Tooltip`, `Sidebar`
- **Interactive Components**: `AlertDialogAction`, `AlertDialogCancel`, `TooltipProvider`, `SidebarProvider`

#### Custom Component Structure

**Directory Structure:**
```
~/components/
└── ui/
    └── Dashboard/          # Admin & user dashboard components
```

### Dashboard Components (`~/components/ui/Dashboard/`)

#### Layout & Navigation Components
- **AppSidebar**: Main user navigation sidebar with workshop, equipment, and profile links
- **AdminAppSidebar**: Enhanced admin sidebar with management capabilities
- **GuestAppSidebar**: Limited navigation for unauthenticated users
- **SidebarProvider**: Layout wrapper managing sidebar state and responsive behavior

#### Form & Input Components
- **GenericFormField**: Reusable form field wrapper with validation and error handling
- **DateTypeRadioGroup**: Radio group selector for workshop date types (single, multi-day, recurring)
- **MultiSelectField**: Multi-selection dropdown for equipment and prerequisite selection
- **RepetitionScheduleInputs**: Time-based input controls for recurring workshop schedules

#### Workshop Management Components
- **WorkshopList**: Unified workshop display component supporting both user and admin views
- **OccurrenceRow**: Individual workshop occurrence display with date/time formatting
- **OccurrencesTabs**: Tabbed interface for managing multiple workshop occurrences
- **ConfirmButton**: Action confirmation component with loading states

#### Equipment Management Components
- **EquipmentBookingGrid**: Complex grid component for time-slot based equipment reservations
  - **SlotsByDay**: Type definition for day-organized time slots
  - Visual conflict detection and booking status indicators
  - Integration with workshop equipment requirements

### Integration Patterns

#### Form Management
Components utilize **React Hook Form** with **Zod validation** for type-safe form handling:
```typescript
// Example from workshop forms
const form = useForm<WorkshopFormValues>({
  resolver: zodResolver(workshopFormSchema),
  defaultValues: { ... }
});
```

#### State Management
- **Component-level state** for UI interactions and temporary data
- **Server state** managed through React Router loaders and actions
- **Form state** handled by React Hook Form for complex forms

#### Styling & Theming
- **Tailwind CSS** utility classes for responsive design
- **CSS Variables** for dynamic theming support
- **Consistent spacing** and color schemes across components

## Backend Models & Data Layer

The MYSK Membership system implements a comprehensive backend data layer through server-side models that handle all business logic, database operations, and external service integrations. These models follow a modular architecture pattern with clear separation of concerns.

### Model Organization

Most backend models are located in the `~/models/` directory and follow the naming convention `*.server.ts` to indicate server-side execution. Each model focuses on a specific domain and provides type-safe operations through Prisma ORM. Some backend functionality is in the `~/routes/api/` folder as well.

### Core Model Files

#### User Management (`user.server.ts`)
**Responsibilities:**
- User authentication and authorization
- Role-based access control (RBAC) management
- User profile CRUD operations
- Volunteer status tracking and management
- Payment method storage and retrieval

**Key Functions:**
- `getAllUsersWithVolunteerStatus()`: Admin user management with volunteer tracking
- `updateUserRole()`: Role assignment and permission management
- `updateUserAllowLevel()`: Advanced permission level controls
- `getSavedPaymentMethod()`: Stripe payment method retrieval

#### Workshop Management (`workshop.server.ts`)
**Responsibilities:**
- Workshop and orientation lifecycle management
- Workshop occurrence scheduling and capacity tracking
- User registration and prerequisite validation
- Multi-day workshop coordination
- Workshop duplication and offering management

**Key Functions:**
- `getWorkshops()`: Retrieve all workshops with occurrence details
- `addWorkshop()`: Create new workshops with occurrence scheduling
- `updateWorkshopWithOccurrences()`: Workshop editing with occurrence management
- `getUserWorkshopRegistrations()`: User-specific workshop enrollment tracking
- `getMultiDayWorkshopUserCount()`: Capacity management for multi-day events
- `offerWorkshopAgain()`: Create new workshop offers with unique offer IDs

#### Equipment Management (`equipment.server.ts`)
**Responsibilities:**
- Equipment inventory and availability tracking
- Time-slot based booking system
- Role-based booking restrictions (Level 3/4 users)
- Prerequisite validation for equipment access
- Equipment-workshop integration for bulk bookings

**Key Functions:**
- `getAvailableEquipment()`: Equipment listing with real-time availability
- `bookEquipment()`: Individual equipment booking with validation
- `getEquipmentSlotsWithStatus()`: Time-slot management with booking status
- `getUserCompletedEquipmentPrerequisites()`: Prerequisite verification
- `bulkBookEquipment()`: Workshop-based equipment reservations

#### Profile & Volunteer Management (`profile.server.ts`)
**Responsibilities:**
- User profile data aggregation
- Volunteer hour tracking and approval workflow
- Volunteer status management
- Time logging with overlap detection
- Volunteer activity reporting

**Key Functions:**
- `getProfileDetails()`: Comprehensive user profile data
- `logVolunteerHours()`: Time entry with validation and approval workflow
- `checkActiveVolunteerStatus()`: Volunteer eligibility verification
- `getVolunteerHours()`: Historical volunteer activity retrieval
- `checkVolunteerHourOverlap()`: Conflict detection for time entries

#### Membership Management (`membership.server.ts`)
**Responsibilities:**
- Membership plan management and pricing
- User membership subscription tracking
- Automated monthly membership processing
- Payment integration for recurring subscriptions
- Membership feature and access control

**Key Functions:**
- `getMembershipPlans()`: Available subscription options
- `addMembershipPlan()`: Admin plan creation and configuration
- `updateMembershipPlan()`: Plan modification and feature updates
- `startMonthlyMembershipCheck()`: Automated subscription processing

#### Administrative Controls (`admin.server.ts`)
**Responsibilities:**
- System-wide configuration management
- Dynamic settings storage and retrieval
- Workshop and equipment visibility controls
- Operational hour restrictions
- Planned closure management

**Key Functions:**
- `getAdminSetting()`: Dynamic configuration retrieval
- `updateAdminSetting()`: System setting modifications
- `getWorkshopVisibilityDays()`: Workshop booking window management
- `getEquipmentVisibilityDays()`: Equipment booking horizon controls
- `getPastWorkshopVisibility()`: Historical event display management

#### Payment Processing (`payment.server.ts`)
**Responsibilities:**
- Stripe payment integration
- Checkout session creation
- Subscription management
- Payment method handling
- Transaction processing and webhooks

**Key Functions:**
- `createCheckoutSession()`: Stripe payment flow initialization
- Payment webhook processing for subscription updates
- Payment method storage and retrieval
- Transaction history tracking

#### Error Handling & Logging
All models implement comprehensive error handling with structured logging:
```typescript
// Example error handling pattern
try {
  const result = await db.operation();
  logger.info('Operation successful', { userId, operation: 'example' });
  return result;
} catch (error) {
  logger.error('Operation failed', { error, userId, context });
  throw new Error('User-friendly error message');
}
```

#### Type Safety & Validation
Models leverage TypeScript and Prisma for end-to-end type safety:
- **Prisma Client**: Auto-generated types for database operations
- **Zod Schemas**: Runtime validation for user inputs
- **Custom Types**: Domain-specific interfaces and type definitions

### Security & Authorization

#### Role-Based Access Control
Models enforce role-based permissions at the data layer:
- **Admin Functions**: Restricted to admin role verification
- **User Permissions**: Role level and flag-based access controls
- **Data Isolation**: Users can only access their own data

#### Input Sanitization
All user inputs are validated and sanitized:
- **SQL Injection Prevention**: Prisma parameterized queries
- **XSS Protection**: Input validation and encoding
- **Data Validation**: Zod schema enforcement