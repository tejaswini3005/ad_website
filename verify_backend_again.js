process.env.RAZORPAY_KEY_ID = 'dummy';
process.env.RAZORPAY_KEY_SECRET = 'dummy';

try {
  require('./backend/models/PricingConfig');
  require('./backend/models/Campaign.model');
  require('./backend/utils/campaignPricing');
  require('./backend/controllers/campaignController');
  require('./backend/routes/campaign.routes');
  require('./backend/routes/pricing');
  require('./backend/models/Payment');
  require('./backend/routes/payments');
  require('./backend/utils/invoiceGenerator');
  console.log('All backend files verified successfully!');
} catch (err) {
  console.error('Failed loading files:', err);
  process.exit(1);
}
