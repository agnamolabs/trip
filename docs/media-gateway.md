# Media gateway: media.trip.luxnet.cc

One public door for the kae runtime. The Worker (`trip-media`, source in
`/opt/data/work/trip-media`) authenticates callers, hides the gateway key, and
forwards to the gateway nginx on kae.

## Topology

```
app (trip.agnamo.com)
  └─ SEARX_URL=https://trip-media.agnamo.workers.dev/searx   (x-media-key)
       └─ trip-media Worker
            └─ GATEWAY_URL=<quick tunnel>  (x-gateway-key)
                 └─ kae nginx :8099
                      ├─ /searx/     -> searxng :8080
                      ├─ /maps/      -> maps.mjs :8091 (Photon geocode, OSRM route)
                      ├─ /firecrawl/ -> api.firecrawl.dev (key injected here)
                      ├─ /apify/     -> api.apify.com (no token yet -> upstream 401)
                      └─ /n8n/       -> n8n :5678 (host network)
```

## Auth

- Callers present `x-media-key: <MEDIA_KEY>` to the Worker.
- The Worker swaps it for `x-gateway-key: <GATEWAY_KEY>`; anything else gets 401.
- The gateway nginx accepts either that header (`map $http_x_gateway_key`) or
  basic auth (`trip:<password>` in `/opt/searx-nginx/.htpasswd`), so the n8n
  editor still opens in a browser over the tailnet.
- Keys live in `/opt/data/.config/trip/` on the Hermes box: `media_key.txt`,
  `gateway_key.txt`, `searx_pass.txt`.

## Ingestion

n8n runs in Docker on kae (`--network host`, sqlite in `/opt/n8n`), workflow
`trip ingest: searx -> firecrawl -> trip`. Published webhook:

```
POST https://trip-media.agnamo.workers.dev/n8n/webhook/trip-ingest
     x-media-key: <MEDIA_KEY>
     {"query": "best poke honolulu"}
```

It searches SearXNG, scrapes up to six results through the gateway's Firecrawl
route, and returns normalised `{title,url,markdown}`. The scrape node is
`onError: continueRegularOutput` because Firecrawl refuses some sites with
"We do not support this site" — refusals are skipped, not fatal.

## Known gap

`media.trip.luxnet.cc` has a Worker route attached
(`media.trip.luxnet.cc/*` -> `trip-media`, route id `59b459fb3553435bbc117c4f221a755d`)
but **no DNS record**, because the API token lacks DNS:Edit and Workers Custom
Domains:Edit (`Authentication error` / `Method not allowed for this
authentication scheme`). Create one proxied record (`AAAA 100::` or a CNAME to
`trip-media.agnamo.workers.dev`) — or bind the Custom Domain in the dashboard —
and the hostname goes live with no further change.

The upstream tunnel is a cloudflared quick tunnel, so its hostname changes if
that container restarts; when it does, update `GATEWAY_URL` on `trip-media`
(`wrangler deploy` from `/opt/data/work/trip-media`).
