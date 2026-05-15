// netlify/functions/api.js
// Proxy seguro entre o site e o Google Apps Script.
// A URL real do Apps Script fica no servidor — nunca exposta ao visitante.

export default async (req, context) => {
  const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

  if (!APPS_SCRIPT_URL) {
    return new Response(
      JSON.stringify({ error: "APPS_SCRIPT_URL não configurada" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const response = await fetch(APPS_SCRIPT_URL);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60", // cache 60s no CDN
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro ao buscar dados", detail: err.message }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = {
  path: "/api",           // acessível em seusite.com/api
  cache: { mustRevalidate: true },
};
