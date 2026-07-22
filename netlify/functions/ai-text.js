export default async (req) => {
  // Hanya terima POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const DAHL_API_KEY = process.env.DAHL_API_KEY;
  const DAHL_URL     = "https://inference.dahl.global/v1/chat/completions";

  if (!DAHL_API_KEY) {
    return new Response(JSON.stringify({ error: { message: "API key belum dikonfigurasi di server." } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    const res = await fetch(DAHL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DAHL_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: { message: err.message } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = { path: "/api/ai-text" };