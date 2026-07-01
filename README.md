# 🚗 FixIT – A Web-Based AI Diagnostic and Mechanic Service System

FixIT is an AI-powered vehicle assistance web application that connects vehicle owners with verified mechanics through real-time booking, live location tracking, AI-assisted vehicle diagnostics, transparent repair cost estimation, and digital service documentation.

The application aims to simplify the process of obtaining roadside assistance while providing vehicle owners with accurate diagnostic information, transparent pricing, and reliable service management.

---

# Features

## Vehicle Owners

- Email, Google, and Facebook authentication
- AI-assisted vehicle diagnostics
- Vehicle management
- Mechanic booking
- Live mechanic tracking
- Transparent repair cost estimates
- Digital invoices
- Service history
- Ratings and reviews
- Profile management

## Mechanics

- Mechanic registration and verification
- Booking request management
- Live location sharing
- Job status updates
- Digital invoice generation
- Customer messaging
- Profile management

## Administrators

- User management
- Mechanic verification
- Booking monitoring
- Invoice monitoring
- Transaction reports

---

# Technologies Used

## Frontend

- Next.js 15
- React
- TypeScript
- Tailwind CSS

## Backend

- Next.js Route Handlers
- Prisma ORM
- PostgreSQL
- Better Auth

## APIs

- Groq API (AI Vehicle Diagnostics)
- OpenStreetMap
- Leaflet
- Nominatim Reverse Geocoding
- Twilio (SMS OTP)

---

# Project Structure

```
app/
components/
lib/
prisma/
public/
types/
```

Important folders:

```
app/
    dashboard/
    signIn/
    signUp/
    mechanicSignUp/
    admin/

components/
    auth/
    dashboard/
    profile/
    tracking/
    chat/

lib/
    auth.ts
    auth-client.ts
    prisma.ts
    groq.ts
    gemini.ts

prisma/
    schema.prisma
```

---

# Prerequisites

Install the following before running the project:

- Node.js 20+
- PostgreSQL
- npm
- Git

---

# Installation

Clone the repository.

```bash
git clone https://github.com/yourusername/fixit.git
```

Go to the project folder.

```bash
cd fixit
```

Install dependencies.

```bash
npm install
```

---

# Environment Variables

Create a `.env` file.

```env
DATABASE_URL=

BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=

GROQ_API_KEY=

GEMINI_API_KEY=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

---

# Database Setup

Generate the Prisma Client.

```bash
npx prisma generate
```

Run database migrations.

```bash
npx prisma migrate dev
```

(Optional)

Open Prisma Studio.

```bash
npx prisma studio
```

---

# Running the Application

Start the development server.

```bash
npm run dev
```

Open your browser.

```
http://localhost:3000
```

---

# Usage

## Vehicle Owner

1. Create an account.
2. Add one or more vehicles.
3. Use AI Diagnostics (optional).
4. Book a mechanic.
5. Review the estimated repair cost.
6. Track the mechanic in real time.
7. View the digital invoice.
8. Pay the mechanic outside the application.
9. Rate the completed service.

---

## Mechanic

1. Register as a mechanic.
2. Wait for administrator verification.
3. Accept or decline booking requests.
4. Share live location.
5. Update repair progress.
6. Generate the digital invoice.
7. Complete the service.

---

## Administrator

1. Verify mechanic applications.
2. Monitor users.
3. Monitor bookings.
4. Review invoices.
5. Generate reports.

---

# Authentication

The application uses Better Auth.

Supported login methods:

- Email & Password
- Google OAuth
- Facebook OAuth

Optional:

- Two-Factor Authentication (OTP)

---

# AI Features

## AI Vehicle Diagnostics

Powered by **Groq API**.

Provides:

- Possible vehicle issues
- Repair recommendations
- Estimated repair cost
- Suggested nearby mechanics

---

## Sentiment Analysis

Powered by **Groq API**.

Analyzes customer reviews as:

- Positive
- Neutral
- Negative

---

# Live Tracking

Uses:

- Browser Geolocation API
- Leaflet
- OpenStreetMap

Mechanics share their location during active bookings while vehicle owners can monitor their arrival in real time.

---

# Digital Invoicing

FixIT generates digital invoices containing:

- Labor costs
- Spare parts
- Repair summary
- Total amount
- Service information

**Note**

Payments are **not processed inside the application**.

Payments are made directly between the vehicle owner and mechanic (e.g., cash upon completion). The application only records pricing information and service documentation.

---

# Testing

User Acceptance Testing (UAT) was conducted with:

- Vehicle Owners
- Mechanics
- IT Experts
- Administrators

Evaluation categories:

- Functional Sustainability
- Performance Efficiency
- Interaction Compatibility
- Reliability
- Security

---

# Future Improvements

- Online payment integration
- Spare parts inventory
- Appointment scheduling
- Mobile application
- AI predictive maintenance
- Mechanic route optimization

---

# Contributors

- Robert Tamosa
- Capstone Project Team

---

# License

This project was developed for academic purposes as part of a capstone project.

All rights reserved.