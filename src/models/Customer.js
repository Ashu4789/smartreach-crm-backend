const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a customer name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please add a customer email'],
    unique: true,
    index: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    index: true,
    trim: true
  },
  totalSpend: {
    type: Number,
    default: 0
  },
  lastOrderDate: {
    type: Date
  },
  preferredChannel: {
    type: String,
    enum: ['WhatsApp', 'SMS', 'Email', 'RCS'],
    default: 'Email'
  },
  tags: {
    type: [String],
    index: true,
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Customer', CustomerSchema);
