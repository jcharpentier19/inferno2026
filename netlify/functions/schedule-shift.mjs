import { getStore } from "@netlify/blobs";

const VALID_TOKEN = "abc123";
const VALID_DAYS = ["fri", "sat", "sun"];

export default async function handler(req, context) {
  const store = getStore("schedule-data");

  // GET — anyone can read the current shift
  if (req.method === "GET") {
    try {
      const data = await store.get("shift", { type: "json" });
      if (data) {
        // Migrate old single-offset format to per-day format
        if (typeof data.offset === "number" && !data.offsets) {
          return new Response(
            JSON.stringify({ offsets: {} }),
            { headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ offsets: {} }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ offsets: {} }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // POST — only the director (with valid token) can update
  if (req.method === "POST") {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (token !== VALID_TOKEN) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const body = await req.json();
      const day = body.day;
      const offset = parseInt(body.offset, 10);

      if (!VALID_DAYS.includes(day)) {
        return new Response(JSON.stringify({ error: "Invalid day" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (isNaN(offset)) {
        return new Response(JSON.stringify({ error: "Invalid offset" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Load existing data
      let existing = {};
      try {
        const stored = await store.get("shift", { type: "json" });
        if (stored && stored.offsets) {
          existing = stored.offsets;
        }
      } catch {
        // start fresh
      }

      // Update the specific day
      if (offset === 0) {
        delete existing[day];
      } else {
        existing[day] = {
          offset: offset,
          timestamp: body.timestamp || null,
        };
      }

      const payload = { offsets: existing };
      await store.setJSON("shift", payload);

      return new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ error: "Bad request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}

export const config = {
  path: "/api/schedule-shift",
};
