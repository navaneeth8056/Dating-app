import { Router } from "express";
import { Event } from "../models/Event";
import { Participant } from "../models/Participant";
import { signSession } from "../auth/jwt";

export const joinRouter = Router();

/**
 * Join an event via its public slug.
 * - roster_email (Mode A): body { email, name? } -> cross-check against roster.
 * - open (Mode B):         body { name, gender } -> self-register.
 * On success returns a session token + participant info.
 */
joinRouter.post("/:slug", async (req, res) => {
  try {
    const event = await Event.findOne({ joinSlug: req.params.slug });
    if (!event) return res.status(404).json({ error: "event not found" });

    // No late joins once the event is running or finished.
    if (event.status === "running" || event.status === "completed") {
      return res.status(409).json({
        error: "event_started",
        message: "Sorry, the event has started — you can no longer join.",
      });
    }

    // ---- Mode A: gated by roster email ----
    if (event.joinPolicy === "roster_email") {
      const email = (req.body?.email ?? "").trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ error: "email is required" });
      }

      const participant = await Participant.findOne({
        eventId: event._id,
        email,
      });

      if (!participant) {
        return res.status(403).json({
          error: "not_on_roster",
          message:
            "This email isn't on the guest list. Please log in with your registered email.",
        });
      }

      participant.authStatus = "verified";
      await participant.save();

      const token = signSession({
        participantId: String(participant._id),
        eventId: String(event._id),
      });

      return res.json({
        token,
        participant: {
          id: participant._id,
          name: participant.name,
          email: participant.email,
        },
      });
    }

    // ---- Mode B: open join ----
    const name = (req.body?.name ?? "").trim();
    const gender = (req.body?.gender ?? "").trim().toLowerCase();
    const phone = (req.body?.phone ?? "").trim();
    if (!name || !gender || !phone) {
      return res
        .status(400)
        .json({ error: "name, gender and phone are required" });
    }

    const participant = await Participant.create({
      eventId: event._id,
      name,
      gender,
      phone,
      source: "self",
      authStatus: "verified",
    });

    const token = signSession({
      participantId: String(participant._id),
      eventId: String(event._id),
    });

    return res.json({
      token,
      participant: {
        id: participant._id,
        name: participant.name,
        gender: participant.gender,
      },
    });
  } catch (err) {
    console.error("[join] failed", err);
    res.status(500).json({ error: "failed to join" });
  }
});
