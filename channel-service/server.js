require('dotenv').config();
const express = require('express');
const cors = require('cors');
const EventSimulator = require('./src/services/EventSimulator');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date(),
    service: 'Channel Simulator'
  });
});

// Outbound Message sending endpoint
app.post('/send', (req, res) => {
  const { campaignId, webhookUrl, communications } = req.body;

  if (!campaignId || !webhookUrl || !Array.isArray(communications)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payload structure. Must contain "campaignId", "webhookUrl", and "communications" array.'
    });
  }

  // Handle async delivery simulation in background thread loop
  EventSimulator.processOutboundBatch(campaignId, webhookUrl, communications);

  // Return 202 Accepted immediately to allow the calling CRM backend to return quickly
  res.status(202).json({
    success: true,
    message: `Batch of ${communications.length} communications accepted and enqueued for simulation.`
  });
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` SmartReach Channel Simulator Started    `);
  console.log(` Port: ${PORT}                           `);
  console.log(`=========================================`);
});
