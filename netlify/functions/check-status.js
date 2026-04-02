// netlify/functions/check-status.js
// Proxies property status check requests to Anthropic API server-side.
// API key stays secure in Netlify environment variables, never in frontend code.

export const config = {
  schedule: undefined,
  timeout: 26, // seconds — max for Netlify free tier
};

export default async (req, context) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured in Netlify environment variables" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let house;
  try {
    const body = await req.json();
    house = body.house;
    if (!house || !house.address) throw new Error("Missing house data");
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid request body", details: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const prompt = `You are checking the current MLS listing status of a residential property.

Search the web for the current listing status of this home:
Address: ${house.address}, ${house.city || "Fishers"}, IN
Price: $${house.price?.toLocaleString() || "unknown"}
Neighborhood: ${house.neighborhood || "unknown"}
Listing URL: ${house.url}

Search Zillow, Redfin, or Realtor.com to find if this property is currently Active (for sale), Pending (under contract), or Sold.

Respond with ONLY this exact JSON and nothing else — no preamble, no markdown:
{"detectedStatus":"Active|Pending|Sold|Unknown","confidence":"High|Medium|Low","reasoning":"one concise sentence about what you found and where"}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: "Anthropic API error", details: errText }),
        { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const data = await response.json();

    // Extract text blocks from response (web_search runs server-side)
    const textBlocks = (data.content || []).filter((b) => b.type === "text");
    const rawText = textBlocks.map((b) => b.text).join("\n");

    // Parse JSON from response
    let parsed = null;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      // Fall through to Unknown
    }

    const result = {
      detectedStatus: parsed?.detectedStatus || "Unknown",
      confidence: parsed?.confidence || "Low",
      reasoning: parsed?.reasoning || rawText.slice(0, 150) || "No response",
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Function error", details: e.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
};
