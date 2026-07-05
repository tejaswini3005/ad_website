const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const {
  getOverview,
  getCampaignsList,
  getCampaignAnalytics,
} = require("../controllers/analyticsController");

router.use(authMiddleware);

/**
 * User-facing Analytics routes
 * -----------------------------
 * Scoped to the logged-in user's own campaigns only (see
 * controllers/analyticsController.js). A normal user can never see
 * another company's data through these routes.
 */

// GET /api/analytics/overview
router.get("/overview", getOverview);

// GET /api/analytics/campaigns  (list for a dropdown selector)
router.get("/campaigns", getCampaignsList);

// GET /api/analytics/campaigns/:campaignId  (impressions + age/gender + hourly trend)
router.get("/campaigns/:campaignId", getCampaignAnalytics);

module.exports = router;