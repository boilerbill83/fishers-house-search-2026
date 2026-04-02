// netlify/functions/check-status.js
// Uses CommonJS exports for maximum Netlify compatibility

exports.handler = async function(event, context) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }) };
  }

  let house;
  try {
    const body = JSON.parse(event.body);
    house = body.house;
    if (!house || !house.address) throw new Error("Missing house data");
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid request body", details: e.message }) };
  }

  const prompt = `You are checking the current MLS listing status and price of a residential property.

Search the web for the current listing status of this home:
Address: ${house.address}, ${house.city || "Fishers"}, IN
Recorded price in my tracker: $${house.price ? house.price.toLocaleString() : "unknown"}
Neighborhood: ${house.neighborhood || "unknown"}
Listing URL: ${house.url}

Search Zillow, Redfin, or Realtor.com to find:
1. Current status: Active (for sale), Pending (under contract), or Sold
2. Current listing price as a plain integer (no commas, no dollar sign)

Respond with ONLY this exact JSON and nothing else — no preamble, no markdown:
{"detectedStatus":"Active|Pending|Sold|Unknown","currentPrice":500000,"confidence":"High|Medium|Low","reasoning":"one concise sentence about what you found and where"}

If you cannot determine the current price, use null for currentPrice.`;

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
      return { statusCode: 502, headers, body: JSON.stringify({ error: "Anthropic API error", details: errText }) };
    }

    const data = await response.json();
    const textBlocks = (data.content || []).filter((b) => b.type === "text");
    const rawText = textBlocks.map((b) => b.text).join("\n");

    let parsed = null;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      // fall through
    }

    const result = {
      detectedStatus: parsed?.detectedStatus || "Unknown",
      currentPrice:   parsed?.currentPrice   || null,
      confidence:     parsed?.confidence     || "Low",
      reasoning:      parsed?.reasoning      || rawText.slice(0, 150) || "No response",
    };

    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Function error", details: e.message }) };
  }
};
