const mongoose = require("mongoose");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  getOverviewAnalytics,
  listCampaignsForAnalytics,
  getCampaignAudienceAnalytics,
  getRevenueAnalytics,
} = require("../services/audienceAnalyticsService");

/**
 * Admin analytics controller — unscoped (no ownerId passed), so it
 * always covers every campaign/company on the network.
 */

const getOverview = asyncHandler(async (_req, res) => {
  const data = await getOverviewAnalytics();
  res.status(200).json({ success: true, data });
});

const getCampaignsList = asyncHandler(async (_req, res) => {
  const data = await listCampaignsForAnalytics();
  res.status(200).json({ success: true, data });
});

const getCampaignAnalytics = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(campaignId)) {
    return res.status(400).json({ success: false, message: "Invalid campaign id" });
  }
  const data = await getCampaignAudienceAnalytics(campaignId);
  res.status(200).json({ success: true, data });
});

// GET /api/admin/analytics/revenue — admin-only revenue summary + per-brand breakdown
const getRevenue = asyncHandler(async (_req, res) => {
  const data = await getRevenueAnalytics();
  res.status(200).json({ success: true, data });
});

module.exports = { getOverview, getCampaignsList, getCampaignAnalytics, getRevenue };