# SmartReach AI CRM - API Specification

This document details the REST API specifications for both the **CRM Backend** and the simulated **Channel Service**.

---

## 1. CRM Backend Service (`PORT 5000`)

### Base URL: `http://localhost:5000/api`

### Health Check
- **Endpoint**: `GET /health`
- **Response**: `200 OK`
  ```json
  {
    "status": "UP",
    "timestamp": "2026-06-14T02:43:05.000Z",
    "service": "CRM Backend"
  }
  ```

---

### Customers API

#### A. Ingest Data via CSV Upload
- **Endpoint**: `POST /customers/upload`
- **Query Parameters**:
  - `type` (required): `customers` (shopper profiles) or `orders` (sales logs)
- **Request Body**: Multipart form data with a `file` field containing a CSV.
  - *Customer CSV Headers*: `name`, `email`, `phone`, `city`, `preferredChannel`, `tags`
  - *Order CSV Headers*: `email` or `customerId`, `amount`, `category`, `date`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "Parsed 100 rows. Successful: 98, Failed: 2",
    "summary": {
      "totalParsed": 100,
      "successCount": 98,
      "failedCount": 2,
      "errors": [
        { "row": { "name": "" }, "reason": "Name and email are required" }
      ]
    }
  }
  ```
- **Error Cases**:
  - `400 Bad Request`: If file is missing or `type` parameter is invalid.

#### B. Paginated Search & Filtering
- **Endpoint**: `GET /customers`
- **Query Parameters**:
  - `page` (optional): page index (default `1`)
  - `limit` (optional): records per page (default `20`)
  - `search` (optional): regex match against name, email, or tags
  - `city` (optional): filter by city
  - `channel` (optional): WhatsApp, SMS, Email, or RCS
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "pagination": {
      "page": 1,
      "limit": 12,
      "totalPages": 5,
      "totalCustomers": 60
    },
    "data": [
      {
        "_id": "603d2e9e...",
        "name": "Arjun Singh",
        "email": "arjun.singh@example.com",
        "phone": "+919988776655",
        "city": "Mumbai",
        "totalSpend": 4500.50,
        "lastOrderDate": "2026-05-10T14:30:00Z",
        "preferredChannel": "WhatsApp",
        "tags": ["vip", "regular"]
      }
    ]
  }
  ```

#### C. Natural Language Segmentation (AI)
- **Endpoint**: `POST /customers/segment-ai`
- **Request Body**:
  ```json
  {
    "prompt": "Find customers who spent more than 5000 rupees but haven't purchased in 45 days"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "filter": {
      "totalSpend": { "$gt": 5000 },
      "lastOrderDate": { "$lt": "2026-04-30T00:00:00.000Z" }
    },
    "explanation": "Customers who spent more than Rs. 5,000 and did not make a purchase in the last 45 days",
    "count": 18,
    "preview": [
      {
        "_id": "603d2e9e...",
        "name": "Vihaan Patel",
        "email": "vihaan.patel@example.com",
        "city": "Delhi",
        "totalSpend": 7200,
        "lastOrderDate": "2026-04-12T00:00:00.000Z"
      }
    ]
  }
  ```

---

### Campaigns API

#### A. Create Campaign Draft
- **Endpoint**: `POST /campaigns`
- **Request Body**:
  ```json
  {
    "name": "Diwali Special Offer",
    "audienceFilter": { "totalSpend": { "$gt": 5000 } },
    "messageTemplate": "Hi [Name]! Grab Rs. 500 off today.",
    "channel": "WhatsApp"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "data": {
      "_id": "603d2f...",
      "name": "Diwali Special Offer",
      "audienceFilter": { "totalSpend": { "$gt": 5000 } },
      "messageTemplate": "Hi [Name]! Grab Rs. 500 off today.",
      "channel": "WhatsApp",
      "status": "DRAFT",
      "sentCount": 0,
      "deliveredCount": 0,
      "failedCount": 0,
      "openedCount": 0,
      "clickedCount": 0,
      "convertedCount": 0
    }
  }
  ```

#### B. Launch Campaign (Dispatches to Simulator)
- **Endpoint**: `POST /campaigns/:id/launch`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "Campaign successfully dispatched to 18 users.",
    "data": {
      "_id": "603d2f...",
      "status": "SENT",
      "sentCount": 18
    }
  }
  ```
- **Error Cases**:
  - `400 Bad Request`: If campaign is already launched/processing, or target cohort is empty.

#### C. Generate Campaign Copy & Recommendations (AI)
- **Endpoint**: `POST /campaigns/generate-copy`
- **Request Body**:
  ```json
  {
    "segmentExplanation": "Customers who spent more than Rs. 5,000",
    "goal": "Re-engage them with a free coffee code"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "recommendation": {
        "channel": "WhatsApp",
        "reason": "WhatsApp has high open rates and fits cohorts requiring direct engagement hooks."
      },
      "copy": {
        "WhatsApp": "Hi [Name]! ☕ Enjoy a free espresso on us in [City]. Code: COFFEE. Shop: sreach.ai/c",
        "SMS": "Hi [Name]! Free coffee on us: sreach.ai/c",
        "Email": {
          "subject": "A hot cup of coffee is waiting, [Name]! ☕",
          "body": "Dear [Name],\n\nWe noticed you haven't visited us since your last order on [LastOrderDate]..."
        },
        "RCS": "Hey [Name]! ☕ Special discount unlocked for you. Tap below to see your coupon code."
      }
    }
  }
  ```

---

### Webhook API

#### Update Delivery Log (Idempotent Callback)
- **Endpoint**: `POST /webhook/callback`
- **Request Body**:
  ```json
  {
    "communicationId": "603d3a...",
    "campaignId": "603d2f...",
    "customerId": "603d2e...",
    "status": "DELIVERED",
    "eventId": "evt_603d3a_delivered_1623635000",
    "errorReason": null
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "Status updated successfully"
  }
  ```
- **Note**: If a duplicate payload with the same `eventId` is received, the CRM backend returns `200 OK` with `"Duplicate event already processed"` and does not increment campaign stats or push duplicate logs.

---

### Analytics API

#### A. Aggregated Dashboard Summary
- **Endpoint**: `GET /analytics/summary`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "totalCustomers": 100,
      "metrics": {
        "totalCampaigns": 12,
        "sentCount": 1500,
        "deliveredCount": 1350,
        "failedCount": 150,
        "openedCount": 810,
        "clickedCount": 243,
        "convertedCount": 24,
        "deliveryRate": 90.0,
        "openRate": 54.0,
        "clickRate": 16.2,
        "conversionRate": 1.6
      },
      "recentCampaigns": [ ... ]
    }
  }
  ```

#### B. Specific Campaign Performance Funnel
- **Endpoint**: `GET /analytics/campaigns/:id`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "campaign": { ... },
      "rates": {
        "deliveryRate": 92.5,
        "openRate": 58.0,
        "clickRate": 17.5,
        "conversionRate": 2.5
      },
      "funnel": [
        { "name": "Sent", "value": 100 },
        { "name": "Delivered", "value": 92 },
        { "name": "Opened", "value": 58 },
        { "name": "Clicked", "value": 17 },
        { "name": "Converted", "value": 2 }
      ]
    }
  }
  ```

#### C. Campaign AI Performance Audit
- **Endpoint**: `GET /analytics/campaigns/:id/insights`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "performanceRating": "Healthy",
      "summary": "This campaign successfully reached 92% of users, resulting in standard engagement metrics...",
      "insights": [
        "Delivered successfully to 92 customers.",
        "Link click-through rates were higher than expected for WhatsApp."
      ],
      "recommendations": [
        "A/B test subject lines to improve open rates.",
        "Try injecting RCS media buttons next time."
      ]
    }
  }
  ```

---

## 2. Channel Service (`PORT 5001`)

### Base URL: `http://localhost:5001`

### Post Outbound Message Batch
- **Endpoint**: `POST /send`
- **Request Body**:
  ```json
  {
    "campaignId": "603d2f...",
    "webhookUrl": "http://crm-backend:5000/api/webhook/callback",
    "communications": [
      {
        "communicationId": "603d3a...",
        "customerId": "603d2e...",
        "email": "customer@example.com",
        "phone": "+919988776655",
        "preferredChannel": "WhatsApp",
        "message": "Hi Arjun! enjoy Rs. 500 off today..."
      }
    ]
  }
  ```
- **Response**: `202 Accepted`
  ```json
  {
    "success": true,
    "message": "Batch of 1 communications accepted and enqueued for simulation."
  }
  ```
- **Behavior**: The simulator registers the request, returns immediately, and runs background timers to mock state callbacks (SENT -> DELIVERED/FAILED -> OPENED -> CLICKED -> CONVERTED) back to the provided `webhookUrl`.
