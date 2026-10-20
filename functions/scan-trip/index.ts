import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_KEY") || "";
const SB_URL = Deno.env.get("SB_URL") || "";
const SB_KEY = Deno.env.get("SB_SERVICE_KEY") || "";

const AIRLINES: Record<string, string> = {
  JL: "JAL", NH: "ANA", AA: "American Airlines", UA: "United Airlines",
  DL: "Delta", WN: "Southwest", BA: "British Airways", AF: "Air France",
  LH: "Lufthansa", KL: "KLM", EK: "Emirates", QR: "Qatar Airways",
  SQ: "Singapore Airlines", CX: "Cathay Pacific", AC: "Air Canada",
  QF: "Qantas", NZ: "Air New Zealand", VS: "Virgin Atlantic",
  FI: "Icelandair", SK: "SAS", IB: "Iberia", AZ: "ITA Airways",
  KE: "Korean Air", OZ: "Asiana Airlines", CA: "Air China",
  MU: "China Eastern", CZ: "China Southern", TG: "Thai Airways",
  HA: "Hawaiian Airlines", B6: "JetBlue", NK: "Spirit",
  AS: "Alaska Airlines", WS: "WestJet",
};

async function parseScreenshot(imageBase64: string) {
  const prompt = `You are a flight booking parser. Extract all trip details from this screenshot.
Return ONLY valid JSON with these fields:
{
  "airline": "airline name",
  "flightNumber": "flight code like JL 005",
  "departureTime": "HH:MM format",
  "departureDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD or null if one-way",
  "destinationCity": "city name only",
  "bookingRef": "6-char confirmation code"
}
If you can't find a field, use null. Be precise with dates.`;

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-v4-pro",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}` } },
        ],
      }],
      max_tokens: 500,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response: " + text);
  return JSON.parse(jsonMatch[0]);
}

async function geocode(city: string) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
  const d = await r.json();
  if (!d.results?.[0]) return null;
  const c = d.results[0];
  return { name: c.name, country: c.country, cc: c.country_code, lat: c.latitude, lon: c.longitude, tz: c.timezone };
}

async function getWeather(lat: number, lon: number, tz: string) {
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=${encodeURIComponent(tz || "auto")}&forecast_days=14`);
  return await r.json();
}

function genPackingList(weather: any, departDate: string | null) {
  const items: Record<string, any> = {};
  // Base items
  const base = [
    ["apparel", "Tops / Tees", 3], ["apparel", "Pants / Shorts", 2],
    ["apparel", "Evening Fit", 1], ["apparel", "Sleepwear", 1],
    ["apparel", "Underwear & Socks", 5], ["apparel", "Light Jacket", 1],
    ["grooming", "Skincare", 1], ["grooming", "Deodorant", 1],
    ["grooming", "Hair Products", 1], ["grooming", "Toothbrush & Paste", 1],
    ["grooming", "Shower Kit", 1],
    ["gear", "Sneakers", 1], ["gear", "Dress Shoes", 1],
    ["gear", "Sunglasses & Watch", 1], ["gear", "Day Bag", 1],
    ["tech", "Phone + Cable", 1], ["tech", "Power Bank", 1],
    ["tech", "Earbuds / Headphones", 1], ["tech", "Wallet & ID", 1],
  ];
  base.forEach(([cat, label, qty]) => {
    items[`seed-${cat}-${label}`] = { cat, label, checked: false, qty, auto: false };
  });

  if (!weather?.daily) return items;
  const d = weather.daily;
  let maxT = 22, minT = 15, rain = false, snow = false, uvHi = false;
  const depIdx = departDate ? d.time.indexOf(departDate) : 0;
  const n = Math.min(7, d.time.length - Math.max(0, depIdx));
  for (let i = Math.max(0, depIdx); i < Math.max(0, depIdx) + n && i < d.time.length; i++) {
    maxT = Math.max(maxT, d.temperature_2m_max[i]);
    minT = Math.min(minT, d.temperature_2m_min[i]);
    if ((d.precipitation_probability_max?.[i] ?? 0) > 30) rain = true;
    if (d.weather_code[i] >= 71 && d.weather_code[i] <= 77) snow = true;
    if ((d.uv_index_max?.[i] ?? 0) > 6) uvHi = true;
  }
  const add = (label: string, cat: string, key: string) => {
    if (!items[`auto-${key}`]) items[`auto-${key}`] = { cat, label, checked: false, qty: 1, auto: true };
  };
  if (maxT >= 28) { add("Sunscreen", "grooming", "sunscreen"); add("Hat / Cap", "apparel", "hat"); }
  if (minT <= 5) { add("Heavy jacket", "apparel", "heavy-jacket"); add("Thermal base layer", "apparel", "thermal"); add("Gloves", "apparel", "gloves"); }
  if (minT <= -5) { add("Scarf", "apparel", "scarf"); add("Warm beanie", "apparel", "beanie"); }
  if (rain) { add("Rain jacket", "gear", "rain-jacket"); add("Umbrella", "gear", "umbrella"); }
  if (snow) { add("Snow boots", "gear", "snow-boots"); }
  if (uvHi) { add("Sunglasses", "gear", "sunglasses"); }
  if (maxT <= 18 && minT >= 6) { add("Light layer", "apparel", "light-layer"); }
  return items;
}

function uuid() {
  return crypto.randomUUID();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const { image } = await req.json();
    if (!image) return new Response(JSON.stringify({ error: "No image provided" }), {
      status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

    // 1. Parse the screenshot with vision AI
    const parsed = await parseScreenshot(image);
    
    // 2. Geocode the destination
    let geo = null;
    if (parsed.destinationCity) {
      geo = await geocode(parsed.destinationCity);
    }
    
    // 3. Fetch weather
    let weather = null;
    if (geo) {
      weather = await getWeather(geo.lat, geo.lon, geo.tz);
    }
    
    // 4. Generate packing list
    const items = genPackingList(weather, parsed.departureDate);
    
    // 5. Build the trip object
    const trip = {
      id: uuid(),
      city: geo?.name || parsed.destinationCity || "Unknown",
      country: geo?.country || "",
      cc: geo?.cc || "",
      lat: geo?.lat || 0,
      lon: geo?.lon || 0,
      tz: geo?.tz || "auto",
      depart: parsed.departureDate || null,
      return_date: parsed.returnDate || null,
      airline: parsed.airline || "",
      flight_num: parsed.flightNumber || "",
      flight_time: parsed.departureTime || "",
      booking_ref: parsed.bookingRef || "",
      items,
      closet: [],
      style: [],
      weather,
      source: "screenshot",
      raw_ocr: JSON.stringify(parsed),
    };
    
    // 6. Save to Supabase
    const sbRes = await fetch(`${SB_URL}/rest/v1/trips`, {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify(trip),
    });
    
    if (!sbRes.ok) {
      const errText = await sbRes.text();
      console.error("Supabase save error:", errText);
    }
    
    // 7. Return the trip (convert to app format)
    const tripData = await sbRes.json();
    const saved = Array.isArray(tripData) ? tripData[0] : tripData;
    
    return new Response(JSON.stringify({
      success: true,
      trip: {
        id: saved?.id || trip.id,
        city: trip.city,
        country: trip.country,
        cc: trip.cc,
        lat: trip.lat,
        lon: trip.lon,
        tz: trip.tz,
        depart: trip.depart,
        return: trip.return_date,
        airline: trip.airline,
        flightNum: trip.flight_num,
        flightTime: trip.flight_time,
        bookingRef: trip.booking_ref,
        items: trip.items,
        closet: [],
        style: [],
        weather: trip.weather,
        source: "screenshot",
      },
      parsed,
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Failed to process" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
