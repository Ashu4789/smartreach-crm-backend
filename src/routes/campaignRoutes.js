const express = require('express');
const { createCampaign, getCampaigns, launchCampaign, generateCopyAI } = require('../controllers/campaignController');
const { validateCampaign } = require('../middlewares/validators');

const router = express.Router();

router.post('/', validateCampaign, createCampaign);
router.get('/', getCampaigns);
router.post('/generate-copy', generateCopyAI);
router.post('/:id/launch', launchCampaign);

module.exports = router;
