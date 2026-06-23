import { Schema, model, Types, type InferSchemaType } from "mongoose";

/**
 * One 1:1 date in a specific round of an event.
 * status "active" = happening; "left" = someone left early (escape hatch).
 */
const PairingSchema = new Schema({
  eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
  round: { type: Number, required: true },
  aId: { type: String, required: true }, // male participant id
  bId: { type: String, required: true }, // female participant id
  status: { type: String, enum: ["active", "left"], default: "active" },
  roomName: { type: String }, // Daily.co room (created at round start)
  roomUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
});

PairingSchema.index({ eventId: 1, round: 1 });

export type PairingDoc = InferSchemaType<typeof PairingSchema>;
export const Pairing = model("Pairing", PairingSchema);
