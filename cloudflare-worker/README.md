# opium-status-cron

Cloudflare Worker com Cron Trigger que dispara o `Uptime CI`
(`.github/workflows/uptime.yml`) a cada 5 minutos via
[`repository_dispatch`](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event).

## Por que existe

O `schedule: "*/5 * * * *"` do próprio GitHub Actions não é confiável — em
13/set/2026 os checks reais rodaram a cada ~2h15min em vez de 5min (GitHub
enfileira/descarta disparos agendados sob carga, mais visível em repositórios
novos/baixo tráfego). Esse Worker roda fora da infra do Opium de propósito —
é a mesma razão pela qual `status.opium.vet` existe como página estática
independente.

## Deploy (via dashboard Cloudflare, sem precisar de `wrangler login`)

1. **Gerar o PAT do GitHub**: https://github.com/settings/personal-access-tokens/new
   — "Fine-grained token", **Repository access: Only select repositories →
   opium-status**, permissão **Contents: Read and write** (é o mínimo que a
   API de `dispatches` aceita). Sem data de expiração muito curta, senão o
   Worker para de funcionar quando o token vencer.
2. **Criar o Worker**: Cloudflare Dashboard → Workers & Pages → Create →
   Worker → nome `opium-status-cron` → cole o conteúdo de `src/index.js` no
   editor (Quick Edit) → Deploy.
3. **Secret**: no Worker criado → Settings → Variables and Secrets → Add →
   nome `GH_DISPATCH_TOKEN`, tipo *Secret*, valor = o PAT do passo 1.
4. **Cron Trigger**: no Worker → Settings → Triggers → Cron Triggers → Add →
   `*/5 * * * *`.
5. **Testar sem esperar o cron**: abrir
   `https://opium-status-cron.<seu-subdominio>.workers.dev/?key=<o mesmo PAT>`
   no navegador — deve responder `dispatch enviado`. Depois conferir em
   https://github.com/luizbmartins/opium-status/actions/workflows/uptime.yml
   se rodou um evento `repository_dispatch`.

## Deploy via CLI (alternativa, se preferir)

```bash
cd cloudflare-worker
npx wrangler login          # abre o navegador pra autenticar
npx wrangler secret put GH_DISPATCH_TOKEN
npx wrangler deploy
```
