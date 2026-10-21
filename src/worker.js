// agnamo · trip — Worker: serves the static app and POST /api/scan.
// Model traffic: Cloudflare AI Gateway -> DeepSeek only. The DeepSeek key lives in the gateway (BYOK).

const GATEWAY = "default";
const MODEL = "deepseek-v4-pro";

const PROMPT = `You are a flight booking parser. Extract all trip details from this screenshot. Return ONLY valid JSON with these fields: {"airline":"airline name","flightNumber":"flight code","departureTime":"HH:MM","departureDate":"YYYY-MM-DD","returnDate":"YYYY-MM-DD or null","destinationCity":"city name","bookingRef":"6-char code"}. If you cant find a field use null.`;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function parseScreenshot(env, image) {
  const url = image.startsWith("data:") ? image : `data:image/png;base64,${image}`;
  const res = await env.AI.gateway(env.AIG_GATEWAY || GATEWAY).run({
    provider: "deepseek",
    endpoint: "chat/completions",
    headers: { "content-type": "application/json" },
    query: {
      model: env.DEEPSEEK_MODEL || MODEL,
      messages: [{ role: "user", content: [
        { type: "text", text: PROMPT },
        { type: "image_url", image_url: { url } },
      ]}],
      max_tokens: 500,
      temperature: 0.1,
    },
  });
  if (!res.ok) throw new Error(`Gateway/DeepSeek ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON in model reply");
  return JSON.parse(m[0]);
}

async function geocode(city) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
  const c = (await r.json()).results?.[0];
  return c ? { name: c.name, country: c.country, cc: c.country_code, lat: c.latitude, lon: c.longitude, tz: c.timezone } : null;
}

async function getWeather(lat, lon, tz) {
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=${encodeURIComponent(tz || "auto")}&forecast_days=14`);
  return r.json();
}

async function scan(request, env) {
  let image;
  try { ({ image } = await request.json()); } catch { return json({ error: "Bad JSON" }, 400); }
  if (!image) return json({ error: "No image" }, 400);
  try {
    const parsed = await parseScreenshot(env, image);
    const geo = parsed.destinationCity ? await geocode(parsed.destinationCity) : null;
    const weather = geo ? await getWeather(geo.lat, geo.lon, geo.tz) : null;
    return json({
      success: true,
      parsed,
      trip: {
        id: crypto.randomUUID(),
        city: geo?.name || parsed.destinationCity || "Unknown",
        country: geo?.country || "", cc: geo?.cc || "",
        lat: geo?.lat || 0, lon: geo?.lon || 0, tz: geo?.tz || "auto",
        depart: parsed.departureDate || null, return: parsed.returnDate || null,
        airline: parsed.airline || "", flightNum: parsed.flightNumber || "",
        flightTime: parsed.departureTime || "", bookingRef: parsed.bookingRef || "",
        items: {}, closet: [], style: [], weather, source: "screenshot",
      },
    });
  } catch (err) {
    console.error(JSON.stringify({ route: "scan", err: String(err) }));
    return json({ error: String(err.message || err) }, 502);
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/scan") {
      return request.method === "POST" ? scan(request, env) : json({ error: "POST only" }, 405);
    }
    return env.ASSETS.fetch(request);
  },
};
