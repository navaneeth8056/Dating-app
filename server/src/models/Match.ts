import { Schema, model, Types, type InferSchemaType } from "mongoose";

/**
 * A mutual like. aId/bId are stored sorted so each pair is unique.
 */
const MatchSchema = new Schema({
  eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
  aId: { type: String, required: true },
  bId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

MatchSchema.index({ eventId: 1, aId: 1, bId: 1 }, { unique: true });

export type MatchDoc = InferSchemaType<typeof MatchSchema>;
export const Match = model("Match", MatchSchema);
