const mongoose = require("mongoose");

/**
 * AudienceEvent
 * -------------
 * One document = one person detected "looking" at a robot while a given
 * campaign's ad was playing. This is the raw event stream that everything
 * else (impressions, age breakdown, time-of-day trends) is aggregated from.
 *
 * This maps 1:1 to the `audience_events` collection described in the
 * analytics module spec, so when the robot's real camera/vision pipeline
 * is wired up, it can POST directly into this collection (via
 * POST /robot/audience) instead of the dummy seeder below — no schema
 * changes needed later.
 *
 * "Impressions" = count of AudienceEvent documents (optionally filtered
 * by lookDurationMs if you later want to distinguish a glance from an
 * actual look).
 */
const audienceEventSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    robotId: {
      type: String,
      required: true,
      index: true,
    },
    ageGroup: {
      type: String,
      enum: ["0-12", "13-18", "19-25", "26-35", "36-50", "50+"],
      required: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "unknown"],
      default: "unknown",
    },
    // how long this person looked at the robot/ad, in milliseconds
    lookDurationMs: {
      type: Number,
      default: 0,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    // marks dummy/demo rows so they're easy to find & wipe once real
    // robot data starts flowing in
    isDemoData: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

audienceEventSchema.index({ campaign: 1, timestamp: 1 });
audienceEventSchema.index({ campaign: 1, ageGroup: 1 });

module.exports = mongoose.model("AudienceEvent", audienceEventSchema);