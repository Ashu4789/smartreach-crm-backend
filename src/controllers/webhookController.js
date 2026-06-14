const Communication = require('../models/Communication');
const Campaign = require('../models/Campaign');

/**
 * @desc    Receive delivery reports and event updates from Channel Service
 * @route   POST /api/webhook/callback
 * @access  Public
 */
const handleWebhookCallback = async (req, res, next) => {
  try {
    const { communicationId, campaignId, customerId, status, eventId, errorReason } = req.body;

    console.log(`[Webhook Callback Received]: eventId=${eventId}, commId=${communicationId}, status=${status}`);

    // 1. Fetch communication log
    const communication = await Communication.findById(communicationId);
    if (!communication) {
      return res.status(404).json({ success: false, message: 'Communication log record not found' });
    }

    // 2. Idempotency Check: check if eventId is already logged in statusHistory
    const isDuplicate = communication.statusHistory.some(hist => hist.eventId === eventId);
    if (isDuplicate) {
      console.log(`[Webhook Idempotency]: Duplicate event ${eventId} ignored.`);
      return res.status(200).json({
        success: true,
        message: 'Duplicate event already processed'
      });
    }

    // 3. Update status and push to status history
    communication.status = status;
    if (errorReason) {
      communication.errorReason = errorReason;
    }
    communication.statusHistory.push({
      status,
      timestamp: new Date(),
      eventId
    });
    
    await communication.save();

    // 4. Thread-Safe Stats Incrementation via Mongo $inc
    const incObj = {};
    switch (status) {
      case 'DELIVERED':
        incObj.deliveredCount = 1;
        break;
      case 'FAILED':
        incObj.failedCount = 1;
        break;
      case 'OPENED':
        incObj.openedCount = 1;
        break;
      case 'CLICKED':
        incObj.clickedCount = 1;
        break;
      case 'CONVERTED':
        incObj.convertedCount = 1;
        break;
      default:
        break;
    }

    if (Object.keys(incObj).length > 0) {
      await Campaign.findByIdAndUpdate(campaignId, { $inc: incObj });
      console.log(`[Webhook Updated Campaign Stats]: campaignId=${campaignId}, incremented=${Object.keys(incObj)[0]}`);
    }

    res.status(200).json({
      success: true,
      message: 'Status updated successfully'
    });

  } catch (error) {
    next(error);
  }
};

const getRecentWebhookLogs = async (req, res, next) => {
  try {
    const logs = await Communication.find()
      .sort({ updatedAt: -1 })
      .limit(30)
      .populate('customerId', 'name email phone preferredChannel')
      .populate('campaignId', 'name channel');

    res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handleWebhookCallback,
  getRecentWebhookLogs
};

