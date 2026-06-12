const { body, validationResult } = require('express-validator');

// Generic runner to validate and return standardized errors
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Format errors list
    const formattedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation Failure',
      errors: formattedErrors
    });
  };
};

// Campaign validation rules
const validateCampaign = validate([
  body('name')
    .trim()
    .notEmpty().withMessage('Campaign name is required')
    .isLength({ max: 100 }).withMessage('Campaign name must not exceed 100 characters'),
  
  body('messageTemplate')
    .trim()
    .notEmpty().withMessage('Message template is required'),
  
  body('channel')
    .trim()
    .notEmpty().withMessage('Channel is required')
    .isIn(['WhatsApp', 'SMS', 'Email', 'RCS']).withMessage('Channel must be WhatsApp, SMS, Email, or RCS'),

  body('audienceFilter')
    .optional()
    .isObject().withMessage('Audience filter must be a valid JSON object')
]);

// Webhook validation rules
const validateWebhook = validate([
  body('communicationId')
    .trim()
    .notEmpty().withMessage('communicationId is required')
    .isMongoId().withMessage('communicationId must be a valid Mongo ID'),
  
  body('campaignId')
    .trim()
    .notEmpty().withMessage('campaignId is required')
    .isMongoId().withMessage('campaignId must be a valid Mongo ID'),
  
  body('customerId')
    .trim()
    .notEmpty().withMessage('customerId is required')
    .isMongoId().withMessage('customerId must be a valid Mongo ID'),
  
  body('status')
    .trim()
    .notEmpty().withMessage('status is required')
    .isIn(['SENT', 'DELIVERED', 'FAILED', 'OPENED', 'CLICKED', 'CONVERTED']).withMessage('Invalid status value'),
  
  body('eventId')
    .trim()
    .notEmpty().withMessage('eventId is required')
]);

// Customer filter validation rules
const validateCustomerFilter = validate([
  body('filter')
    .notEmpty().withMessage('Filter criteria is required')
    .isObject().withMessage('Filter must be a valid query object')
]);

module.exports = {
  validateCampaign,
  validateWebhook,
  validateCustomerFilter
};
