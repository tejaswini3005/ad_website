const express = require("express");
const Campaign = require("../models/Campaign.model");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/campaigns/admin/stats
router.get(
  "/stats",
  authMiddleware,
  requireRole("admin"),
  async (_req, res) => {
    try {
      const [total, active, pending, revenueResult] = await Promise.all([
        Campaign.countDocuments(),
        Campaign.countDocuments({ status: "public" }),
        Campaign.countDocuments({ status: "pending_review" }),
        Campaign.aggregate([
          { $match: { status: { $in: ["public", "completed"] } } },
          { $group: { _id: null, total: { $sum: "$estimatedCost" } } },
        ]),
      ]);

      res.status(200).json({
        totalCampaigns: total,
        activeCampaigns: active,
        pendingApprovals: pending,
        activeRobots: null,
      });
    } catch {
      res.status(500).json({ message: "Failed to fetch admin stats." });
    }
  },
);

// GET /api/campaigns/admin/all
router.get("/all", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { search, status } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { brandName: { $regex: search, $options: "i" } },
      ];
    }

    const campaigns = await Campaign.find(query)
      .populate("owner", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(campaigns);
  } catch {
    res.status(500).json({ message: "Failed to fetch campaigns." });
  }
});

// GET /api/campaigns/admin/:id
router.get("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id).populate(
      "owner",
      "name email",
    );
    if (!campaign)
      return res.status(404).json({ message: "Campaign not found." });
    res.status(200).json(campaign);
  } catch {
    res.status(500).json({ message: "Failed to fetch campaign." });
  }
});

// PATCH /api/campaigns/admin/:id/approve
router.patch("/:id/approve", authMiddleware, requireRole("admin"), async (req, res) => {
    try {
      const campaign = await Campaign.findByIdAndUpdate(
        req.params.id,
        {
          status: "pending_payment",
          isPublic: false,
          "verification.status": "approved",
          "verification.approvedAt": new Date(),
          "verification.checkedAt": new Date(),
          "verification.checksSummary": "Approved by admin. Awaiting payment to go live.",
        },
        { new: true },
      );
      if (!campaign) return res.status(404).json({ message: "Campaign not found." });

      // Create a Payment record so it appears in admin payments list
      const Payment = require("../models/Payment");
      const existing = await Payment.findOne({ campaign: campaign._id });
      if (!existing) {
        const { calculateCampaignEstimate } = require("../utils/campaignPricing");
        const estimate = await calculateCampaignEstimate({
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          repeatRate: campaign.repeatRate,
          dailyBudgetCap: campaign.dailyBudgetCap,
          placement: campaign.placement,
        });
        const amountPaise = estimate.breakdown.estimatedCost * 100;
        await Payment.create({
          campaign: campaign._id,
          advertiser: campaign.owner,
          razorpayOrderId: `ADMIN-${campaign._id}-${Date.now()}`,
          amount: amountPaise,
          currency: "INR",
          status: "created",
          breakdown: {
            durationDays: estimate.durationDays,
            baseCost: estimate.breakdown.baseCost,
            platformFee: estimate.breakdown.platformFee,
            gstAmount: estimate.breakdown.gst,
          },
        });
      }

      res.status(200).json(campaign);
    } catch (err) {
      console.error("Approve campaign error:", err);
      res.status(500).json({ message: "Failed to approve campaign." });
    }
  },
);

// PATCH /api/campaigns/admin/:id/reject
router.patch("/:id/reject", authMiddleware, requireRole("admin"), async (req, res) => {
    try {
      const { reason } = req.body;
      const campaign = await Campaign.findByIdAndUpdate(
        req.params.id,
        {
          status: "rejected",
          isPublic: false,
          "verification.status": "rejected",
          "verification.checkedAt": new Date(),
          "verification.checksSummary": reason ? `Rejected by admin: ${reason}` : "Rejected by admin.",
        },
        { new: true },
      );
      if (!campaign) return res.status(404).json({ message: "Campaign not found." });
      res.status(200).json(campaign);
    } catch {
      res.status(500).json({ message: "Failed to reject campaign." });
    }
  },
);

// PATCH /api/campaigns/admin/:id/pause
router.patch(
  "/:id/pause",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const campaign = await Campaign.findByIdAndUpdate(
        req.params.id,
        { status: "paused", isPublic: false },
        { new: true },
      );
      if (!campaign)
        return res.status(404).json({ message: "Campaign not found." });
      res.status(200).json(campaign);
    } catch {
      res.status(500).json({ message: "Failed to pause campaign." });
    }
  },
);

module.exports = router;