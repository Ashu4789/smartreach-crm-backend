# Deployment Guide - SmartReach AI CRM

This guide documents the procedures for deploying the React frontend, Node/Express CRM backend, and MongoDB database using free tier cloud platforms.

---

## 1. Database Setup: MongoDB Atlas

1. **Sign Up**: Create an account on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. **Create Cluster**: Initialize a new shared cluster on the **Free M0 Tier**.
3. **Database Access User**:
   - Navigate to **Database Access** under Security.
   - Create a database user with username and password, selecting the permission role: **Read and Write to any Database**.
4. **Network Access**:
   - Navigate to **Network Access** under Security.
   - Add an IP entry for `0.0.0.0/0` (Allow Access from Anywhere) to permit connections from Render's cloud servers.
5. **Get Connection String**:
   - Click **Connect** on your cluster dashboard.
   - Select **Connect your application** (Driver: Node.js).
   - Copy the connection string. Replace `<username>` and `<password>` with your DB User credentials:
     `mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/smartreach?retryWrites=true&w=majority`

---

## 2. Backend Deployment: Render

We will deploy the CRM Backend and the Channel Service as two separate Web Services on [Render](https://render.com/).

### Web Service A: CRM Backend
1. **Repository Link**: Connect your backend repository (`smartreach-crm-backend`) to Render.
2. **Settings**:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. **Environment Variables**:
   Add the following variables in the **Env Groups** or **Environment** settings:
   - `PORT`: `10000` (Render binds this dynamically, but setting standard helps)
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: (Your MongoDB Atlas connection URI copied in Step 1)
   - `GEMINI_API_KEY`: (Your Google Gemini API Key from Google AI Studio)
   - `CHANNEL_SERVICE_URL`: (The URL of Web Service B, e.g. `https://smartreach-channel-service.onrender.com`)
   - `WEBHOOK_URL`: (This service's own URL, e.g. `https://smartreach-crm-backend.onrender.com/api/webhook/callback`)
4. **Deploy**: Trigger manual deploy. Record your backend URL.

### Web Service B: Channel Simulator
1. **Repository Link**: Connect the same repository, but set Root Directory to `channel-service` if split, or direct if hosted separately.
   *(Since channel-service is inside `crm-backend/channel-service` in local repository, set **Root Directory** setting to `channel-service` or adjust start paths.)*
2. **Settings**:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. **Environment Variables**:
   - `PORT`: `10000`
   - `NODE_ENV`: `production`
   - `CRM_WEBHOOK_URL`: (The URL of Web Service A, e.g. `https://smartreach-crm-backend.onrender.com/api/webhook/callback`)
4. **Deploy**: Record this service's URL and set it as `CHANNEL_SERVICE_URL` in Web Service A's config!

---

## 3. Frontend Deployment: Vercel

We will host the React frontend static build on [Vercel](https://vercel.com/).

1. **Repository Link**: Connect your frontend repository (`smartreach-crm-frontend`) to Vercel.
2. **Framework Preset**: Select **Vite**.
3. **Build Settings**:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Environment Variables**:
   Add the following variable:
   - `VITE_API_URL`: (The public URL of Web Service A, e.g. `https://smartreach-crm-backend.onrender.com/api`)
5. **Deploy**: Click Deploy. Vercel compiles the build and hosts it under a public `.vercel.app` subdomain.
