// netlify/functions/commute.js
// Returns 8am-Tuesday rush-hour drive time from a Fishers address to OneAmerica Tower.
// Requires GOOGLE_MAPS_API_KEY environment variable in Netlify.

const DESTINATION = "1 American Square, Indianapolis, IN 46282";

function nextTuesdayAt8amEastern() {
  const now = new Date();
  // April–October = EDT (UTC-4); 8am EDT = 12:00 UTC
  // November–March = EST (UTC-5); 8am EST = 13:00 UTC
  const month = now.getUTCMonth() + 1;
  const isDst = month >= 3 && month <= 11;
  const targetUtcHour = isDst ? 12 : 13;

  const dayOfWeek = now.getUTCDay(); // 0=Sun … 2=Tue
  let daysUntilTuesday = (2 - dayOfWeek + 7) % 7;
  if (daysUntilTuesday === 0 && now.getUTCHours() >= targetUtcHour) {
    daysUntilTuesday = 7;
  }

  const target = new Date(now);
  target.setUTCDate(now.getUTCDate() + daysUntilTuesday);
  target.setUTCHours(targetUtcHour, 0, 0, 0);
  return Math.floor(target.getTime() / 1000);
}

exports.handler = async function (event) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not set" }) };
  }

  let origin;
  try {
    ({ address: origin } = JSON.parse(event.body));
    if (!origin) throw new Error("missing address");
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid body: " + e.message }) };
  }

  const departureTime = nextTuesdayAt8amEastern();
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", DESTINATION);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("departure_time", departureTime);
  url.searchParams.set("traffic_model", "best_guess");
  url.searchParams.set("key", apiKey);

  try {
    const resp = await fetch(url.toString());
    const data = await resp.json();

    const element = data?.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ error: "No route found", raw: element }),
      };
    }

    const seconds = element.duration_in_traffic?.value ?? element.duration?.value;
    const minutes = Math.round(seconds / 60);
    const text = element.duration_in_traffic?.text ?? element.duration?.text;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ minutes, text }),
    };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
