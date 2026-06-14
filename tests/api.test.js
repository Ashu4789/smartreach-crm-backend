const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Customer = require('../src/models/Customer');
const Campaign = require('../src/models/Campaign');
const Communication = require('../src/models/Communication');

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartreach_test';

beforeAll(async () => {
  // Connect to the test database
  await mongoose.connect(TEST_DB_URI);
});

afterAll(async () => {
  // Cleanup connections
  await mongoose.connection.close();
});

beforeEach(async () => {
  // Clear collections before each test run
  await Customer.deleteMany({});
  await Campaign.deleteMany({});
  await Communication.deleteMany({});
});

describe('SmartReach CRM API Integration Tests', () => {

  // 1. Customers Ingestion API Tests
  describe('POST /api/customers/upload', () => {
    it('should successfully ingest customer profiles via CSV upload', async () => {
      const csvContent = 'name,email,phone,city,preferredChannel,tags\nJohn Doe,john@example.com,+919988776655,Delhi,WhatsApp,vip';
      const fileBuffer = Buffer.from(csvContent, 'utf-8');

      const response = await request(app)
        .post('/api/customers/upload?type=customers')
        .attach('file', fileBuffer, 'customers.csv')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.summary.successCount).toBe(1);

      const dbCustomer = await Customer.findOne({ email: 'john@example.com' });
      expect(dbCustomer).toBeDefined();
      expect(dbCustomer.name).toBe('John Doe');
      expect(dbCustomer.city).toBe('Delhi');
      expect(dbCustomer.tags).toContain('vip');
    });

    it('should return 400 validation error if no file uploaded', async () => {
      await request(app)
        .post('/api/customers/upload?type=customers')
        .expect(400);
    });
  });

  // 2. Campaign Creation API Tests
  describe('POST /api/campaigns', () => {
    it('should successfully create campaign draft when inputs are valid', async () => {
      const campaignPayload = {
        name: 'Retention Special Offer',
        messageTemplate: 'Hi [Name], enjoy discount coupon!',
        channel: 'SMS',
        audienceFilter: { totalSpend: { $gt: 1000 } }
      };

      const response = await request(app)
        .post('/api/campaigns')
        .send(campaignPayload)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Retention Special Offer');
      expect(response.body.data.status).toBe('DRAFT');

      const dbCampaign = await Campaign.findById(response.body.data._id);
      expect(dbCampaign).toBeDefined();
    });

    it('should return 400 validation failures for invalid channel options', async () => {
      const invalidPayload = {
        name: 'Invalid Channel Offer',
        messageTemplate: 'Hi [Name]!',
        channel: 'CarrierPigeon' // Invalid
      };

      const response = await request(app)
        .post('/api/campaigns')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation');
    });
  });

  // 3. Webhook Callback Idempotency Tests
  describe('POST /api/webhook/callback', () => {
    it('should process status callback and prevent double counts under identical eventIds', async () => {
      // Setup mock campaign, customer, and communication log record
      const customer = await Customer.create({
        name: 'Alice Gupta',
        email: 'alice@example.com',
        preferredChannel: 'Email'
      });

      const campaign = await Campaign.create({
        name: 'Test Insights Promo',
        messageTemplate: 'Hi [Name]',
        channel: 'Email',
        sentCount: 1
      });

      const communication = await Communication.create({
        campaignId: campaign._id,
        customerId: customer._id,
        status: 'SENT',
        statusHistory: []
      });

      const webhookPayload = {
        communicationId: communication._id.toString(),
        campaignId: campaign._id.toString(),
        customerId: customer._id.toString(),
        status: 'DELIVERED',
        eventId: 'evt_test_unique_id_101'
      };

      // First call - should process and update
      const response1 = await request(app)
        .post('/api/webhook/callback')
        .send(webhookPayload)
        .expect(200);

      expect(response1.body.success).toBe(true);

      let updatedComm = await Communication.findById(communication._id);
      expect(updatedComm.status).toBe('DELIVERED');
      expect(updatedComm.statusHistory.length).toBe(1);
      expect(updatedComm.statusHistory[0].eventId).toBe('evt_test_unique_id_101');

      let updatedCamp = await Campaign.findById(campaign._id);
      expect(updatedCamp.deliveredCount).toBe(1);

      // Second duplicate call - should ignore (200 success but no double increment or history push)
      const response2 = await request(app)
        .post('/api/webhook/callback')
        .send(webhookPayload)
        .expect(200);

      expect(response2.body.message).toContain('Duplicate');

      updatedComm = await Communication.findById(communication._id);
      expect(updatedComm.statusHistory.length).toBe(1); // Still 1, did not append double

      updatedCamp = await Campaign.findById(campaign._id);
      expect(updatedCamp.deliveredCount).toBe(1); // Still 1, did not double-increment
    });
  });

});
