const express = require('express');
const { handleWebhookCallback } = require('../controllers/webhookController');
const { validateWebhook } = require('../middlewares/validators');

const router = express.Router();

router.post('/callback', validateWebhook, handleWebhookCallback);

module.exports = router;
