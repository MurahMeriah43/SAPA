export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const POLLINATIONS_KEY = process.env.POLLINATIONS_KEY;
  const POLLINATIONS_URL = "https://gen.pollinations.ai/v1/images/edits";

  if (!POLLINATIONS_KEY) {
    return new Response(JSON.stringify({ error: { message: "API key belum dikonfigurasi di server." } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Teruskan FormData langsung ke Pollinations
    const formData = await req.formData();

    const res = await fetch(POLLINATIONS_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${POLLINATIONS_KEY}`,
      },
      body: formData,
    });

    // Pollinations bisa balik gambar langsung atau JSON
    const contentType = res.headers.get("content-type") || "";
    if (contentType.startsWith("image/")) {
      const buffer = await res.arrayBuffer();
      return new Response(buffer, {
        status: res.status,
        headers: { "Content-Type": contentType },
      });
    } else {
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: { message: err.message } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = { path: "/api/ai-image" };