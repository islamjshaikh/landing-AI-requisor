import { Router } from "express";
import { db } from "../db";
import { teamsMeetings, rawInputs } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateProjectPlan } from "../lib/openai";
import * as teamsService from "../services/teams-service";
import * as crypto from "crypto";

const router = Router();

const oauthStates = new Map<string, { userId: string; expiresAt: number }>();

function getUserId(req: any): string | null {
  return req.user?.dbUserId || req.user?.claims?.sub || null;
}

router.get("/status", (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  res.json({
    configured: teamsService.isTeamsConfigured(),
    connected: teamsService.hasToken(userId),
  });
});

router.get("/connect", (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  if (!teamsService.isTeamsConfigured()) {
    return res.status(501).json({
      error: "not_configured",
      message: "Microsoft Teams integration is not configured. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in settings.",
    });
  }

  const state = crypto.randomBytes(16).toString("hex");
  oauthStates.set(state, { userId, expiresAt: Date.now() + 10 * 60 * 1000 });

  const authUrl = teamsService.getAuthUrl(state);
  res.json({ url: authUrl });
});

router.get("/oauth/callback", async (req: any, res) => {
  const { code, state, error } = req.query;

  const sendErrorPage = (msg: string) => {
    return res.send(`<script>
if (window.opener) {
  window.opener.postMessage({type:'oauth-error',provider:'teams',error:'${msg}'},'*');
  window.close();
} else {
  document.body.innerHTML = '<p>${msg}. <a href="/meetings">Go back to meetings</a></p>';
}
</script>`);
  };

  if (error) {
    return sendErrorPage(String(error));
  }

  if (!code || !state) {
    return sendErrorPage('Missing code or state');
  }

  const storedState = oauthStates.get(state as string);
  if (!storedState || storedState.expiresAt < Date.now()) {
    oauthStates.delete(state as string);
    return sendErrorPage('Invalid or expired state. Please try connecting again');
  }

  const userId = storedState.userId;
  oauthStates.delete(state as string);

  try {
    const tokens = await teamsService.exchangeCodeForToken(code as string);
    teamsService.storeToken(userId, tokens.access_token, tokens.refresh_token || "", tokens.expires_in);

    res.send(`<script>
if (window.opener) {
  window.opener.postMessage({type:'oauth-success',provider:'teams'},'*');
  window.close();
} else {
  window.location.href = '/meetings';
}
</script>`);
  } catch (err: any) {
    console.error("Teams OAuth error:", err.message);
    res.send(`<script>
if (window.opener) {
  window.opener.postMessage({type:'oauth-error',provider:'teams',error:'Authentication failed'},'*');
  window.close();
} else {
  document.body.innerHTML = '<p>Authentication failed. <a href="/meetings">Go back to meetings</a></p>';
}
</script>`);
  }
});

router.delete("/disconnect", (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  teamsService.removeToken(userId);
  res.json({ success: true });
});

router.post("/meetings", async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const token = await teamsService.getValidToken(userId);
  if (!token) return res.status(401).json({ error: "Not connected to Teams. Please connect first." });

  const { subject, startTime, endTime, attendees } = req.body;
  if (!subject || !startTime || !endTime) {
    return res.status(400).json({ error: "Subject, start time, and end time are required" });
  }

  const startDt = new Date(startTime);
  const endDt = new Date(endTime);
  if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
    return res.status(400).json({ error: "Invalid date format for start or end time" });
  }
  if (endDt <= startDt) {
    return res.status(400).json({ error: "End time must be after start time" });
  }

  try {
    const meeting = await teamsService.createOnlineMeeting(token, subject, startTime, endTime, attendees || []);

    const meetingIdValue = meeting.meetingType === "calendar" ? `calendar:${meeting.id}` : meeting.id;

    const [saved] = await db
      .insert(teamsMeetings)
      .values({
        userId,
        subject: meeting.subject,
        startTime: new Date(meeting.startDateTime),
        endTime: new Date(meeting.endDateTime),
        joinUrl: meeting.joinWebUrl,
        meetingId: meetingIdValue,
        threadId: meeting.chatInfo?.threadId || null,
        status: "scheduled",
        attendees: attendees || [],
      })
      .returning();

    res.json(saved);
  } catch (err: any) {
    console.error("Error creating Teams meeting:", err.message);
    res.status(500).json({ error: "Failed to create meeting: " + err.message });
  }
});

router.get("/meetings", async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const meetings = await db
      .select()
      .from(teamsMeetings)
      .where(eq(teamsMeetings.userId, userId))
      .orderBy(desc(teamsMeetings.startTime));

    res.json(meetings);
  } catch (err: any) {
    console.error("Error fetching meetings:", err.message);
    res.status(500).json({ error: "Failed to fetch meetings" });
  }
});

router.get("/meetings/:id", async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  try {
    const [meeting] = await db
      .select()
      .from(teamsMeetings)
      .where(and(eq(teamsMeetings.id, id), eq(teamsMeetings.userId, userId)));

    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    res.json(meeting);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch meeting" });
  }
});

router.post("/meetings/:id/fetch-transcript", async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const token = await teamsService.getValidToken(userId);
  if (!token) return res.status(401).json({ error: "Not connected to Teams" });

  try {
    const [meeting] = await db
      .select()
      .from(teamsMeetings)
      .where(and(eq(teamsMeetings.id, id), eq(teamsMeetings.userId, userId)));

    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    if (!meeting.meetingId) return res.status(400).json({ error: "No Teams meeting ID found" });

    if (meeting.meetingId.startsWith("calendar:")) {
      return res.status(400).json({
        error: "Automatic transcript fetching is not available for calendar-only meetings. This meeting was created as a calendar event because your Microsoft account doesn't have Teams meeting support. You can manually add a transcript using the 'Add Transcript' option instead."
      });
    }

    let transcripts;
    try {
      transcripts = await teamsService.getMeetingTranscripts(token, meeting.meetingId);
    } catch (apiErr: any) {
      console.error("Transcript API error:", apiErr.message);
      if (apiErr.message?.includes("NotFound") || apiErr.message?.includes("not supported")) {
        return res.status(400).json({
          error: "Transcript fetching is not supported for this meeting. The meeting may have been created as a calendar event, or your Microsoft account doesn't support the Teams transcript API. You can manually add a transcript using the 'Paste Transcript' option instead."
        });
      }
      throw apiErr;
    }

    if (!transcripts || transcripts.length === 0) {
      return res.status(404).json({ error: "No transcripts available for this meeting. Make sure transcription was enabled during the meeting." });
    }

    let fullTranscript = "";
    for (const t of transcripts) {
      const content = await teamsService.getTranscriptContent(token, meeting.meetingId, t.id);
      fullTranscript += content + "\n\n";
    }

    fullTranscript = fullTranscript.trim();

    const [updated] = await db
      .update(teamsMeetings)
      .set({ transcript: fullTranscript, status: "completed" })
      .where(eq(teamsMeetings.id, id))
      .returning();

    await db.insert(rawInputs).values({
      userId,
      title: `Teams Meeting: ${meeting.subject}`,
      content: fullTranscript,
      source: "teams",
      sourceType: "transcript",
      metadata: {
        meetingId: meeting.meetingId,
        teamsMeetingDbId: meeting.id,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
      },
    });

    res.json(updated);
  } catch (err: any) {
    console.error("Error fetching transcript:", err.message);
    res.status(500).json({ error: "Failed to fetch transcript: " + err.message });
  }
});

router.post("/meetings/:id/save-transcript", async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const { transcript } = req.body;
  if (!transcript) return res.status(400).json({ error: "Transcript content is required" });

  try {
    const [meeting] = await db
      .select()
      .from(teamsMeetings)
      .where(and(eq(teamsMeetings.id, id), eq(teamsMeetings.userId, userId)));

    if (!meeting) return res.status(404).json({ error: "Meeting not found" });

    const [updated] = await db
      .update(teamsMeetings)
      .set({ transcript, status: "completed" })
      .where(eq(teamsMeetings.id, id))
      .returning();

    await db.insert(rawInputs).values({
      userId,
      title: `Teams Meeting: ${meeting.subject}`,
      content: transcript,
      source: "teams",
      sourceType: "transcript",
      metadata: {
        teamsMeetingDbId: meeting.id,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        manualEntry: true,
      },
    });

    res.json(updated);
  } catch (err: any) {
    console.error("Error saving transcript:", err.message);
    res.status(500).json({ error: "Failed to save transcript" });
  }
});

router.post("/meetings/:id/generate-plan", async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  try {
    const [meeting] = await db
      .select()
      .from(teamsMeetings)
      .where(and(eq(teamsMeetings.id, id), eq(teamsMeetings.userId, userId)));

    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    if (!meeting.transcript) return res.status(400).json({ error: "No transcript available. Fetch or add a transcript first." });

    const prompt = `Based on the following Microsoft Teams meeting transcript, create a comprehensive project plan. 
    
Meeting Subject: ${meeting.subject}
Meeting Date: ${meeting.startTime ? new Date(meeting.startTime).toLocaleDateString() : "Unknown"}
Attendees: ${meeting.attendees?.join(", ") || "Unknown"}

TRANSCRIPT:
${meeting.transcript}

Analyze the discussion, identify action items, decisions made, key topics, and create a detailed project plan with tasks, priorities, and timelines.`;

    const plan = await generateProjectPlan(prompt);

    const [updated] = await db
      .update(teamsMeetings)
      .set({ projectPlan: plan })
      .where(eq(teamsMeetings.id, id))
      .returning();

    res.json({ meeting: updated, plan });
  } catch (err: any) {
    console.error("Error generating plan:", err.message);
    res.status(500).json({ error: "Failed to generate project plan: " + err.message });
  }
});

router.delete("/meetings/:id", async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  try {
    await db
      .delete(teamsMeetings)
      .where(and(eq(teamsMeetings.id, id), eq(teamsMeetings.userId, userId)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete meeting" });
  }
});

router.get("/calendar-events", async (req: any, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const token = await teamsService.getValidToken(userId);
  if (!token) return res.status(401).json({ error: "Not connected to Teams" });

  try {
    const events = await teamsService.getCalendarEvents(token);
    res.json(events);
  } catch (err: any) {
    console.error("Error fetching calendar events:", err.message);
    res.status(500).json({ error: "Failed to fetch calendar events" });
  }
});

export default router;
