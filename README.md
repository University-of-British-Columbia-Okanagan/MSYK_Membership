# MYSK Membership Management System

A comprehensive membership management platform built with React Router, TypeScript, and Prisma, designed to manage makerspace memberships, workshops, equipment bookings, and volunteer coordination.

## Table of Contents

- [Local Development Setup](#local-development-setup)
- [System Architecture & Database Schema](#system-architecture--database-schema)
- [API Documentation](#api-documentation)

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

## API Documentation

*This section is a placeholder for comprehensive API documentation including:*

- Authentication endpoints
- User management APIs
- Membership plan management
- Workshop booking system
- Equipment reservation APIs
- Payment processing integration
- Administrative functions
- Volunteer time tracking

*Documentation will include request/response schemas, authentication requirements, rate limiting, and example implementations.*