const Campaign = require('../models/Campaign');
const Customer = require('../models/Customer');

/**
 * @desc    Get aggregated campaign stats and recent campaigns for dashboard
 * @route   GET /api/analytics/summary
 * @access  Public
 */
const getAnalyticsSummary = async (req, res, next) => {
  try {
    // 1. Aggregate counters across all campaigns
    const stats = await Campaign.aggregate([
      {
        $group: {
          _id: null,
          totalCampaigns: { $sum: 1 },
          sentCount: { $sum: '$sentCount' },
          deliveredCount: { $sum: '$deliveredCount' },
          failedCount: { $sum: '$failedCount' },
          openedCount: { $sum: '$openedCount' },
          clickedCount: { $sum: '$clickedCount' },
          convertedCount: { $sum: '$convertedCount' }
        }
      }
    ]);

    const defaultStats = {
      totalCampaigns: 0,
      sentCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      openedCount: 0,
      clickedCount: 0,
      convertedCount: 0,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
      conversionRate: 0
    };

    let metrics = defaultStats;

    if (stats.length > 0) {
      const s = stats[0];
      const sent = s.sentCount || 0;
      metrics = {
        totalCampaigns: s.totalCampaigns,
        sentCount: sent,
        deliveredCount: s.deliveredCount || 0,
        failedCount: s.failedCount || 0,
        openedCount: s.openedCount || 0,
        clickedCount: s.clickedCount || 0,
        convertedCount: s.convertedCount || 0,
        deliveryRate: sent > 0 ? parseFloat(((s.deliveredCount / sent) * 100).toFixed(2)) : 0,
        openRate: sent > 0 ? parseFloat(((s.openedCount / sent) * 100).toFixed(2)) : 0,
        clickRate: sent > 0 ? parseFloat(((s.clickedCount / sent) * 100).toFixed(2)) : 0,
        conversionRate: sent > 0 ? parseFloat(((s.convertedCount / sent) * 100).toFixed(2)) : 0
      };
    }

    // 2. Fetch total customer count
    const totalCustomers = await Customer.countDocuments();

    // 3. Fetch recent campaigns (last 10) to display status and micro-charts
    const recentCampaigns = await Campaign.find()
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        totalCustomers,
        metrics,
        recentCampaigns
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get detailed conversion metrics for a specific campaign
 * @route   GET /api/analytics/campaigns/:id
 * @access  Public
 */
const getCampaignAnalytics = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const sent = campaign.sentCount || 0;
    
    const rates = {
      deliveryRate: sent > 0 ? parseFloat(((campaign.deliveredCount / sent) * 100).toFixed(2)) : 0,
      openRate: sent > 0 ? parseFloat(((campaign.openedCount / sent) * 100).toFixed(2)) : 0,
      clickRate: sent > 0 ? parseFloat(((campaign.clickedCount / sent) * 100).toFixed(2)) : 0,
      conversionRate: sent > 0 ? parseFloat(((campaign.convertedCount / sent) * 100).toFixed(2)) : 0
    };

    // Construct step funnel array for charts
    const funnel = [
      { name: 'Sent', value: campaign.sentCount },
      { name: 'Delivered', value: campaign.deliveredCount },
      { name: 'Opened', value: campaign.openedCount },
      { name: 'Clicked', value: campaign.clickedCount },
      { name: 'Converted', value: campaign.convertedCount }
    ];

    res.status(200).json({
      success: true,
      data: {
        campaign,
        rates,
        funnel
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate AI performance insights report for a specific campaign
 * @route   GET /api/analytics/campaigns/:id/insights
 * @access  Public
 */
const getCampaignInsights = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const sent = campaign.sentCount || 0;
    const metrics = {
      sentCount: sent,
      deliveredCount: campaign.deliveredCount || 0,
      failedCount: campaign.failedCount || 0,
      openedCount: campaign.openedCount || 0,
      clickedCount: campaign.clickedCount || 0,
      convertedCount: campaign.convertedCount || 0,
      deliveryRate: sent > 0 ? parseFloat(((campaign.deliveredCount / sent) * 100).toFixed(2)) : 0,
      openRate: sent > 0 ? parseFloat(((campaign.openedCount / sent) * 100).toFixed(2)) : 0,
      clickRate: sent > 0 ? parseFloat(((campaign.clickedCount / sent) * 100).toFixed(2)) : 0,
      conversionRate: sent > 0 ? parseFloat(((campaign.convertedCount / sent) * 100).toFixed(2)) : 0
    };

    const aiService = require('../services/aiService');
    const aiResult = await aiService.generatePerformanceSummary(campaign.name, metrics);

    res.status(200).json({
      success: true,
      data: aiResult
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnalyticsSummary,
  getCampaignAnalytics,
  getCampaignInsights
};
