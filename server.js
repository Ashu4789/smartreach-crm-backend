require('dotenv').config();
const app = require('./src/app');
const connectDB = async () => {
  const dbConnection = require('./src/config/db');
  await dbConnection();
};

const PORT = process.env.PORT || 5000;

// Connect to Database and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` SmartReach CRM Backend Server Started   `);
    console.log(` Port: ${PORT}                           `);
    console.log(` Environment: ${process.env.NODE_ENV}   `);
    console.log(`=========================================`);
  });
}).catch(err => {
  console.error('Failed to initialize server:', err);
  process.exit(1);
});
