// Dispara o Uptime CI (opium-status) a cada 5min via GitHub repository_dispatch.
//
// Existe porque o cron nativo do GitHub Actions ("schedule: */5 * * * *") nao e
// confiavel: os checks reais rodavam a cada ~2h em vez de 5min (throttling do
// proprio GitHub em repos novos/baixo trafego). Isso roda fora da infra do
// Opium de proposito -- e a mesma razao pela qual o status page existe.
export default {
  async scheduled(event, env, ctx) {
    const res = await fetch(
      "https://api.github.com/repos/luizbmartins/opium-status/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "opium-status-cron-worker",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event_type: "uptime" }),
      }
    );

    if (!res.ok) {
      console.error(`repository_dispatch falhou: ${res.status} ${await res.text()}`);
    }
  },

  // GET manual pra testar sem esperar o cron: /?key=<GH_DISPATCH_TOKEN>
  async fetch(request, env, ctx) {
    const key = new URL(request.url).searchParams.get("key");
    if (key !== env.GH_DISPATCH_TOKEN) {
      return new Response("unauthorized\n", { status: 401 });
    }
    await this.scheduled(null, env, ctx);
    return new Response("dispatch enviado\n");
  },
};
