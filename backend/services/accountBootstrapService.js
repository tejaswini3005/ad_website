const Campaign = require("../models/Campaign.model");
const {
  createDemoCampaigns,
  createDemoNotifications,
  createDemoReports,
  createDemoRobots,
  ensureCampaignAnalyticsSeeded,
} = require("./mockAnalyticsService");

const bootstrapDemoWorkspace = async (user) => {
  try {
    let campaigns = await Campaign.find({ owner: user._id });
    if (!campaigns.length) {
      campaigns = await createDemoCampaigns(user);
    } else {
      for (const campaign of campaigns) {
        await ensureCampaignAnalyticsSeeded(campaign);
      }
    }
    await Promise.all([
      createDemoNotifications(user, campaigns),
      createDemoReports(user, campaigns),
      createDemoRobots(user, campaigns),
    ]);
  } catch (err) {
    console.error("Bootstrap error (non-fatal):", err.message);
  }
};

module.exports = { bootstrapDemoWorkspace };
