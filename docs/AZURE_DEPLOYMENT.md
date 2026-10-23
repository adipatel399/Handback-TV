# Private Azure preview

Deployed 23 October 2026 with the builder's authorization to use Azure Student credits, including more than US$30 if needed. This preview runs independently of the development laptop.

- Live journeys: <https://handback-tv-cb7fb9.koreacentral.cloudapp.azure.com/tv/journeys>
- Helper: <https://handback-tv-cb7fb9.koreacentral.cloudapp.azure.com/helper>
- Fictional booking lab: <https://handback-tv-cb7fb9.koreacentral.cloudapp.azure.com/tv>

All three require the private preview password. The builder's local `.tools/azure/ACCESS.md` contains it and is excluded from the review archive. Share reviewer access privately. No password is embedded in source, screenshots, reports, video, or APKs.

## Runtime

| Component | Configuration |
|---|---|
| Resource group | `handback-hackathon` (dedicated to this project) |
| Region | Korea Central, an allowed region on this Student subscription |
| VM | `handback-tv`, Standard_B2als_v2, 2 vCPU, 4 GB RAM |
| OS | Ubuntu 24.04 LTS, 32 GB Standard SSD OS disk |
| Runtime | Docker Compose, Node 24, Chromium headless shell, Linux eSpeak NG |
| HTTPS | Caddy with a valid publicly trusted certificate; Azure public DNS |
| Network | Public TCP 80/443 only; SSH closed; app port 4310 has no host publication |
| Persistence | `/opt/handback/data`, on the VM's persistent block disk |
| Management | Azure VM Run Command; no public SSH or container registry required |

The app runs as the non-root `node` user. Runtime source was uploaded directly to this VM, excluding private local databases, SDKs, and review media. The reference provider retains its separate SQLite database. SQLite WAL remains on local block storage rather than a network filesystem. Caddy certificate state and application data survive container rebuilds. This is a single VM; there is no high-availability promise, automatic scaling, or off-VM backup.

## Private shared-preview access

A randomly generated password establishes a signed eight-hour Secure, HttpOnly, SameSite=Strict cookie over HTTPS. Anonymous requests cannot fetch helper tokens, route history, or provider booking history. Same-origin form submissions and bounded failed login attempts protect sign-in. Login grants shared owner/reviewer access, including helper controls; this is not separate per-person account authorization.

After sign-in, TV previews receive the household TV token automatically. A fresh cloud installation needs no laptop pairing code. The existing one-use pairing flow remains available for local operation. Do not generate a new pairing code during a concurrent reviewer session, because pairing a new client replaces the household TV token.

Use only public stations and fictional passenger details. Saved routes, reference bookings, and opted-in observation records are stored on the Azure VM and shared by invited reviewers. They are no longer confined to the builder's laptop. The observation tool collects no names or audio; a builder self-test is still not a target-user study.

Speech prefers an installed offline Android voice. The Linux fallback generates short WAV files locally with eSpeak NG; Android MediaPlayer sends the private session cookie to fetch them over HTTPS. No paid AI, hosted browser, or speech API is used.

## Android cloud build

`artifacts/handback-tv-cloud-debug.apk` defaults to this HTTPS preview. Its application ID is `com.handback.tv.cloud` and its label is **Handback TV Preview**, so it can coexist with the local debug APK. Both are development builds, not Appstore releases.

To reproduce from this workspace:

```bash
HANDBACK_APP_ORIGIN=https://handback-tv-cb7fb9.koreacentral.cloudapp.azure.com npm run android:build
cp artifacts/handback-tv-debug.apk artifacts/handback-tv-cloud-debug.apk
# Restore the default laptop APK afterwards:
npm run android:build
```

The cloud APK requires the private password once per eight-hour browser session. A hardware-free Android TV emulator remains the tested platform; physical Fire TV/Vega behavior is unverified.

## Credits and lifecycle

The Student subscription's **spending limit remains On**; it was not converted to pay-as-you-go. Existing unrelated Azure resources were not modified.

The Azure retail API returned **US$0.0468 per VM-hour** for this Linux size in Korea Central on 23 October 2026. At that rate, 28 days is about **US$31.45 compute**, plus the disk, public IP, and any applicable traffic charges. A planning estimate is roughly **US$37–45 total** through 20 November, not a guaranteed cap or invoice quote. Current credit balance, other resources, regional pricing, and traffic affect availability; deployment does not guarantee that credits last through judging. Check Azure Cost Management and the Student credit balance. No paid inference or per-request browser vendor is involved.

The VM stays running until the builder stops it or credits/subscription availability change. No scheduled cleanup was created. Deallocation stops VM compute billing but leaves disk/IP charges. After judging, export any wanted test data first, then delete only the dedicated project resource group:

```bash
az group delete --name handback-hackathon --yes --no-wait
```

This deletes the hosted preview and its stored data. It has **not** been run.

## Updates and verification

`deploy/azure/` contains the Compose, proxy, and cloud-init templates; `Dockerfile` builds the runtime. The current builder-specific upload helper reads ignored private provisioning state; it is not an account-portable provisioning wizard. It never initializes Git or publishes a source repository.

`npx tsx scripts/verify-azure.ts` checks actual HTTPS login, anonymous access restrictions, real TfL data, Linux speech, saved routes, and browser-driven reference receipt verification. `npx tsx scripts/verify-azure-emulator.ts` checks the installed cloud APK on the Android TV emulator. Both read the ignored local state file without printing its password. Reports are in `artifacts/`; these are automated functional results, not human usability findings.

Sources: [Azure for Students offer](https://azure.microsoft.com/en-us/pricing/offers/ms-azr-0170p), [Azure public IP DNS](https://learn.microsoft.com/en-us/azure/virtual-network/ip-services/public-ip-addresses/), [Azure retail pricing API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices), [SQLite WAL constraints](https://www.sqlite.org/wal.html).
