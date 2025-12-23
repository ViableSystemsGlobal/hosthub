I’ll cover:

Product overview & goals

User roles & permissions

Core modules & features (detailed)

AI features – AI cards, forecasting, marketing assistant

Data model (tables & key fields)

System architecture (frontend, backend, AI, integrations)

Key flows (how it actually works in practice)

Versioning / rollout

1. Product Overview

Product name (placeholder): HostHub (you can rename later)
Type: Airbnb / short-let Owner Portal + Co-host PMS
Target: Your property management / co-hosting business and your property owners.

Core value

Give owners a transparent, professional portal to see:

Bookings, revenue, expenses, commissions, payouts, balances

Give your team a back-office system to:

Manage bookings from Airbnb / Booking.com / Instagram / Direct

Track expenses, tasks (cleaning, repairs), owner balances

Communicate with owners (chat) and send statements

Layer AI everywhere:

AI cards on major pages (insights + suggestions)

Forecasting (revenue, occupancy, cashflow)

Marketing AI assistant to improve listing performance & bookings.

Currencies

System must support multi-currency.

Immediate focus: GHS and USD

Architecture should handle additional currencies in future.

2. User Roles & Permissions
2.1 Roles

Super Admin

Full control over all data, settings, integrations, AI configuration.

Admin / Manager

Manage owners, properties, bookings, expenses, tasks, statements.

See financials & AI insights.

Access marketing AI.

Finance User

View and edit financial data (bookings, expenses, statements, payouts).

No access to system settings.

Operations User

Manage tasks (cleaning, maintenance).

View bookings & property details.

Limited financial view (e.g. gross revenue only, no commissions).

Owner

View-only access to their own properties:

Dashboard, bookings, expenses, statements, tasks summary, chat.

Can chat with team.

Sees AI insights related to their own portfolio.

Cleaner / Vendor (optional later)

Sees tasks assigned to them, marks tasks completed.

3. Core Modules & Features
3.1 Authentication & Accounts

Requirements:

Email + password login (later: magic link / OTP).

Role-based access control.

Each Owner user must be linked to one Owner record.

Password reset via email.

3.2 Owners & Properties
Owners

Data fields:

id

name

email

phone_number

whatsapp_number

preferred_channel (whatsapp, sms, email)

preferred_currency (GHS or USD initially)

payout_details (bank / MoMo)

status (active, inactive)

notes (internal)

Features:

Create / edit owners (admin).

Assign one or more properties to an owner.

Set default commission rate for that owner.

View owner-level dashboard (aggregated metrics across properties).

Properties

Data fields:

id

owner_id

name

nickname / label

address

city, country

currency (property-level currency, GHS or USD)

airbnb_listing_id (optional)

booking_com_id (optional)

instagram_handle (optional)

default_commission_rate (can override owner’s default)

cleaning_fee_rules (included or separate)

status (active, inactive)

photos (URLs)

Features:

Add/edit property.

Set commission rules per property.

View per-property:

Bookings

Expenses

P&L

AI insights & forecast.

3.3 Bookings Module

Data fields (per booking):

id

property_id

owner_id (redundant but useful)

source (airbnb, booking_com, instagram, direct, other)

external_reservation_code (Airbnb code, etc.)

guest_name (optional / initials for privacy)

check_in_date

check_out_date

nights

base_amount (before fees)

cleaning_fee

platform_fees (OTA commission)

taxes

total_payout (what hits your account)

currency (same as property currency)

fx_rate_to_base (rate to base currency)

total_payout_in_base

status (upcoming, completed, cancelled)

created_by

Features:

Admin can:

Add bookings manually.

Edit bookings (with audit logging).

Filter by property, source, date range, status.

Support CSV import for Airbnb / Booking.com payout data (MVP+).

Auto-create cleaning task when a booking is created (configurable).

3.4 Expenses Module

Data fields:

id

property_id

owner_id

date

category (cleaning, repairs, utilities, internet, supplies, other)

description

amount

currency

fx_rate_to_base

amount_in_base

paid_by (company, owner, vendor)

linked_task_id (if from maintenance/cleaning)

attachment_url (receipt / invoice)

created_by

Features:

Add/edit/delete expenses (admin/finance).

Attach receipts.

Filter by property, category, date, owner.

Owners can view (not edit) expenses tied to their properties.

3.5 Commission & Statement Engine
Commission Rules

For MVP, one core rule:

Commission = commission_rate * total_payout (per property per period)

Later: support toggles to exclude cleaning/platform fees.

Statement Generation

Statements table:

id

owner_id

period_start (date)

period_end (date)

status (draft, finalized)

display_currency (owner’s preferred)

gross_revenue (for that period)

total_expenses

commission_amount

net_to_owner

opening_balance

closing_balance

generated_at

finalized_by

pdf_url (if generated)

Statement lines:

id

statement_id

type (booking, expense, commission, adjustment)

reference_id (booking_id or expense_id)

description

amount

currency

amount_in_display_currency

Features:

Admin chooses:

Owner

Period (e.g. 1–30 November 2025)

System:

Aggregates bookings (completed in that period)

Aggregates expenses

Calculates:

Gross revenue

Commission

Net to owner

Opening & closing balance (via wallet ledger)

Admin can preview statement (draft).

Once approved:

Statement is finalized.

Owner wallet is updated.

Statement appears in Owner Portal.

Notification event is fired.

3.6 Owner Wallet / Ledger

Owner wallet table:

owner_id

current_balance (in owner’s preferred currency, e.g. GHS)

Owner transactions:

id

owner_id

date

type (statement_net, payout, manual_adjustment)

amount (+ve = owner credit, -ve = owner owes)

currency

reference_id (statement_id or payout_id)

notes

Logic:

When a statement is finalized:

Add owner_transaction of type statement_net with net_to_owner.

When you send owner a payout:

Add owner_transaction of type payout with negative amount.

current_balance is sum of all transactions.

Owner view:

Shows:

“We owe you” if balance > 0.

“You owe us” if balance < 0.

Transaction ledger with dates & descriptions.

3.7 Notifications (WhatsApp / SMS / Email)

Notifications table:

id

owner_id

type (statement_ready, payout_made, task_update, etc.)

channel (whatsapp, sms, email)

payload (JSON)

status (pending, sent, failed)

sent_at

error_message (if any)

Triggers:

On statement.status → finalized:

Create notification statement_ready.

On payout created:

Create notification payout_made.

Messages:

Short templates with variable placeholders.

Example for statement:

“Hi {{owner_name}}, your statement for {{period_label}} is ready. Net earnings: {{net_amount}} {{currency}}. View: {{link}}”

3.8 Task Management (Cleaning, Repairs)

Tasks table:

id

property_id

booking_id (nullable)

type (cleaning, repair, inspection, other)

title

description

assigned_to_user_id (or vendor)

scheduled_at

due_at

status (pending, in_progress, completed, cancelled)

cost_estimate

cost_actual

created_by

completed_at

Features:

Auto-create cleaning task when a booking is made:

scheduled_at = check_out_date

Admin/ops can:

Create tasks manually (repairs).

Assign tasks to staff.

Mark tasks completed.

Generate an expense from a task (link to expense).

Owner view:

Read-only view of tasks:

Upcoming cleanings.

Completed repairs with associated cost (linked to expenses).

3.9 Owner Chat / Messaging

Conversations:

id

owner_id

property_id (nullable - general)

created_at

last_message_at

Messages:

id

conversation_id

sender_type (owner, admin, staff)

sender_id

content

attachments (URLs)

created_at

read_at

Features:

Owner Portal:

“Messages” tab.

Start conversation (general or property-specific).

Send/receive messages.

Admin Panel:

View all conversations.

Filter by owner, property, status (unread).

Respond as “Team”.

Later: optional integration to WhatsApp for owners who prefer WA.

3.10 Multi-Currency Logic (GHS & USD)

Base assumptions:

System-level base currency: e.g. USD.

Properties can be in GHS or USD.

Owners choose a preferred display currency (GHS or USD).

For each financial record (booking, expense, transaction):

Store:

amount

currency

fx_rate_to_base (e.g. 1 GHS = 0.08 USD)

amount_in_base

Statements:

Display in owner’s preferred currency.

Conversion:

Use period average rate or latest rate (configurable).

Summaries & dashboards:

Internal: show in base currency (USD) or toggle to GHS/owner currency.

3.11 Dashboards & Pages (with AI cards)

For each main page, structure:

Metric Cards (top)

Main Table / List

AI Insight Card(s)

Admin Dashboard

Metrics:

Total active properties.

MTD Gross Revenue (base currency).

MTD Expenses.

MTD Commission.

Total owner balances (net).

Table:

Recent bookings OR owners with highest balances.

AI Card:

“Summary of this month’s performance.”

“Top 3 properties underperforming vs last month.”

Owner Dashboard

Metrics:

This month revenue (owner’s currency).

This month expenses.

This month net.

Current balance (credit / owe).

Table:

List of properties with revenue/net for the period.

AI Card:

“Narrative summary of performance + simple recommendations.”

Property Detail Page

Metrics:

Occupancy (selected period).

Revenue.

Expenses.

Net.

Table:

Either bookings or expenses (toggle).

AI Card:

“What changed vs last period for this property?”

“Forecast for next month or quarter.”

Bookings Page

Metrics:

Total bookings.

Nights.

Avg nightly rate.

Gross revenue.

Table:

Bookings list.

AI Card:

Identify seasonal trends, cancellations, etc.

Expenses Page

Metrics:

Total expenses.

By top category.

% of revenue.

Table:

Expense list.

AI Card:

Highlight abnormal categories or spikes.

Tasks Page

Metrics:

Pending tasks.

Overdue tasks.

Completed today.

Table:

Task list.

AI Card:

Suggest priorities for today / tomorrow.

Marketing (Internal AI Marketing Page)

Metrics:

Aggregated occupancy rate.

Average nightly rate vs target.

Top 3 properties with lowest occupancy.

Table:

Property performance overview.

AI Card:

Marketing strategy suggestions:

Pricing changes.

Promotions.

Listing improvements.

Social media / campaign ideas.

4. AI Features (Detailed)
4.1 AI Cards Engine

Concept: A reusable backend endpoint that, given context + metrics, returns AI-generated:

title

summary

key_points[]

suggestions[]

risk_flags[] (optional)

Inputs (per card):

Page type (admin_dashboard, owner_dashboard, property_page, bookings_page, etc.)

Time range (e.g. current month).

Aggregated metrics & key data points.

For owner-side: owner id + their data only.

Process:

Backend calculates metrics & composes a prompt with:

Raw numbers

Comparisons (month-over-month where possible)

Sends to LLM (OpenAI) with system prompt like:

“You are an analytical assistant for a property management platform…”

Returns formatted JSON via schema.

UX:

On page load, show “AI Insights” card.

Call AI endpoint once data is loaded.

Use caching (e.g. don’t regenerate every few seconds; cache per owner per period).

4.2 AI Forecasting

Scope:

Per property & per owner.

Forecast:

Monthly revenue

Occupancy rate

Possibly expenses (simple trend).

Inputs:

At least 6–12 months of historical:

Monthly bookings.

Nights stayed.

Revenue.

Seasonality hints (month, public holidays, known high seasons).

Implementation options (MVP):

Backend aggregates time series per property.

Uses a simple forecasting method (e.g.:

moving average / growth rate projection) for numeric forecast.

Sends historical data + rough prediction to LLM to:

Produce narrative explanation.

Adjust & refine forecast ranges: “Low/Expected/High”.

Outputs:

For each property:

forecast_monthly_revenue (next 3–6 months)

forecast_occupancy

Narrative: “Based on last year’s performance and current trends…”

For each owner:

Aggregated forecast across their properties.

Surfacing in UI:

AI card on Property page:

Short forecast summary + simple small chart.

AI card in Owner dashboard:

Owner-level forecast.

Dedicated “Forecast” tab (later) with more detail.

4.3 AI Marketing Assistant

Page: “Marketing AI” (internal)

Inputs:

Property data:

Location, type, # of bedrooms, amenities (later).

Performance:

Occupancy %, ADR (average daily rate), seasonality.

Channels:

Which platforms the property is listed on.

Business constraints:

Min nightly rate, target occupancy.

Features:

Per Property Marketing Plan

Suggest:

Pricing tweaks.

Possible discounts (e.g., midweek, last-minute).

Listing copy improvements (title/description ideas).

Photo suggestions (what to highlight).

Promotions for low months.

Portfolio-Level Strategy

Identify:

Underperforming properties.

Opportunities (e.g., “Convert weekend stays to 3-night minimums”, “Offer monthly rates for digital nomads”).

Campaign Generator

Generate draft content:

Instagram captions.

WhatsApp broadcast text.

Email campaigns to repeat guests (later, once guest data exists).

UX:

Admin selects:

A property OR “Portfolio view”.

Click “Generate Strategy”.

AI returns:

Sections with headings and bullet-point actions.

Option to “Copy to clipboard” or “Save as notes for this property”.

5. Data Model (Simplified Table List)

You don’t need every column here in code, but this is the skeleton:

users

roles

owners

properties

bookings

expenses

statements

statement_lines

owner_wallets

owner_transactions

payouts

tasks

conversations

messages

notifications

ai_insight_cache (optional, to store last AI response per page/owner/period)

Each financial table has:

currency

fx_rate_to_base

amount_in_base

6. System Architecture
6.1 High-level

Frontend:

Web app (React / Next.js).

Two “faces” sharing same codebase:

Admin/Team portal

Owner portal

Fully responsive for mobile (especially owner views).

Backend API:

Node.js (NestJS/Express) or similar.

REST (or GraphQL) for:

Auth

CRUD for all resources

Statement generation

Notification triggers

AI insight/forecast endpoints.

Database:

PostgreSQL.

ORM: Prisma / TypeORM.

Background worker / queue:

For:

Sending notifications (WhatsApp/SMS/email).

Generating PDFs.

Periodic tasks (e.g., re-building forecasts nightly).

AI Service:

Thin wrapper around OpenAI API:

Centralized prompts & schemas.

Handles:

AI cards

Forecast explanations

Marketing assistant

Optional “Ask your portfolio” chatbot.

External Integrations:

WhatsApp / SMS provider (e.g. Deywuro, Twilio, 360Dialog).

Email (e.g. SendGrid, Hostinger SMTP).

PDF generator service (headless browser or library).

Future: Airbnb / Booking.com APIs.

6.2 Logical Component Diagram (text form)

Frontend SPA
↔ API Gateway / Backend
↔ Postgres DB

Backend also talks to:

Notification Service (SMS/WhatsApp/Email)

AI Service

Worker / Queue (for async tasks)

File Storage (for receipts, PDFs) – e.g. S3/Blob.

6.3 API Endpoints (examples)

/auth/login, /auth/logout

/owners, /owners/:id

/properties, /properties/:id

/bookings, /bookings/import

/expenses

/tasks

/statements/generate

/statements/:id/finalize

/owners/:id/wallet

/conversations, /conversations/:id/messages

/notifications/send-pending

/ai/insights (POST – page context)

/ai/forecast (GET – per property/owner)

/ai/marketing (POST – property/portfolio context)

6.4 Security & Access

JWT-based or session-based auth.

Role-based authorization middleware on each endpoint.

Owners can access only:

Their own properties, bookings, expenses, statements, messages.

Audit logs for edits to:

Bookings, expenses, statements.

7. Key Flows
7.1 Onboarding a New Owner

Admin creates Owner record.

Admin creates Property(ies) for that owner.

Set:

Commission rate

Currency

Payout details.

Import past 1–3 months of bookings (optional).

System builds initial metrics.

Invite email sent with login.

Owner logs into portal → sees dashboard, bookings, etc.

7.2 Monthly Statement Generation & Notification

At end of period:

Admin selects Owner + Date range (e.g. Nov 1–30).

Backend:

Pulls bookings & expenses for that owner’s properties in period.

Calculates commission & net.

Builds draft statement.

Admin reviews:

Can adjust (e.g., manual adjustments).

Admin clicks Finalize statement:

Statement status → finalized.

Owner wallet transaction created.

PDF generated and stored.

Notification created (statement_ready).

Notification service:

Sends WhatsApp/SMS/email message with link.

Owner logs in:

Sees statement, download PDF.

AI card summarises:

“This month vs last month.”

Highlights key changes.

7.3 AI Card Generation (example: Owner Dashboard)

Owner opens dashboard.

Frontend:

Calls /owners/:id/summary to get metrics.

Renders metric cards & tables.

Frontend then calls /ai/insights with:

page = "owner_dashboard"

owner_id

period = this month

Metrics + comparisons.

Backend:

Optionally checks ai_insight_cache.

If no cache or expired:

Builds prompt with metrics.

Calls OpenAI.

Parses JSON.

Stores in ai_insight_cache.

Returns AI insight.

Frontend displays AI card.

7.4 Forecast Generation (Property)

Admin/Owner opens Property page → Forecast section.

Frontend calls /ai/forecast?property_id=X.

Backend:

Aggregates last N months of revenue & occupancy.

Builds quick numeric forecast (simple model).

Sends data + context to AI to:

Validate.

Wrap in narrative + ranges.

Returns:

Forecasted values.

AI explanation + suggestions.

UI:

Show small line chart + AI text.

7.5 Marketing AI Workflow

Admin goes to Marketing AI page.

Selects:

Single property OR “All properties”.

Backend aggregates:

Current performance metrics.

Historical trends.

Frontend calls /ai/marketing with this context.

AI returns:

Strategy bullets.

Content ideas.

Pricing suggestions.

Admin:

Copies and uses in Airbnb listings, social posts, etc.

Optionally saves “Marketing Plan” as notes for that property.

8. Versioning / Build Phases (Suggested)
Phase 1 – Core PMS + Owner Portal

Auth, roles.

Owners, properties.

Bookings & expenses.

Commission & statements.

Owner wallet & balances.

Owner dashboard (basic metrics).

Admin dashboard.

Multi-currency data model (GHS & USD).

Basic AI card: statement summary only.

Phase 2 – AI Everywhere + Ops

AI cards on major pages (owner/admin/property/bookings/expenses).

Forecast API & UI.

Task management (cleaning/repairs).

Owner chat / messaging.

WhatsApp/SMS notifications for statement ready.

Better PDF statements.

Phase 3 – Advanced AI & Marketing

Full Marketing AI page.

Anomaly detection (weird expenses, drops in revenue).

“Ask your portfolio” chatbot (owner & internal).

Airbnb/Booking.com direct integrations (if desired).

