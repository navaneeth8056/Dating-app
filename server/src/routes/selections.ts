import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { Pairing } from "../models/Pairing";
import { Participant } from "../models/Participant";
import { Selection } from "../models/Selection";
import { Match } from "../models/Match";
import { verifySession, type SessionPayload } from "../auth/jwt";
import { getIo } from "../realtime/io";

export const selectionsRouter = Router();

interface AuthedRequest extends Request {
  session?: SessionPayload;
}

/** Verifies the participant's JWT (sent as Bearer token). */
function auth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = verifySession(token);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  req.session = session;
  next();
}

const wrap =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req as AuthedRequest, res).catch(next);

const sortPair = (a: string, b: string): [string, string] =>
  a < b ? [a, b] : [b, a];

/**
 * GET /api/selections/dates
 * Everyone I was paired with, my decision so far, and — only on a mutual
 * like — their contact details.
 */
selectionsRouter.get(
  "/dates",
  auth,
  wrap(async (req, res) => {
    const { participantId: me, eventId } = req.session!;

    const pairings = await Pairing.find({
      eventId,
      $or: [{ aId: me }, { bId: me }],
    }).lean();

    // distinct other-party ids
    const otherIds = Array.from(
      new Set(
        pairings.map((p) => (p.aId === me ? p.bId : p.aId)).filter(Boolean)
      )
    );

    const [people, myChoices, theirChoices, matches] = await Promise.all([
      Participant.find({ _id: { $in: otherIds } }).lean(),
      Selection.find({ eventId, fromId: me }).lean(),
      Selection.find({ eventId, toId: me }).lean(),
      Match.find({ eventId }).lean(),
    ]);

    const nameById = new Map(people.map((p) => [String(p._id), p]));
    const myDecByTo = new Map(myChoices.map((c) => [c.toId, c.decision]));
    const matchedSet = new Set(
      matches
        .filter((m) => m.aId === me || m.bId === me)
        .map((m) => (m.aId === me ? m.bId : m.aId))
    );

    const result = otherIds.map((id) => {
      const person = nameById.get(id);
      const matched = matchedSet.has(id);
      return {
        id,
        name: person?.name ?? "Someone",
        myDecision: myDecByTo.get(id) ?? null,
        matched,
        contact: matched
          ? {
              email: person?.email ?? null,
              phone: person?.phone ?? null,
            }
          : null,
      };
    });

    res.json(result);
  })
);

/**
 * POST /api/selections/select  { toId, decision }
 * Records like/pass; on a mutual like, creates the Match.
 */
selectionsRouter.post(
  "/select",
  auth,
  wrap(async (req, res) => {
    const { participantId: me, eventId } = req.session!;
    const toId: string = req.body?.toId;
    const decision: string = req.body?.decision;
    if (!toId || (decision !== "like" && decision !== "pass")) {
      return res.status(400).json({ error: "toId and like/pass required" });
    }

    await Selection.updateOne(
      { eventId, fromId: me, toId },
      { $set: { decision } },
      { upsert: true }
    );

    let matched = false;
    if (decision === "like") {
      const reverse = await Selection.findOne({
        eventId,
        fromId: toId,
        toId: me,
        decision: "like",
      }).lean();
      if (reverse) {
        const [a, b] = sortPair(me, toId);
        await Match.updateOne(
          { eventId, aId: a, bId: b },
          { $setOnInsert: { eventId, aId: a, bId: b } },
          { upsert: true }
        );
        matched = true;
        // Tell everyone in the event to refresh — both sides update instantly.
        getIo()?.to(`event:${eventId}`).emit("match:update");
      }
    }

    res.json({ ok: true, matched });
  })
);
