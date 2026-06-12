const express = require('express');
const multer = require('multer');
const { uploadCSV, getCustomers, filterCustomers, segmentCustomersAI } = require('../controllers/customerController');
const { validateCustomerFilter } = require('../middlewares/validators');

const router = express.Router();

// Configure multer to hold files in memory for streaming parser
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.post('/upload', upload.single('file'), uploadCSV);
router.get('/', getCustomers);
router.post('/filter', validateCustomerFilter, filterCustomers);
router.post('/segment-ai', segmentCustomersAI);

module.exports = router;
