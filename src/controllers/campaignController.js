const axios = require('axios');
const Campaign = require('../models/Campaign');
const Customer = require('../models/Customer');
const Communication = require('../models/Communication');

// Personalize message templates by replacing token placeholders
const personalizeMessage = (template, customer) => {
  if (!template) return '';
  return template
    .replace(/\[Name\]/gi, customer.name || 'shopper')
    .replace(/\[City\]/gi, customer.city || 'your city')
    .replace(/\[TotalSpend\]/gi, customer.totalSpend ? customer.totalSpend.toLocaleString('en-IN') : '0')
    .replace(/\[LastOrderDate\]/gi, customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString() : 'recent days');
};

/**
 * @desc    Create a new campaign draft
 * @route   POST /api/campaigns
 * @access  Public
 */
const createCampaign = async (req, res, next) => {
  try {
    const { name, audienceFilter, messageTemplate, channel } = req.body;

    // Optional: run a quick preview counts on the audience filter to record size
    const audienceSize = await Customer.countDocuments(audienceFilter || {});

    const campaign = await Campaign.create({
      name,
      audienceFilter: audienceFilter || {},
      audienceSize,
      messageTemplate,
      channel,
      status: 'DRAFT'
    });

    res.status(201).json({
      success: true,
      data: campaign
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all campaigns
 * @route   GET /api/campaigns
 * @access  Public
 */
const getCampaigns = async (req, res, next) => {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: campaigns.length,
      data: campaigns
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Launch campaign (processes segment, logs events, dispatches to Channel service)
 * @route   POST /api/campaigns/:id/launch
 * @access  Public
 */
const launchCampaign = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    if (campaign.status === 'SENT' || campaign.status === 'PROCESSING') {
      return res.status(400).json({
        success: false,
        message: `Campaign cannot be launched. Current status: ${campaign.status}`
      });
    }

    // Set status to processing to avoid double launch requests
    campaign.status = 'PROCESSING';
    await campaign.save();

    // Query segment customers based on filter
    const targetFilter = campaign.audienceFilter || {};
    const customers = await Customer.find(targetFilter);

    if (customers.length === 0) {
      campaign.status = 'DRAFT';
      campaign.audienceSize = 0;
      await campaign.save();
      return res.status(400).json({
        success: false,
        message: 'Audience segment contains 0 customers. Cannot launch campaign.'
      });
    }

    // Update campaign audience size
    campaign.audienceSize = customers.length;
    await campaign.save();

    console.log(`[Launch Event]: Campaign "${campaign.name}" target segment count: ${customers.length}`);

    // Create Communications logs in bulk
    const communicationsToCreate = customers.map(customer => ({
      campaignId: campaign._id,
      customerId: customer._id,
      status: 'SENT',
      statusHistory: [] // Will record webhook events later
    }));

    // Bulk insertion to minimize db roundtrips
    const savedLogs = await Communication.insertMany(communicationsToCreate);

    // Format delivery items for the Channel Service payload
    const outboundMessages = savedLogs.map((log, index) => {
      const customer = customers[index];
      return {
        communicationId: log._id,
        customerId: customer._id,
        email: customer.email,
        phone: customer.phone,
        preferredChannel: campaign.channel,
        message: personalizeMessage(campaign.messageTemplate, customer)
      };
    });

    const channelServiceUrl = process.env.CHANNEL_SERVICE_URL;
    const webhookUrl = process.env.WEBHOOK_URL;

    if (!channelServiceUrl || !webhookUrl) {
      throw new Error('CHANNEL_SERVICE_URL or WEBHOOK_URL is not set in backend configuration.');
    }

    // Dispatch payload to Channel Service asynchronously
    try {
      await axios.post(`${channelServiceUrl}/send`, {
        campaignId: campaign._id,
        webhookUrl,
        communications: outboundMessages
      });

      // Update campaign status
      campaign.status = 'SENT';
      campaign.sentCount = customers.length;
      await campaign.save();

      res.status(200).json({
        success: true,
        message: `Campaign successfully dispatched to ${customers.length} users.`,
        data: campaign
      });
    } catch (apiError) {
      console.error('[API Error Dispatching to Channel Service]:', apiError.message);
      
      // Rollback campaign status and cleanup logs if direct dispatch failure
      campaign.status = 'DRAFT';
      await campaign.save();
      await Communication.deleteMany({ campaignId: campaign._id });

      return res.status(502).json({
        success: false,
        message: `Failed to dispatch communications to simulator channel: ${apiError.message}`
      });
    }

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate personalized campaign copy variants and channel recommendations via AI
 * @route   POST /api/campaigns/generate-copy
 * @access  Public
 */
const generateCopyAI = async (req, res, next) => {
  try {
    const { segmentExplanation, goal } = req.body;
    if (!segmentExplanation || !goal) {
      return res.status(400).json({ success: false, message: 'Both segmentExplanation and goal are required.' });
    }

    const aiService = require('../services/aiService');
    const aiResult = await aiService.generateCampaignCopy(segmentExplanation, goal);

    res.status(200).json({
      success: true,
      data: aiResult
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCampaign,
  getCampaigns,
  launchCampaign,
  generateCopyAI
};
