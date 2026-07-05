const mongoose = require("mongoose");
const AudienceEvent = require("../models/AudienceEvent");
const Campaign = require("../models/Campaign.model");

const AGE_GROUPS = ["0-12", "13-18", "19-25", "26-35", "36-50", "50+"];
const GENDERS = ["male", "female", "unknown"];

const randomOf = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Rough hourly "traffic shape" for a mall/retail-style footfall pattern —
// used only to make dummy data look plausible (quiet mornings, lunch bump,
// evening peak). Index = hour of day (0-23), value = relative weight.
const HOURLY_WEIGHTS = [
  1, 1, 1, 1, 1, 2, 4, 8, 12, 16, 18, 22, 26, 24, 20, 18, 22, 28, 32, 30, 22, 14, 8, 3,
];

function weightedRandomHour() {
  const total = HOURLY_WEIGHTS.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let hour = 0; hour < HOURLY_WEIGHTS.length; hour += 1) {
    roll -= HOURLY_WEIGHTS[hour];
    if (roll <= 0) return hour;
  }
  return 12;
}

/**
 * Ensures there's at least some AudienceEvent data to show on the
 * dashboard. Only seeds if the collection is currently empty (or when
 * explicitly forced), so it never overwrites real robot data once that
 * starts flowing in.
 */
async function ensureDummyAudienceEvents({ force = false, daysBack = 14, perCampaignPerDay = 45 } = {}) {
  const existingCount = await AudienceEvent.countDocuments({});
  if (existingCount > 0 && !force) {
    return { seeded: false, count: existingCount };
  }

  const campaigns = await Campaign.find({}, { _id: 1, robotPlacement: 1 }).lean();
  if (campaigns.length === 0) {
    return { seeded: false, count: 0, reason: "no campaigns to attach dummy events to" };
  }

  if (force) {
    await AudienceEvent.deleteMany({ isDemoData: true });
  }

  const robotIds = ["RBT-01", "RBT-02", "RBT-03", "RBT-04"];
  const now = new Date();
  const docs = [];

  for (const campaign of campaigns) {
    for (let dayOffset = 0; dayOffset < daysBack; dayOffset += 1) {
      const eventsToday = randomInt(
        Math.max(5, perCampaignPerDay - 15),
        perCampaignPerDay + 15,
      );

      for (let i = 0; i < eventsToday; i += 1) {
        const day = new Date(now);
        day.setDate(day.getDate() - dayOffset);
        day.setHours(weightedRandomHour(), randomInt(0, 59), randomInt(0, 59), 0);

        docs.push({
          campaign: campaign._id,
          robotId: randomOf(robotIds),
          ageGroup: randomOf(AGE_GROUPS),
          gender: randomOf(GENDERS),
          lookDurationMs: randomInt(800, 9000),
          timestamp: day,
          isDemoData: true,
        });
      }
    }
  }

  if (docs.length > 0) {
    await AudienceEvent.insertMany(docs, { ordered: false });
  }

  return { seeded: true, count: docs.length };
}

/**
 * Helper: resolve the list of campaign _ids owned by a given user.
 * Returns null when ownerId is not provided, meaning "no restriction"
 * (used by the admin/unscoped callers).
 */
async function resolveOwnedCampaignIds(ownerId) {
  if (!ownerId) return null;
  const owned = await Campaign.find({ owner: ownerId }, { _id: 1 }).lean();
  return owned.map((c) => c._id);
}

/**
 * Overview numbers for the top metric cards.
 * When ownerId is provided, restricts to that user's own campaigns only.
 * When omitted (admin use), covers the whole network.
 */
async function getOverviewAnalytics(ownerId = null) {
  await ensureDummyAudienceEvents();

  const campaignIds = await resolveOwnedCampaignIds(ownerId);
  const eventFilter = campaignIds ? { campaign: { $in: campaignIds } } : {};

  const [totalImpressions, activeRobots, campaignsWithEvents] = await Promise.all([
    AudienceEvent.countDocuments(eventFilter),
    AudienceEvent.distinct("robotId", {
      ...eventFilter,
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }),
    AudienceEvent.distinct("campaign", eventFilter),
  ]);

  // NOTE: totalDisplays and totalReach are proxied from impressions for now.
  // Once POST /robot/heartbeat is live, totalDisplays should come from actual
  // ad-play events, and totalReach can be deduplicated by a real visitor
  // signature instead of raw look-count.
  return {
    totalImpressions,
    totalDisplays: totalImpressions,
    activeRobots: activeRobots.length,
    totalReach: totalImpressions,
    campaignsTracked: campaignsWithEvents.length,
  };
}

/**
 * Lightweight campaign list for a dropdown selector on the analytics page.
 * When ownerId is provided, only that user's own campaigns are listed.
 */
async function listCampaignsForAnalytics(ownerId = null) {
  const filter = ownerId ? { owner: ownerId } : {};
  const campaigns = await Campaign.find(filter, { title: 1, brandName: 1, status: 1 })
    .sort({ createdAt: -1 })
    .lean();

  return campaigns.map((c) => ({
    id: c._id,
    title: c.title,
    brandName: c.brandName,
    status: c.status,
  }));
}

/**
 * Per-campaign breakdown: total impressions, age distribution, gender
 * distribution, and an hourly time-of-day trend — answering "which age
 * group looked at this ad, and at what time".
 *
 * When ownerId is provided, the campaign must belong to that user, or a
 * 404 is thrown — this stops a normal user from reading another user's
 * campaign analytics just by guessing/changing the campaignId in the URL.
 */
async function getCampaignAudienceAnalytics(campaignId, ownerId = null) {
  await ensureDummyAudienceEvents();

  if (ownerId) {
    const owned = await Campaign.findOne(
      { _id: campaignId, owner: ownerId },
      { _id: 1 },
    ).lean();
    if (!owned) {
      const err = new Error("Campaign not found");
      err.statusCode = 404;
      throw err;
    }
  }

  const [totalImpressions, ageAgg, genderAgg, hourlyAgg, ageByHourAgg] = await Promise.all([
    AudienceEvent.countDocuments({ campaign: campaignId }),

    AudienceEvent.aggregate([
      { $match: { campaign: new mongoose.Types.ObjectId(campaignId) } },
      { $group: { _id: "$ageGroup", count: { $sum: 1 } } },
    ]),

    AudienceEvent.aggregate([
      { $match: { campaign: new mongoose.Types.ObjectId(campaignId) } },
      { $group: { _id: "$gender", count: { $sum: 1 } } },
    ]),

    AudienceEvent.aggregate([
      { $match: { campaign: new mongoose.Types.ObjectId(campaignId) } },
      { $group: { _id: { $hour: "$timestamp" }, count: { $sum: 1 } } },
    ]),

    AudienceEvent.aggregate([
      { $match: { campaign: new mongoose.Types.ObjectId(campaignId) } },
      {
        $group: {
          _id: { hour: { $hour: "$timestamp" }, ageGroup: "$ageGroup" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const ageMap = Object.fromEntries(AGE_GROUPS.map((g) => [g, 0]));
  ageAgg.forEach((row) => {
    ageMap[row._id] = row.count;
  });
  const ageDistribution = AGE_GROUPS.map((group) => ({
    ageGroup: group,
    count: ageMap[group],
    percent: totalImpressions ? Number(((ageMap[group] / totalImpressions) * 100).toFixed(1)) : 0,
  }));

  const genderMap = Object.fromEntries(GENDERS.map((g) => [g, 0]));
  genderAgg.forEach((row) => {
    genderMap[row._id] = row.count;
  });
  const genderDistribution = GENDERS.map((gender) => ({
    gender,
    count: genderMap[gender],
    percent: totalImpressions ? Number(((genderMap[gender] / totalImpressions) * 100).toFixed(1)) : 0,
  }));

  const hourlyMap = Object.fromEntries(Array.from({ length: 24 }, (_, h) => [h, 0]));
  hourlyAgg.forEach((row) => {
    hourlyMap[row._id] = row.count;
  });
  const hourlyTrend = Object.entries(hourlyMap).map(([hour, count]) => ({
    hour: `${hour.padStart(2, "0")}:00`,
    count,
  }));

  // hour -> { ageGroup: count } table, useful for a stacked chart later
  const ageByHour = Array.from({ length: 24 }, (_, hour) => {
    const row = { hour: `${String(hour).padStart(2, "0")}:00` };
    AGE_GROUPS.forEach((g) => {
      row[g] = 0;
    });
    return row;
  });
  ageByHourAgg.forEach(({ _id, count }) => {
    ageByHour[_id.hour][_id.ageGroup] = count;
  });

  const peakHourEntry = hourlyTrend.reduce(
    (max, row) => (row.count > max.count ? row : max),
    { hour: null, count: 0 },
  );
  const topAgeGroupEntry = ageDistribution.reduce(
    (max, row) => (row.count > max.count ? row : max),
    { ageGroup: null, count: 0 },
  );

  return {
    campaignId,
    totalImpressions,
    ageDistribution,
    genderDistribution,
    hourlyTrend,
    ageByHour,
    insights: {
      peakHour: peakHourEntry.hour,
      topAgeGroup: topAgeGroupEntry.ageGroup,
    },
  };
}

/**
 * ADMIN-ONLY: revenue summary across the whole network, plus a
 * per-brand breakdown. "Revenue" per campaign is taken from
 * budget.spent when available (actual money spent so far), falling
 * back to estimatedCost (quoted price) when spent is 0/unset — this
 * keeps the numbers sensible even before real payment/spend tracking
 * is fully wired up.
 */
async function getRevenueAnalytics() {
  const campaigns = await Campaign.find(
    {},
    { brandName: 1, estimatedCost: 1, budget: 1, status: 1 },
  ).lean();

  let totalRevenue = 0;
  const byBrandMap = {};

  campaigns.forEach((c) => {
    const spent = c.budget?.spent || 0;
    const revenue = spent > 0 ? spent : c.estimatedCost || 0;
    totalRevenue += revenue;

    if (!byBrandMap[c.brandName]) {
      byBrandMap[c.brandName] = {
        brandName: c.brandName,
        revenue: 0,
        campaignCount: 0,
      };
    }
    byBrandMap[c.brandName].revenue += revenue;
    byBrandMap[c.brandName].campaignCount += 1;
  });

  const byBrand = Object.values(byBrandMap)
    .map((row) => ({ ...row, revenue: Number(row.revenue.toFixed(2)) }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalCampaigns: campaigns.length,
    topBrand: byBrand[0]?.brandName || null,
    byBrand,
  };
}

module.exports = {
  ensureDummyAudienceEvents,
  getOverviewAnalytics,
  listCampaignsForAnalytics,
  getCampaignAudienceAnalytics,
  getRevenueAnalytics,
};