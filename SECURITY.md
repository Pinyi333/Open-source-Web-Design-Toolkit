# Security Policy

## Reporting a vulnerability

Please report security issues privately through GitHub's
[private vulnerability reporting](https://github.com/Pinyi333/Open-source-Web-Design-Toolkit/security/advisories/new)
rather than opening a public issue.

This is a small project maintained in spare time. Expect an acknowledgement
within about a week. There is no bounty programme.

## Where the risk actually is

Almost all of this app runs in the browser and touches nothing but the input
you hand it. There is exactly one component with a meaningful attack surface:

### `POST /api/fetch-site`

This endpoint fetches a URL supplied by the user, on the server. Without care
that is a server-side request forgery hole — anyone who can reach a deployed
copy could use it to probe the network it runs on: cloud instance metadata at
`169.254.169.254`, internal admin panels on `10.x`, services on localhost.

The defences, all in `lib/net/`:

| Control | Where |
| --- | --- |
| http and https schemes only | `parseTargetUrl` |
| Private, loopback, link-local, CGNAT, multicast and reserved ranges blocked, IPv4 and IPv6, including IPv4-mapped IPv6 | `isBlockedAddress` |
| Reserved hostnames (`localhost`, `*.internal`, cloud metadata names) blocked | `isBlockedHostname` |
| Address checked **after DNS resolution**, not just on the literal string | `assertHostAllowed` |
| Redirects followed manually, 3 hops max, **re-validated on every hop** | `safeFetch` |
| 8s per request, 12s total, via `AbortSignal` | `LIMITS` |
| 2 MB HTML, 1 MB per stylesheet, 10 stylesheets max | `readCapped`, `LIMITS` |
| Content-type must be HTML | `fetchSite` |
| Internal errors are logged, never returned to the client | the route handler |

These are covered by table-driven tests in `tests/url-guard.test.ts`. If you
add a bypass technique we do not handle, a failing test case is the most useful
possible bug report.

**Deploying publicly.** The guard stops this endpoint reaching private
networks; it does not stop it being used as a general-purpose proxy to the
public internet. On a deployment anyone can reach, set
`WDT_DISABLE_URL_FETCH=1`. The flag is read per request, so it takes effect
without a rebuild, and both tools degrade rather than break — see the README.

**Known limitation.** The per-IP rate limit lives in process memory. It resets
on redeploy and is per-instance, so it does nothing on a horizontally scaled
deployment. It exists to stop one person hammering a self-hosted copy, not as a
security boundary. If you deploy this publicly, put a real rate limiter in
front of it.

## What this app does not do

Worth stating plainly, because it rules out whole categories of issue:

- **No accounts, no sessions, no cookies.** There is nothing to steal.
- **No database and no server-side storage.** Nothing is persisted anywhere.
- **No analytics or telemetry.** No third-party scripts run on the page.
- **Images are never uploaded.** The Color Extractor decodes files into a
  canvas in your browser; the bytes never reach a server.
- **Google Fonts are loaded only on request.** The Typography Analyzer fetches
  a font stylesheet only when you click "preview this font", so the default
  path makes no third-party request.

## Supported versions

This project is pre-1.0. Fixes land on `main`; there are no backports.
