# SmartReach AI CRM - Backend API & Channel Gateway

SmartReach AI CRM is a production-style, AI-native Mini Customer Relationship Management (CRM) system designed for Direct-to-Consumer (D2C) brands. This repository contains the Express CRM API backend, the MongoDB database schema layers, and the standalone simulated Channel Gateway service.

---

## Problem Statement

Growth marketers at D2C brands have access to massive volumes of customer demographic data and order history. However, they face several critical friction points:
1. **Inefficient Segmentation**: Standard databases require writing complex SQL or Mongoose selectors to construct specific audience cohorts.
2. **Channel Friction**: Marketers must craft different copywriting styles and structure payloads for various platforms (WhatsApp, SMS, Email, RCS) manually.
3. **Delivery Feedback Loop**: Outbound messaging gateways (like Twilio, Gupshup, or Twilio Segment) send asynchronous delivery notifications via webhook callbacks. Building a system that tracks conversions, ensures thread-safety under peak webhook loads, and handles retries without double-counting metrics (idempotency) is a complex engineering challenge.

---

## Product Overview

SmartReach AI CRM solves these problems by providing:
1. **CSV Ingestors**: Ingests customer profiles and order histories, relationally joining records and keeping running stats of total spend and order date tags.
2. **Natural Language Cohort Segmenter**: Employs Google Gemini AI to translate natural language marketer requests into execution-ready Mongoose query objects.
3. **AI Copywriter & Channel Suggester**: Drafts channel-optimized message variants (WhatsApp, SMS, Email, RCS) and suggests the optimal channel with a growth rationale.
4. **Decoupled simulated Gateway**: Simulates TWILIO/Gupshup style message delivery and captures callbacks (Sent ➔ Delivered ➔ Opened ➔ Clicked ➔ Converted) with webhook idempotency.
5. **Funnel Analytics**: Aggregates conversion metrics and compiles AI-driven campaign reviews.

---

## Demo

- **Hosted Backend API**: `https://smartreach-crm-backend.onrender.com` (Example URL)
- **Hosted Channel Gateway**: `https://smartreach-channel-service.onrender.com` (Example URL)
- **Walkthrough Video**: [Insert walkthrough video URL here]

---

## Architecture

The system uses a decoupled, asynchronous microservices architecture to process campaigns and handle webhook delivery callbacks:

![Architecture](docs/architecture/system-design.png)

### Architecture Highlights:
- **Fast Responses via 202 Accepted**: When a campaign launches, the CRM backend dispatches outbound payloads to the Channel Simulator. The Simulator immediately returns an HTTP 202 Accepted, preventing connection timeouts.
- **Asynchronous Execution Loop**: The Channel Simulator runs parallel background micro-tasks that transition message states over random intervals (simulating real network delays).
- **Idempotency checks**: The Simulator sends webhooks containing a unique `eventId`. The CRM webhook router checks the `statusHistory` list in the communication log before updating.
- **Conncurent Statistics Safety**: Campaign aggregates are updated concurrently using MongoDB's atomic `$inc` operators to avoid race conditions.

---

## Features

- **Memory-efficient CSV Streaming**: Uses streaming buffers (`Multer` + `csv-parser`) to ingest datasets without writing files to local disk.
- **Relational Ingest Synchronizers**: When importing order records, the backend automatically joins them to customer records, updates customer `totalSpend`, and updates their `lastOrderDate` tag.
- **Webhook Deduplication**: Implements strict idempotency checks by verifying that incoming callback events have not already been logged.
- **Comprehensive API Tests**: Full integration tests covering CSV uploading, campaign draft validations, and webhook deduplication logic.

---

## AI Capabilities

- **Segment Translation**: Gemini translates marketer intent (e.g. *"shoppers who spent over 5k but haven't ordered in 45 days"*) into Mongoose query structures and formats dates based on the current server timestamp.
- **Multi-Channel Copy Generation**: Dynamically writes copy options containing token variables like `[Name]`, `[City]`, `[TotalSpend]`, and `[LastOrderDate]`.
- **Channel Advisor**: Suggests the optimal channel (e.g., recommending WhatsApp for inactive users due to 98% open rates) with a logical rationale.
- **Funnel Reviewer**: Analyzes campaign conversions and writes audit summaries, funnel insights, and growth recommendations.

---

## Tech Stack

- **Core**: Node.js & Express.js
- **Database**: MongoDB & Mongoose ODM
- **AI Engine**: Google Gemini API SDK (`@google/generative-ai` v0.21)
- **Testing**: Jest & Supertest
- **DevOps**: Docker, Docker Compose

---

## Local Setup

### Prerequisites
- Node.js (v18+)
- MongoDB running locally (`mongodb://127.0.0.1:27017/smartreach`) or a MongoDB Atlas URI.
- A Google Gemini API Key from Google AI Studio.

### Installation & Execution

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Seed Database**:
   Populate your local database with 100 customer profiles, 500 order logs, and 10 simulated campaigns:
   ```bash
   npm run seed
   ```

3. **Run Tests**:
   Run the integration tests using Jest:
   ```bash
   npm test
   ```

4. **Start CRM Backend**:
   ```bash
   npm run dev
   ```
   *The CRM Backend will run at `http://localhost:5000`.*

5. **Start Channel Simulator**:
   Navigate to the channel service directory, install dependencies, and run:
   ```bash
   cd channel-service
   npm install
   npm run dev
   ```
   *The Channel Simulator will run at `http://localhost:5001`.*

---

## Environment Variables

Configure these variables in your `crm-backend/.env` file:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/smartreach
GEMINI_API_KEY=your_gemini_api_key_here
CHANNEL_SERVICE_URL=http://127.0.0.1:5001
WEBHOOK_URL=http://127.0.0.1:5000/api/webhook/callback
NODE_ENV=development
```

Configure these variables in your `crm-backend/channel-service/.env` file:

```env
PORT=5001
CRM_WEBHOOK_URL=http://127.0.0.1:5000/api/webhook/callback
NODE_ENV=development
```

---

## Docker Setup

You can run the entire system (Frontend, CRM Backend, Channel Simulator, and MongoDB) using Docker Compose. Make sure your `GEMINI_API_KEY` is exported in your environment:

1. **Boot Containers**:
   ```bash
   docker-compose up --build
   ```
2. **Access Ports**:
   - React Frontend: `http://localhost:5173`
   - CRM Backend API: `http://localhost:5000`
   - Channel Service Simulator: `http://localhost:5001`
   - MongoDB: `localhost:27017`

---

## API Documentation

### 1. Customers API
- `POST /api/customers/upload?type=customers`
  - Uploads a CSV file of customer profiles.
- `POST /api/customers/upload?type=orders`
  - Uploads a CSV file of order history records.
- `GET /api/customers`
  - Retrieves paginated customer profiles with search and channel filter parameters.
- `POST /api/customers/segment-ai`
  - Body: `{ "prompt": "..." }`
  - Translates a natural language query into a Mongoose selector filter and returns the preview cohort.

### 2. Campaigns API
- `POST /api/campaigns`
  - Body: `{ "name", "audienceFilter", "messageTemplate", "channel" }`
  - Creates a campaign draft record.
- `POST /api/campaigns/:id/launch`
  - Dispatches targeted communications to the Channel Simulator.
- `POST /api/campaigns/generate-copy`
  - Body: `{ "segmentExplanation", "goal" }`
  - Generates copy templates and recommended channel options using Gemini.

### 3. Webhook API
- `POST /api/webhook/callback`
  - Body: `{ "communicationId", "campaignId", "customerId", "status", "eventId", "errorReason" }`
  - Captures status transitions, logs them to communication history (ensuring idempotency), and increments metrics.

### 4. Analytics API
- `GET /api/analytics/summary`
  - Returns total customer count, campaign count, aggregate conversion funnel stats, and recent campaign lists.
- `GET /api/analytics/campaigns/:id`
  - Returns detailed funnel data for a specific campaign.
- `GET /api/analytics/campaigns/:id/insights`
  - Analyzes campaign funnel conversion drop-offs using Gemini.

---

## Design Decisions

1. **Streaming CSV Buffers**: CSV inputs are parsed directly from memory without writing files to local disk. This allows the backend to run on serverless cloud container platforms like Render.
2. **Compound Index Optimization**: Indexing `{ campaignId: 1, customerId: 1 }` on the `Communication` collection speeds up database lookups during webhook processing.
3. **Deduplication via Subdocuments**: Rather than maintaining a separate MongoDB collection for idempotency tokens, events are logged in the `statusHistory` array of the respective `Communication` document, ensuring local transaction consistency.
4. **Thread-Safe Concurrency**: Atomic MongoDB `$inc` operators prevent race conditions when multiple concurrent webhook callbacks hit the server.

---

## Tradeoffs

1. **LocalStorage Cohort Tracking**: Audience segments are saved in `localStorage` rather than database tables. This makes the frontend architecture agile and fast but limits multi-marketer alignment in a production setting.
2. **In-Memory Webhook Queuing**: The Channel Simulator queues simulation loops in Node's event loop. For a high-scale production setup, this would be refactored to use a message broker like RabbitMQ, SQS, or BullMQ with Redis.
3. **Mock Client-Side Date Assertions**: Dates are calculated based on the current system server date, which can vary slightly depending on server locations.

---

## Future Improvements

1. **BullMQ / Redis Integration**: Introduce job queues for handling large-scale campaign dispatches and retrying failed webhook deliveries.
2. **Real-Time Client Updates**: Integrate WebSockets (Socket.io) to push webhook delivery updates directly to the frontend dashboard.
3. **Advanced A/B Testing**: Support launching multiple copy variations in a single campaign and letting AI dynamically shift channel budgets toward higher-performing versions.