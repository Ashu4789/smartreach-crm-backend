const { Readable } = require('stream');
const csv = require('csv-parser');
const Customer = require('../models/Customer');
const Order = require('../models/Order');

// Helper to parse CSV buffer into JSON array
const parseCSV = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    Readable.from(buffer)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
};

/**
 * @desc    Upload CSV of customers or orders
 * @route   POST /api/customers/upload
 * @access  Public
 */
const uploadCSV = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a CSV file' });
    }

    const uploadType = req.query.type; // 'customers' or 'orders'
    if (uploadType !== 'customers' && uploadType !== 'orders') {
      return res.status(400).json({ success: false, message: 'Invalid upload type. Must be "customers" or "orders".' });
    }

    const data = await parseCSV(req.file.buffer);
    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    if (uploadType === 'customers') {
      // Ingest Customer Data
      for (const row of data) {
        try {
          const { name, email, phone, city, preferredChannel, tags } = row;
          if (!name || !email) {
            failedCount++;
            errors.push({ row, reason: 'Name and email are required' });
            continue;
          }

          // Process tags
          let parsedTags = [];
          if (tags) {
            parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
          }

          // Upsert customer by email
          await Customer.findOneAndUpdate(
            { email: email.toLowerCase().trim() },
            {
              name: name.trim(),
              phone: phone ? phone.trim() : undefined,
              city: city ? city.trim() : undefined,
              preferredChannel: preferredChannel ? preferredChannel.trim() : 'Email',
              $addToSet: { tags: { $each: parsedTags } } // merges tags
            },
            { upsert: true, returnDocument: 'after', runValidators: true }
          );

          successCount++;
        } catch (err) {
          failedCount++;
          errors.push({ row, reason: err.message });
        }
      }
    } else {
      // Ingest Order Data & Sync Customer Profile
      for (const row of data) {
        try {
          const { email, customerId, amount, category, date } = row;
          
          let customer = null;
          if (email) {
            customer = await Customer.findOne({ email: email.toLowerCase().trim() });
          } else if (customerId) {
            customer = await Customer.findById(customerId);
          }

          if (!customer) {
            failedCount++;
            errors.push({ row, reason: 'No matching customer found' });
            continue;
          }

          const orderAmount = parseFloat(amount);
          if (isNaN(orderAmount)) {
            failedCount++;
            errors.push({ row, reason: 'Invalid order amount' });
            continue;
          }

          const orderDate = date ? new Date(date) : new Date();

          // Create the order
          await Order.create({
            customerId: customer._id,
            amount: orderAmount,
            category: category ? category.trim() : 'General',
            date: orderDate
          });

          // Recalculate customer totalSpend and lastOrderDate
          customer.totalSpend += orderAmount;
          if (!customer.lastOrderDate || orderDate > customer.lastOrderDate) {
            customer.lastOrderDate = orderDate;
          }
          await customer.save();

          successCount++;
        } catch (err) {
          failedCount++;
          errors.push({ row, reason: err.message });
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Parsed ${data.length} rows. Successful: ${successCount}, Failed: ${failedCount}`,
      summary: {
        totalParsed: data.length,
        successCount,
        failedCount,
        errors: errors.slice(0, 10) // return first 10 errors for feedback
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get paginated lists of customers
 * @route   GET /api/customers
 * @access  Public
 */
const getCustomers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const search = req.query.search || '';
    const city = req.query.city || '';
    const channel = req.query.channel || '';

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    if (city) {
      query.city = { $regex: city, $options: 'i' };
    }

    if (channel) {
      query.preferredChannel = channel;
    }

    const startIndex = (page - 1) * limit;
    const total = await Customer.countDocuments(query);

    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalCustomers: total
      },
      data: customers
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Filter customers with arbitrary query (internal/audience preview)
 * @route   POST /api/customers/filter
 * @access  Public
 */
const filterCustomers = async (req, res, next) => {
  try {
    const { filter } = req.body;
    
    // Safety check for empty or malicious filter structure
    const query = filter || {};

    const customers = await Customer.find(query).limit(100); // capped at 100 for safety / preview
    const count = await Customer.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      data: customers
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Convert natural language query into MongoDB filter and return preview cohort
 * @route   POST /api/customers/segment-ai
 * @access  Public
 */
const segmentCustomersAI = async (req, res, next) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, message: 'Prompt query is required' });
    }

    const aiService = require('../services/aiService');
    const aiResult = await aiService.translateNaturalLanguageQuery(prompt);
    
    // Fetch matching preview (capped at 50 for page preview)
    const previewCustomers = await Customer.find(aiResult.filter || {}).limit(50);
    const count = await Customer.countDocuments(aiResult.filter || {});

    res.status(200).json({
      success: true,
      filter: aiResult.filter || {},
      explanation: aiResult.explanation || 'Custom Segment',
      count,
      preview: previewCustomers
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadCSV,
  getCustomers,
  filterCustomers,
  segmentCustomersAI
};
