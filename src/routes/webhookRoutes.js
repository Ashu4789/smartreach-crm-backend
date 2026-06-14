const express = require('express');
const { handleWebhookCallback, getRecentWebhookLogs } = require('../controllers/webhookController');
const { validateWebhook } = require('../middlewares/validators');

const router = express.Router();

router.post('/callback', validateWebhook, handleWebhookCallback);
router.get('/logs', getRecentWebhookLogs);

module.exports = router;
