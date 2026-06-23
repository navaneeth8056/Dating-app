import { Schema, model, Types, type InferSchemaType } from "mongoose";

/**
 * A Participant belongs to one Event.
 * - source "csv": uploaded by admin (Mode A). Has email + gender + age.
 * - source "self": self-registered at join (Mode B). Has name + gender (no age/email).
 */
const ParticipantSchema = new Schema({
  eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  gender: { type: String, trim: true, lowercase: true }, // "male" | "female" | other
  age: { type: Number },
  phone: { type: String, trim: true },
  extra: { type: Schema.Types.Mixed, default: {} },
  source: { type: String, enum: ["csv", "self"], default: "csv" },
  authStatus: {
    type: String,
    enum: ["invited", "verified"],
    default: "invited",
  },
  presence: {
    type: String,
    enum: ["offline", "in_waiting_room", "in_date", "disconnected"],
    default: "offline",
  },
  socketId: { type: String },
  lastSeenAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

// Email unique per event, but only when an email actually exists (Mode B has none).
ParticipantSchema.index(
  { eventId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } }
);

export type ParticipantDoc = InferSchemaType<typeof ParticipantSchema>;
export const Participant = model("Participant", ParticipantSchema);
