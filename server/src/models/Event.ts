import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * An Event is one speed-dating session.
 * mode "invite_csv" -> roster uploaded ahead of time, join gated by email.
 * mode "instant"    -> open join, participants self-register with name + gender.
 */
const EventConfigSchema = new Schema(
  {
    rounds: { type: Number, default: 5 },
    // Testing defaults (per current decision). Production: 600 / 120.
    dateDurationSec: { type: Number, default: 120 },
    breakDurationSec: { type: Number, default: 30 },
    matchRule: {
      type: String,
      enum: ["opposite_gender_nearest_age", "opposite_gender_random"],
      default: "opposite_gender_nearest_age",
    },
  },
  { _id: false }
);

const EventSchema = new Schema({
  name: { type: String, required: true, trim: true },
  mode: {
    type: String,
    enum: ["invite_csv", "instant"],
    required: true,
  },
  joinPolicy: {
    type: String,
    enum: ["roster_email", "open"],
    required: true,
  },
  joinSlug: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ["draft", "open", "waiting", "running", "completed"],
    default: "draft",
  },
  phase: {
    type: String,
    enum: ["idle", "waiting", "in_date", "in_break", "finished"],
    default: "idle",
  },
  currentRound: { type: Number, default: 0 },
  maxRounds: { type: Number, default: 0 },
  // When the current phase began — drives the count-up timers on every screen.
  phaseStartedAt: { type: Date },
  // When the current phase is scheduled to end (date/break duration).
  phaseEndsAt: { type: Date },
  config: { type: EventConfigSchema, default: () => ({}) },
  createdAt: { type: Date, default: Date.now },
});

export type EventDoc = InferSchemaType<typeof EventSchema>;
export const Event = model("Event", EventSchema);
