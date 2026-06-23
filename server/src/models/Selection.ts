import { Schema, model, Types, type InferSchemaType } from "mongoose";

/**
 * One participant's decision about someone they met.
 * decision "like" = want to see again; "pass" = not interested.
 */
const SelectionSchema = new Schema({
  eventId: { type: Types.ObjectId, ref: "Event", required: true, index: true },
  fromId: { type: String, required: true }, // chooser
  toId: { type: String, required: true }, // person being chosen
  decision: { type: String, enum: ["like", "pass"], required: true },
  createdAt: { type: Date, default: Date.now },
});

SelectionSchema.index({ eventId: 1, fromId: 1, toId: 1 }, { unique: true });

export type SelectionDoc = InferSchemaType<typeof SelectionSchema>;
export const Selection = model("Selection", SelectionSchema);
