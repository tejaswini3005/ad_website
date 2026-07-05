const PricingConfig = require("../models/PricingConfig");

async function getConfig() {
  let config = await PricingConfig.findOne().sort({ updatedAt: -1 });
  if (!config) config = await PricingConfig.create({});
  return config;
}

/**
 * Returns the number of days in [startDate, endDate) that are peak days.
 * A day is "peak" if it matches any peakSchedule entry for that weekday.
 * For simplicity we treat the whole day as peak if the day is in the schedule
 * (partial-hour granularity would require per-hour billing which isn't needed yet).
 */
function countPeakDays(startDate, endDate, peakSchedule) {
  const peakDaySet = new Set(peakSchedule.map((s) => s.day)); // {0,5,6} by default
  let peakDays = 0;
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  while (cursor < end) {
    if (peakDaySet.has(cursor.getDay())) peakDays++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return peakDays;
}

// Formula:
// baseCost        = videoDuration (sec) × costPerSecond × repeatRate × durationDays
// peakSurcharge   = (peakDays / durationDays) × baseCost × (peakMultiplier - 1)
// adjustedCost    = (baseCost + peakSurcharge) × placementMultiplier
// withFee         = adjustedCost + platformFee
// gst             = withFee × gstRate
// total           = withFee + gst
async function calculateCampaignEstimate({ startDate, endDate, repeatRate, dailyBudgetCap, placement, videoDuration }) {
  const config = await getConfig();

  const msPerDay = 1000 * 60 * 60 * 24;
  const durationDays = Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / msPerDay));
  const repeatRateNum = Number(repeatRate) || config.defaultRepeatRate;
  const dailyBudgetCapNum = Number(dailyBudgetCap) || 0;
  const videoDurationSec = Number(videoDuration) || 30;

  const placementKey = (placement || "other").toLowerCase().replace(/\s+/g, "_");
  const placementMult = config.placementMultipliers?.[placementKey] ?? 1.0;

  // Peak hours calculation
  const peakSchedule = config.peakSchedule || [];
  const peakDays = countPeakDays(new Date(startDate), new Date(endDate), peakSchedule);
  const offPeakDays = durationDays - peakDays;
  const peakMult = config.peakMultiplier ?? 1.5;

  // Cost split: peak days get peakMult, off-peak days get 1.0
  const dailyBase = videoDurationSec * config.costPerSecond * repeatRateNum;
  const baseCost = dailyBase * offPeakDays + dailyBase * peakMult * peakDays;

  const adjustedCost = baseCost * placementMult;
  const withFee = adjustedCost + config.platformFee;
  const gst = withFee * config.gstRate;
  const estimatedCost = Math.round(withFee + gst);
  const avgDailyCost = Math.round((estimatedCost / durationDays) * 100) / 100;

  let budgetWarning = null;
  if (dailyBudgetCapNum && avgDailyCost > dailyBudgetCapNum) {
    budgetWarning = `Estimated daily cost (₹${avgDailyCost}) exceeds your daily budget cap (₹${dailyBudgetCapNum}).`;
  }

  return {
    durationDays,
    breakdown: {
      videoDurationSec,
      costPerSecond: config.costPerSecond,
      repeatRate: repeatRateNum,
      peakDays,
      offPeakDays,
      peakMultiplier: peakMult,
      baseCost: Math.round(baseCost),
      placementMultiplier: placementMult,
      adjustedCost: Math.round(adjustedCost),
      platformFee: config.platformFee,
      gst: Math.round(gst),
      estimatedCost,
    },
    avgDailyCost,
    budgetWarning,
  };
}

module.exports = { calculateCampaignEstimate, getConfig };
