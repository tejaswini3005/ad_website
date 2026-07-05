const mongoose = require("mongoose");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  getOverviewAnalytics,
  listCampaignsForAnalytics,
  getCampaignAudienceAnalytics,
} = require("../services/audienceAnalyticsService");

/**
 * User-facing analytics controller.
 * Every function is scoped to req.user.userId (the field set by the JWT
 * payload in authController.js — NOT req.user.id/._id), so a normal
 * user only ever sees data for campaigns THEY own.
 */

const getOverview = asyncHandler(async (req, res) => {
  const data = await getOverviewAnalytics(req.user.userId);
  res.status(200).json({ success: true, data });
});

const getCampaignsList = asyncHandler(async (req, res) => {
  const data = await listCampaignsForAnalytics(req.user.userId);
  res.status(200).json({ success: true, data });
});

const getCampaignAnalytics = asyncHandler(async (req, res) => {
  const { campaignId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(campaignId)) {
    return res.status(400).json({ success: false, message: "Invalid campaign id" });
  }
  const data = await getCampaignAudienceAnalytics(campaignId, req.user.userId);
  res.status(200).json({ success: true, data });
});

module.exports = { getOverview, getCampaignsList, getCampaignAnalytics };