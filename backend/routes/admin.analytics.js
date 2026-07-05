const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const { adminMiddleware } = require("../middleware/admin");
const {
  getOverview,
  getCampaignsList,
  getCampaignAnalytics,
  getRevenue,
} = require("../controllers/adminAnalyticsController");

router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * Admin Analytics routes
 * -----------------------
 * Unscoped — covers every campaign/company on the network.
 * Backed by the `AudienceEvent` collection (see models/AudienceEvent.js).
 */

// GET /api/admin/analytics/overview
router.get("/overview", getOverview);

// GET /api/admin/analytics/campaigns  (list for a dropdown selector)
router.get("/campaigns", getCampaignsList);

// GET /api/admin/analytics/campaigns/:campaignId  (impressions + age/gender + hourly trend)
router.get("/campaigns/:campaignId", getCampaignAnalytics);

// GET /api/admin/analytics/revenue  (total revenue + per-brand breakdown)
router.get("/revenue", getRevenue);

module.exports = router;