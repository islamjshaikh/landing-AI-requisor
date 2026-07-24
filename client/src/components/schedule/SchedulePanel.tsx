

import React, { useEffect, useState } from "react";
import axios from "axios";

type Props = {
  /** Base site (NO trailing /api), e.g. https://app.example.com */
  BASE_API?: string;
  initialTopic: string;
  initialTone: string;
  platform: string; // "Mastodon" | "LinkedIn"
};

type Job = {
  id: string;
  topic: string;
  tone: string;
  platform: string;
  mastodon_instance?: string | null;
  run_at_utc: string; // ISO
  status: string;
  last_error?: string | null;
};

const SchedulePanel: React.FC<Props> = ({
  BASE_API,
  initialTopic,
  initialTone,
  platform,
}) => {
  const baseSite = (BASE_API || window.location.origin).replace(/\/+$/, "");
  const scheduleUrl = `${baseSite}/api/schedule`;

  const [topic, setTopic] = useState(initialTopic);
  const [tone, setTone] = useState(initialTone);
  const [runAt, setRunAt] = useState<string>(""); // "YYYY-MM-DDTHH:MM"
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => setTopic(initialTopic), [initialTopic]);
  useEffect(() => setTone(initialTone), [initialTone]);

  const loadJobs = async () => {
    try {
      const { data } = await axios.get<Job[]>(scheduleUrl, { withCredentials: false });
      setJobs(data);
    } catch (e: any) {
      console.warn("Failed to load schedules:", e?.message || e);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const schedulePost = async () => {
    setBusy(true);
    setErr("");

    // Need Mastodon creds when scheduling Mastodon posts
    let masto_instance: string | undefined;
    let masto_token: string | undefined;

    if (platform === "Mastodon") {
      masto_instance = localStorage.getItem("ma_instance") || undefined;
      masto_token = localStorage.getItem("ma_access_token") || undefined;
      if (!masto_instance || !masto_token) {
        setErr("Please connect Mastodon first (green 'Connected' badge), then try again.");
        setBusy(false);
        return;
      }
    }

    if (!runAt) {
      setErr("Pick a date & time to schedule.");
      setBusy(false);
      return;
    }

    try {
      const payload: any = {
        topic: (topic || "").trim(),
        tone: (tone || "").trim(),
        platform,
        run_at_iso: runAt,                         // local 'YYYY-MM-DDTHH:MM'
        tz_offset_minutes: new Date().getTimezoneOffset(),
        mastodon_instance,
        mastodon_access_token: masto_token,
      };

      const { data } = await axios.post(scheduleUrl, payload, { withCredentials: false });

      if (data?.success) {
        await loadJobs();
        alert("✅ Scheduled!");
        setRunAt("");
      } else {
        setErr(data?.error || "Failed to create schedule.");
      }
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10 border rounded-xl p-4">
      <h3 className="text-lg font-semibold mb-3">Schedule a Post</h3>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium">Topic</label>
          <input
            type="text"
            className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What should we post about?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Tone</label>
          <select
            className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
          >
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="witty">Witty</option>
            <option value="friendly">Friendly</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Platform</label>
          <input
            type="text"
            className="mt-1 block w-full border border-gray-200 rounded-md p-2 bg-gray-50"
            value={platform}
            readOnly
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Run at (your local time)</label>
          <input
            type="datetime-local"
            className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            value={runAt}
            onChange={(e) => setRunAt(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            We'll convert to UTC and run at that exact instant.
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={schedulePost}
          disabled={busy}
          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
        >
          {busy ? "Scheduling..." : "Schedule Post"}
        </button>
        {err && <span className="text-sm text-red-600 self-center">{err}</span>}
      </div>

      {/* Upcoming jobs */}
      <div className="mt-6">
        <h4 className="font-semibold mb-2">Upcoming / Recent Jobs</h4>
        <div className="space-y-2">
          {jobs.length === 0 && (
            <div className="text-sm text-gray-500">No jobs yet.</div>
          )}
          {jobs.map((j) => (
            <div
              key={j.id}
              className="border rounded p-3 text-sm flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{j.platform} · {j.tone}</div>
                <div className="text-gray-700">{j.topic}</div>
                <div className="text-gray-500">
                  UTC: {new Date(j.run_at_utc).toLocaleString()}
                </div>
                {j.mastodon_instance && (
                  <div className="text-gray-500">Instance: {j.mastodon_instance}</div>
                )}
                {j.last_error && (
                  <div className="text-red-600">Error: {j.last_error}</div>
                )}
              </div>
              <div className="text-xs rounded px-2 py-1 bg-gray-100">
                {j.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SchedulePanel;
