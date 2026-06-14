const express = require('express');
const { getAnalyticsSummary, getCampaignAnalytics, getCampaignInsights } = require('../controllers/analyticsController');

const router = express.Router();

router.get('/summary', getAnalyticsSummary);
router.get('/campaigns/:id', getCampaignAnalytics);
router.get('/campaigns/:id/insights', getCampaignInsights);

module.exports = router;
