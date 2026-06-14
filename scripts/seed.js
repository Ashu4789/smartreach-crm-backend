require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../src/models/Customer');
const Order = require('../src/models/Order');
const Campaign = require('../src/models/Campaign');
const Communication = require('../src/models/Communication');

// Connection options
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartreach';

const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Kolkata', 'Hyderabad', 'Chennai', 'Ahmedabad'];
const channels = ['WhatsApp', 'SMS', 'Email', 'RCS'];
const tagsList = ['vip', 'regular', 'new', 'inactive', 'churn-risk', 'high-spender', 'coupon-hunter'];
const categories = ['Electronics', 'Fashion', 'Grocery', 'Beauty', 'Home & Living'];

const firstNames = ['Aarav', 'Vihaan', 'Aditya', 'Sai', 'Arjun', 'Kabir', 'Rohan', 'Ananya', 'Diya', 'Isha', 'Meera', 'Riya', 'Siddharth', 'Dev', 'Karan', 'Pooja', 'Neha', 'Rahul'];
const lastNames = ['Sharma', 'Patel', 'Verma', 'Gupta', 'Mehta', 'Rao', 'Nair', 'Singh', 'Kumar', 'Reddy', 'Joshi', 'Das', 'Sen', 'Choudhury', 'Iyer', 'Pillai'];

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2));

const seed = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Database connected.');

    // Clear existing data
    console.log('Flushing existing database tables...');
    await Customer.deleteMany({});
    await Order.deleteMany({});
    await Campaign.deleteMany({});
    await Communication.deleteMany({});
    console.log('Database flushed clean.');

    // 1. Generate 100 Customers
    console.log('Generating 100 shopper profiles...');
    const customersToInsert = [];
    const emailsSet = new Set();

    while (customersToInsert.length < 100) {
      const fName = randomChoice(firstNames);
      const lName = randomChoice(lastNames);
      const name = `${fName} ${lName}`;
      const email = `${fName.toLowerCase()}.${lName.toLowerCase()}${randomRange(10, 99)}@example.com`;

      if (emailsSet.has(email)) continue;
      emailsSet.add(email);

      const phone = `+91${randomRange(7000000000, 9999999999)}`;
      const city = randomChoice(cities);
      const preferredChannel = randomChoice(channels);
      
      // Select 1-3 random tags
      const numTags = randomRange(1, 3);
      const tags = [];
      while (tags.length < numTags) {
        const tag = randomChoice(tagsList);
        if (!tags.includes(tag)) tags.push(tag);
      }

      customersToInsert.push({
        name,
        email,
        phone,
        city,
        preferredChannel,
        tags,
        totalSpend: 0,
        lastOrderDate: null
      });
    }

    const createdCustomers = await Customer.insertMany(customersToInsert);
    console.log(`Successfully seeded ${createdCustomers.length} customers.`);

    // 2. Generate 500 Orders
    console.log('Generating 500 order logs...');
    const ordersToInsert = [];
    
    // Track stats in-memory to update customers in bulk/save
    const customerStats = {};
    createdCustomers.forEach(c => {
      customerStats[c._id] = { totalSpend: 0, lastOrderDate: null };
    });

    for (let i = 0; i < 500; i++) {
      const customer = randomChoice(createdCustomers);
      const amount = randomFloat(150, 9500);
      const category = randomChoice(categories);
      
      // Date in the last 120 days
      const date = new Date();
      date.setDate(date.getDate() - randomRange(0, 120));

      ordersToInsert.push({
        customerId: customer._id,
        amount,
        category,
        date
      });

      // Accumulate aggregates
      customerStats[customer._id].totalSpend += amount;
      if (!customerStats[customer._id].lastOrderDate || date > customerStats[customer._id].lastOrderDate) {
        customerStats[customer._id].lastOrderDate = date;
      }
    }

    await Order.insertMany(ordersToInsert);
    console.log(`Successfully seeded 500 order records.`);

    // 3. Sync customer profile spending metrics
    console.log('Updating customer aggregations...');
    for (const customerId of Object.keys(customerStats)) {
      const stats = customerStats[customerId];
      await Customer.findByIdAndUpdate(customerId, {
        totalSpend: parseFloat(stats.totalSpend.toFixed(2)),
        lastOrderDate: stats.lastOrderDate
      });
    }
    console.log('Customer aggregates synced.');

    // 4. Generate 10 Campaigns with realistic funnel rates
    console.log('Generating 10 campaign reports...');
    const campaignNames = [
      'VIP Diwali Mega Sale',
      'Inactive Shopper Winback',
      'New Electronics Arrival Launch',
      'Mumbai & Delhi Local Fest',
      'SMS Flash Discount Coupon',
      'WhatsApp Weekly Highlights',
      'RCS Premium Product Drop',
      'Churn Risk Reactivation Campaign',
      'Beauty Category Cross-sell',
      'Mid-Season Clearance Fest'
    ];

    const campaignsToInsert = [];

    for (let i = 0; i < campaignNames.length; i++) {
      const name = campaignNames[i];
      const channel = randomChoice(channels);
      
      // Determine size
      const audienceSize = randomRange(25, 95);
      
      // Funnel computations
      const sentCount = audienceSize;
      const deliveredCount = Math.floor(sentCount * randomFloat(0.85, 0.96));
      const failedCount = sentCount - deliveredCount;
      const openedCount = Math.floor(deliveredCount * randomFloat(0.40, 0.70));
      const clickedCount = Math.floor(openedCount * randomFloat(0.20, 0.45));
      const convertedCount = Math.floor(clickedCount * randomFloat(0.08, 0.25));

      // Mock query filter
      const filter = {
        totalSpend: { $gt: randomChoice([1000, 3000, 5000]) }
      };

      campaignsToInsert.push({
        name,
        audienceFilter: filter,
        audienceSize,
        messageTemplate: `Hi [Name]! Check out our new deals. Get up to Rs. 1000 off at cart. Shop now: sreach.ai/shop`,
        channel,
        status: 'COMPLETED',
        sentCount,
        deliveredCount,
        failedCount,
        openedCount,
        clickedCount,
        convertedCount
      });
    }

    await Campaign.insertMany(campaignsToInsert);
    console.log('Successfully seeded 10 sample campaigns.');

    console.log('=========================================');
    console.log(' Seeding completed successfully!          ');
    console.log(' Run `npm run dev` to start application.  ');
    console.log('=========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('Seeding process failed:', error);
    process.exit(1);
  }
};

seed();
