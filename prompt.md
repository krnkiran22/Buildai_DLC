# Build AI Project Prompt

Create a production-ready internal operations platform called **Build AI** for managing deployment hardware, SD card logistics, QR-based packet tracking, ingestion processing, and team accountability across factory deployments.

The system must be built as a clean, reliable workflow product for internal teams. The frontend should use **Next.js with TypeScript**. The backend should use **Python**. The UI must be **standard, minimal, black-and-white, clean, and professional**. Avoid flashy gradients, oversized cards, noisy dashboards, or decorative clutter. The interface should feel like a modern operational product, not a demo.

## Product Goal

Build a system that tracks the full lifecycle of hardware and SD cards used for factory deployments:

- factory teams request devices and SD cards
- logistics reviews requests and chats with requesters
- logistics approves or rejects requests
- logistics ships hardware and SD cards
- factory teams receive and later return SD card packets
- HQ receives the returned packets
- ingestion team processes returned SD cards
- admins and logistics track discrepancies, movement history, and merit score

The main business problem is traceability. At any time, the company should know:

- who requested the items
- what was approved
- what was shipped
- what was actually received at the factory
- what was returned
- what reached HQ
- what moved into ingestion
- how many SD cards were processed
- how many items are missing or faulty

## User Roles

### 1. Factory Operator

- can self-register with email, password, and OTP verification
- can log in and raise deployment tickets
- can chat inside tickets
- can view ticket tracking
- can confirm return-side status changes
- can scan public QR codes and edit packet details within allowed rules

### 2. Logistics

- account is created privately by admin/backend
- can log in and view all relevant tickets
- can chat inside tickets
- can accept or reject tickets
- can mark shipment-related status changes
- can generate QR batches
- can receive returned packets at HQ
- can transfer packets to ingestion
- can close tickets

### 3. Ingestion

- can self-register with email, password, and OTP verification
- can log in and see ingestion inventory
- can chat inside tickets
- can mark ingestion progress
- can submit ingestion reconciliation
- can close tickets

### 4. Admin

- account is created privately by backend
- has full system visibility
- can manage users and inventory
- can override QR edit lock after end of day
- can edit inventory
- can close tickets
- can view movement history, merit scores, and operational state

## Core Ticket Model

The system is **ticket-first**.

Every deployment or movement request starts as a ticket.

There are two main ticket types:

- `deployment`
- `transfer`

### Deployment Ticket

Used when a factory team requests devices, SD cards, and other items for a deployment.

### Transfer Ticket

Used when devices or inventory move from one factory/team to another instead of returning directly to HQ.

This must preserve chain-of-custody, for example:

`HQ -> Factory A -> Factory B`

## Ticket Creation Rules

Factory operators create tickets with:

- team name
- factory name
- deployment date
- worker count
- requested device count
- requested SD card count
- requested accessory counts such as chargers, USB hubs, cables, adapters, extension boxes
- priority
- optional notes

For transfer tickets also include:

- source team name
- source factory name
- optional linked source ticket ID

The system must automatically generate a readable ticket title in this format:

`[Team Name] | [Factory Name] | Deploy [Date] | Devices [X] | SD Cards [Y]`

## Ticket Chat

Every ticket contains chat between the requester and operations staff.

The chat experience should be one of the primary screens in the application.

The ticket management UI should feel similar to a clean chat product:

- left side: list of tickets
- center: full ticket conversation
- right side: ticket details, tracking, actions, packet details

Important chat requirements:

- messages appear in a conversation interface, not as dashboard comments
- latest tickets should sort first in the ticket list
- support reply-to-message
- support websocket/live updates
- support smooth message delivery and reconnect behavior

## Ticket Status Flow

Use a vertical tracking history similar to order tracking.

Primary ticket stages:

1. `open`
2. `accepted` or `rejected`
3. `outbound_shipped`
4. `factory_received`
5. `return_shipped`
6. `hq_received`
7. `transferred_to_ingestion`
8. `ingestion_processing`
9. `ingestion_completed`
10. `closed`

Role-based status permissions:

- factory operator:
  - create tickets
  - mark return-side steps
- logistics:
  - accept or reject
  - mark outbound shipped
  - mark factory received
  - mark HQ received
  - transfer to ingestion
  - close tickets
- ingestion:
  - mark ingestion processing
  - mark ingestion completed
  - close tickets
- admin:
  - can do all actions

## QR Code and Packet Flow

QR is critical.

Each shipment packet must have QR labels generated by logistics.

Important rule:

When logistics creates a QR batch, they should only fill the form **once** for a single team/factory batch, but the system should generate multiple QR labels with **different unique IDs**.

Example:

- logistics enters label count = 5
- system creates 5 QR labels
- all 5 start with the same base shipment context
- each QR token is unique
- each QR can later be edited independently after scan

### QR Batch Creation Inputs

- label count
- shipped SD cards count
- shipped devices count
- shipped USB hubs count
- shipped cables count
- shared note
- team name
- factory name

### QR Public Page

When a QR code is scanned, it must open a **public page with no login required**.

That page must show:

- team name
- factory name
- deployment date
- shipped counts
- received counts
- packet code
- QR token

Factory-side users must be able to edit:

- team name
- factory name
- deployment date
- received SD card count
- received device count
- received USB hub count
- received cable count
- note

### QR Edit Window Rule

- after the first save, the public QR form remains editable only until end of that same day
- after end of day, public editing locks
- admin must be able to override that lock from the logged-in dashboard

### Ingestion QR Usage

When ingestion scans the QR later, they should immediately see:

- team name
- factory name
- deployment date
- SD card quantities

This avoids manual typing in the ingestion room.

## Ingestion Flow

Returned SD cards go to the ingestion team after HQ receives the packet.

The ingestion team must see an ingestion inventory queue with:

- team name
- factory name
- deployment date
- packet code
- expected SD card count
- status

They must be able to:

- open a packet
- mark ingestion as started
- submit ingestion reconciliation
- mark ingestion completed

### Ingestion Reconciliation Fields

- station
- expected SD cards
- actual SD cards received
- processed SD cards
- missing SD cards
- faulty SD cards
- note

This data is used to detect missing returns and damaged cards.

## Device and Inventory Movement

The platform must support device movement history beyond simple request/return.

Example use case:

- HQ ships devices to Factory A
- Factory A later sends devices to Factory B
- Factory B raises a request to receive those devices

The system must show full movement history for devices and related inventory.

This should be visible to admin and logistics in a movement ledger view.

## Merit Score System

Each team should have a visible merit score to track how responsibly they return equipment.

Suggested scoring weights:

- 50% weight: SD card returns
- 25% weight: device returns
- 25% weight: hubs, cables, and accessories

If a team returns fewer items than expected, their score should go down.

This score should be clearly visible to:

- admin
- logistics
- ingestion

Purpose:

- help logistics decide whether to trust future requests
- make return discipline visible

## Admin Inventory

Admin needs a dedicated inventory management view to:

- see current stock
- edit total units
- edit available units
- edit allocated units
- edit in-transit units
- edit ingestion units
- edit missing units
- edit reorder point
- edit storage location
- add update note

## Authentication

Implement role-aware authentication with email/password.

### Public Self-Registration

Allowed for:

- factory operator
- ingestion

Flow:

1. user enters email and password
2. system sends OTP to email
3. user verifies OTP
4. registration completes
5. user can log in

### Private Account Creation

Used for:

- admin
- logistics

These accounts are created through private backend endpoints, not public UI.

## OTP Email

The OTP email must be branded as **Build AI**.

Requirements:

- clean HTML email
- black OTP text
- simple black-and-white brand styling
- plain text fallback

## UI Direction

Use a **strict standard black-and-white operational UI**.

The product must look like a serious internal tool, not a startup landing page, not a design showcase, and not a playful consumer app. The correct reference style is closer to:

- ServiceNow workspaces
- enterprise ticket consoles
- high-density legal or financial software
- structured operational panels

The UI should feel authoritative, clean, and fast.

## Design Philosophy: Operational Minimalism

The interface should feel like a high-end terminal or structured internal operations software.

Prioritize:

- information density
- clarity
- predictable spacing
- functional typography
- speed of comprehension
- low visual noise

Avoid:

- gradients
- oversized hero sections
- soft decorative cards
- playful illustrations
- unnecessary shadows
- excessive rounding
- decorative microinteractions

## Visual System

### Color Palette

Use strict monochrome with minimal semantic accents.

- background primary: `#FFFFFF`
- background secondary: `#F9F9F9`
- border: `#E5E5E5`
- heading text: `#111111`
- body text: `#666666`
- primary action: `#000000`
- primary action text: `#FFFFFF`
- critical or error: `#D11111`

Use color sparingly.

### Typography

Use:

- `Inter` or `Geist` for UI
- monospace for system data

Use monospace with tabular numerals for:

- ticket IDs
- QR tokens
- packet codes
- counts
- timestamps where alignment matters

This is required to prevent jitter and make scanning easier.

## Layout Model: ServiceNow-Style Commander View

The core logged-in experience should be a three-pane workspace.

### Left Pane

Navigation and filtered list.

This area should contain:

- global workspace switcher
- ticket list or queue
- search
- status filters

It should be compact and dense.

### Center Pane

The source of truth.

This is usually:

- ticket chat
- request form
- QR detail form
- ingestion reconciliation form

This pane should always hold the main task.

### Right Pane

Contextual metadata.

This should contain:

- vertical ticket tracker
- request details
- merit indicator
- QR packet panel
- action controls

The right pane should support fast context switching without overwhelming the main conversation area.

## Ticket Workspace Specification

Do not build this as a dashboard full of cards.

Instead, use a split-view workspace.

### Ticket List

The ticket list must be compact.

Target row height:

- `32px` to `40px` for dense state

Each row should display:

- priority indicator
- ticket ID
- team name
- status tag
- last activity time

Optional secondary line:

- factory name
- latest message preview

The newest or most recently active tickets should appear at the top.

### Ticket Chat

Chat should not use decorative chat bubbles.

Treat messages like structured operational logs:

- user messages:
  - sender name in bold
  - timestamp
  - message body
- system messages:
  - centered
  - muted
  - visually distinct
  - examples:
    - `Logistics changed status to Outbound Shipped`
    - `Ingestion marked processing started`

Reply-to-message should remain inline and lightweight.

### Tracking Rail

Use a vertical stepper for ticket progression.

States:

- completed steps: solid black dot
- current step: ring or emphasized marker
- future steps: hollow gray ring

This should read like Amazon order tracking, but in an enterprise style.

## QR Management Specification

### Batch Action Bar

Use a sticky top action area for QR generation.

This should contain:

- batch size
- shared shipped counts
- note
- generate action

The user fills this once, and the system creates multiple unique QR labels.

### QR Label Card

Use a minimalist printable card.

Each card should show:

- QR image
- unique token
- team name
- factory name
- packet identity

Printing should be clean and uncluttered.

### Public QR Page

The public QR page must be:

- mobile-first
- extremely clear
- form-focused
- minimal

If locked after EOD, show a plain message:

`Locked: Contact Admin`

No unnecessary decorative content should appear on that page.

## Merit Score Widget

Show merit as a simple numeric system.

Display:

- score from `0` to `100`
- short trend or risk indicator

Rules:

- high score `90+`: black text
- medium score `70-89`: dark gray
- low score `<70`: red text with `Risk` badge

This should be visible to admin, logistics, and ingestion.

## Core Component Style Rules

### Buttons

- square corners or nearly square corners
- black background
- white text
- no shadows
- no glossy effects

### Inputs

- `1px` solid border
- white background
- black text
- no glow
- focus state should be a clean solid black `2px` border

### Status Badges

- all caps
- monospace
- small font, around `10px`
- neutral background by default
- black for active or confirmed
- red only for critical failures

### Tables

- horizontal lines only
- no vertical separators
- uppercase headers
- compact row spacing
- monospace where numeric alignment matters

## Pages and Views

Minimum views:

1. login
2. registration with OTP
3. ticket inbox and ticket conversation workspace
4. QR batch and packet management workspace
5. ingestion queue and reconciliation workspace
6. movement ledger
7. merit score view
8. admin inventory view
9. public QR page

## Frontend Technical Direction

- frontend: Next.js + TypeScript
- backend: Python
- use a responsive workspace shell
- real-time chat should be websocket-capable
- use clear interfaces and proper typing
- UI should be production-ready, not prototype-level
- API errors must surface as readable messages
- QR URLs must always point to the production frontend domain

## Logic and State Handling

### QR Edit Lock Logic

Client-side:

- when a QR page is opened, check current time against end-of-day of the first save date
- if the current time is beyond that window, disable editing
- show:
  - `Locked: Contact Admin`

Server-side:

- backend must validate edit lock before accepting updates
- compare last editable date against first save date
- admin override must bypass this rule with audit behavior

### Ingestion Reconciliation Speed Entry

The ingestion experience should optimize for fast data entry.

Desired flow:

1. scan QR
2. auto-populate packet data
3. cursor focus moves to `Actual SD Cards`
4. operator enters counts quickly

Auto-calculation rule:

`Missing = Expected - (Processed + Faulty)`

This should update immediately in the form.

## Implementation Roadmap

### Phase 1: Foundation

- Python API with auth, OTP, and role handling
- PostgreSQL-backed ticket and movement models
- Next.js workspace shell with clean internal ops layout

### Phase 2: Logistics and QR

- ticket creation
- accept/reject workflow
- QR batch generation
- public QR page

### Phase 3: Ingestion and Merit

- ingestion queue
- reconciliation form
- movement ledger
- merit scoring engine

### Phase 4: Accountability and Live Operations

- admin inventory
- QR lock override
- websocket ticket chat
- final role and audit enforcement

## Non-Negotiable Product Behaviors

- ticket chat is first-class
- ticket page is a dedicated workspace, not a stacked dashboard
- tracking must be vertically visible
- QR batch form is filled once and produces many unique QR labels
- each QR becomes independently editable after scan
- public QR edit locks after EOD
- admin can override QR lock
- ingestion should not manually retype repeated packet identity
- transfer tickets must support device movement between factories
- merit score must be visible and meaningful
- the product must remain clean, compact, and operational

## Prompt for AI Code Generation

Use this prompt when generating specific pages or components:

`Generate a Next.js TypeScript page for the Build AI platform. The page is [Page Name]. Follow a strict black-and-white professional internal tool aesthetic. Use 1px borders, monospace for data, and Inter or Geist for UI. The layout must be a clean, high-density workspace or table. Avoid gradients, oversized cards, playful UI, and rounded glossy buttons. Ensure the component is production-ready with proper type interfaces, readable state handling, and responsive design for logistics teams on the move.`

## Final Build Objective

Deliver a production-ready Build AI platform where operations teams can manage requests, logistics, QR packets, returns, ingestion, movement history, and accountability through one clean black-and-white internal product with strong traceability and low visual noise.
