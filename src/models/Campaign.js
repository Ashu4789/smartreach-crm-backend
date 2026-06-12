const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a campaign name'],
    trim: true
  },
  audienceFilter: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  audienceSize: {
    type: Number,
    default: 0
  },
  messageTemplate: {
    type: String,
    required: [true, 'Please add a campaign message template']
  },
  channel: {
    type: String,
    enum: ['WhatsApp', 'SMS', 'Email', 'RCS'],
    required: [true, 'Please specify a campaign channel']
  },
  status: {
    type: String,
    enum: ['DRAFT', 'SENT', 'PROCESSING', 'COMPLETED'],
    default: 'DRAFT'
  },
  sentCount: {
    type: Number,
    default: 0
  },
  deliveredCount: {
    type: Number,
    default: 0
  },
  failedCount: {
    type: Number,
    default: 0
  },
  openedCount: {
    type: Number,
    default: 0
  },
  clickedCount: {
    type: Number,
    default: 0
  },
  convertedCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Campaign', CampaignSchema);
