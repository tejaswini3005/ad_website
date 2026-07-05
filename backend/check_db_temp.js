const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const PricingConfig = require('./models/PricingConfig');

async function run() {
  try {
    const uri = process.env.MONGODB_URI;
    console.log('Connecting to:', uri);
    await mongoose.connect(uri);
    console.log('Connected.');
    const config = await PricingConfig.findOne().sort({ updatedAt: -1 });
    console.log('Config:', JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
