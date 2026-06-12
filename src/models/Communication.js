const mongoose = require('mongoose');

const StatusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['SENT', 'DELIVERED', 'FAILED', 'OPENED', 'CLICKED', 'CONVERTED'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  eventId: {
    type: String,
    required: true,
    index: true
  }
}, { _id: false });

const CommunicationSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: [true, 'Log must belong to a campaign'],
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Log must belong to a customer'],
    index: true
  },
  status: {
    type: String,
    enum: ['SENT', 'DELIVERED', 'FAILED', 'OPENED', 'CLICKED', 'CONVERTED'],
    default: 'SENT'
  },
  errorReason: {
    type: String,
    trim: true
  },
  statusHistory: [StatusHistorySchema]
}, {
  timestamps: true
});

// Compound index to speed up lookups for a specific campaign's customer log
CommunicationSchema.index({ campaignId: 1, customerId: 1 });

module.exports = mongoose.model('Communication', CommunicationSchema);
