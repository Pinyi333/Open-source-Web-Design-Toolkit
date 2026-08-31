/**
 * Guards for the one server-side feature in this toolkit: fetching a URL the
 * user typed in.
 *
 * A naive "fetch whatever the user asked for" endpoint is a server-side
 * request forgery (SSRF) hole. Anyone who can reach a deployed copy of this
 * app could use it as a proxy into the network it runs on: cloud instance
 * metadata at 169.254.169.254, admin panels on 10.x, databases on localhost.
 *
 * The defence is in two halves, and both are needed:
 *
 *  1. `parseTargetUrl` rejects anything that is not plain http(s).
 *  2. `isBlockedAddress` rejects private address space *after* DNS resolution,
 *     and is re-run on every redirect hop, because a hostname that resolved
 *     publicly a moment ago can resolve to 127.0.0.1 on the next lookup
 *     (DNS rebinding) and a public URL can 302 straight into the private
 *     network.
 */

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Normalizes user input into a URL we are willing to fetch.
 * Bare hostnames like `example.com` get an `https://` prefix, which is what
 * someone typing into an address bar expects.
 */
export function parseTargetUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new BlockedUrlError("Enter a URL to analyze.");
  }

  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new BlockedUrlError(`"${input}" is not a valid URL.`);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new BlockedUrlError(
      `Only http and https URLs can be fetched (got "${url.protocol}").`,
    );
  }

  if (!url.hostname) {
    throw new BlockedUrlError("That URL has no hostname.");
  }

  return url;
}

function ipv4ToInt(parts: number[]): number {
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }

  return octets;
}

/** CIDR blocks that must never be reachable through this app. */
const BLOCKED_V4_RANGES: { cidr: string; reason: string }[] = [
  { cidr: "0.0.0.0/8", reason: "unspecified" },
  { cidr: "10.0.0.0/8", reason: "private network" },
  { cidr: "100.64.0.0/10", reason: "carrier-grade NAT" },
  { cidr: "127.0.0.0/8", reason: "loopback" },
  { cidr: "169.254.0.0/16", reason: "link-local / cloud metadata" },
  { cidr: "172.16.0.0/12", reason: "private network" },
  { cidr: "192.0.0.0/24", reason: "IETF protocol assignments" },
  { cidr: "192.0.2.0/24", reason: "documentation range" },
  { cidr: "192.168.0.0/16", reason: "private network" },
  { cidr: "198.18.0.0/15", reason: "benchmarking range" },
  { cidr: "198.51.100.0/24", reason: "documentation range" },
  { cidr: "203.0.113.0/24", reason: "documentation range" },
  { cidr: "224.0.0.0/4", reason: "multicast" },
  { cidr: "240.0.0.0/4", reason: "reserved" },
];

const PARSED_V4_RANGES = BLOCKED_V4_RANGES.map(({ cidr, reason }) => {
  const [base, bits] = cidr.split("/");
  const octets = parseIpv4(base);
  if (!octets) throw new Error(`Bad CIDR in blocklist: ${cidr}`);
  const prefix = Number(bits);
  // A /0 mask would shift by 32, which is a no-op in JS; none of our ranges
  // are /0, but guard anyway so a future edit cannot silently allow everything.
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { network: ((ipv4ToInt(octets) & mask) >>> 0), mask, reason };
});

/**
 * Expands an IPv6 address into its eight 16-bit groups, or `null` if it does
 * not parse. Handles `::` compression and IPv4-mapped tails.
 */
function parseIpv6(address: string): number[] | null {
  let value = address.trim().toLowerCase();
  if (value.startsWith("[") && value.endsWith("]")) {
    value = value.slice(1, -1);
  }
  // Drop any zone index, e.g. fe80::1%eth0.
  value = value.split("%")[0];
  if (!value.includes(":")) return null;

  // Rewrite an IPv4 tail (::ffff:127.0.0.1) into two hex groups
  // (::ffff:7f00:1) so the rest of this function never has to think about it.
  const lastColon = value.lastIndexOf(":");
  const maybeV4 = value.slice(lastColon + 1);
  if (maybeV4.includes(".")) {
    const octets = parseIpv4(maybeV4);
    if (!octets) return null;
    const hi = ((octets[0] << 8) | octets[1]).toString(16);
    const lo = ((octets[2] << 8) | octets[3]).toString(16);
    value = `${value.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const halves = value.split("::");
  if (halves.length > 2) return null;

  const toGroups = (part: string): number[] | null => {
    if (part === "") return [];
    const groups: number[] = [];
    for (const chunk of part.split(":")) {
      if (!/^[0-9a-f]{1,4}$/.test(chunk)) return null;
      groups.push(parseInt(chunk, 16));
    }
    return groups;
  };

  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : null;
  if (!head || (halves.length === 2 && !rest)) return null;

  let groups: number[];
  if (halves.length === 2) {
    const fill = 8 - (head.length + rest!.length);
    if (fill < 0) return null;
    groups = [...head, ...Array(fill).fill(0), ...rest!];
  } else {
    groups = head;
  }

  return groups.length === 8 ? groups : null;
}

export interface BlockResult {
  blocked: boolean;
  reason?: string;
}

/**
 * Decides whether a resolved IP address is safe to connect to.
 * Anything unparseable is blocked: an address we cannot reason about is not
 * an address we should be dialling.
 */
export function isBlockedAddress(address: string): BlockResult {
  const v4 = parseIpv4(address);
  if (v4) {
    const value = ipv4ToInt(v4);
    for (const range of PARSED_V4_RANGES) {
      if ((value & range.mask) >>> 0 === range.network) {
        return { blocked: true, reason: range.reason };
      }
    }
    return { blocked: false };
  }

  const v6 = parseIpv6(address);
  if (v6) {
    const [g0, g1] = v6;
    const isZero = v6.every((group) => group === 0);
    if (isZero) return { blocked: true, reason: "unspecified" };
    if (v6.slice(0, 7).every((g) => g === 0) && v6[7] === 1) {
      return { blocked: true, reason: "loopback" };
    }
    // ::ffff:a.b.c.d — an IPv4 address wearing an IPv6 coat.
    if (v6.slice(0, 5).every((g) => g === 0) && g0 === 0 && v6[5] === 0xffff) {
      const mapped = [v6[6] >> 8, v6[6] & 0xff, v6[7] >> 8, v6[7] & 0xff].join(".");
      return isBlockedAddress(mapped);
    }
    // fc00::/7 unique local, fe80::/10 link-local.
    if ((g0 & 0xfe00) === 0xfc00) {
      return { blocked: true, reason: "unique local address" };
    }
    if ((g0 & 0xffc0) === 0xfe80) {
      return { blocked: true, reason: "link-local" };
    }
    if ((g0 & 0xff00) === 0xff00) {
      return { blocked: true, reason: "multicast" };
    }
    // 2001:db8::/32 documentation, 64:ff9b::/96 NAT64 into IPv4 space.
    if (g0 === 0x2001 && g1 === 0x0db8) {
      return { blocked: true, reason: "documentation range" };
    }
    if (g0 === 0x0064 && g1 === 0xff9b) {
      return { blocked: true, reason: "NAT64 translation range" };
    }
    return { blocked: false };
  }

  return { blocked: true, reason: "unrecognized address" };
}

/**
 * Blocks hostnames that resolve to the local machine by convention rather than
 * by address. DNS would usually catch these, but a `/etc/hosts` entry or a
 * split-horizon resolver can point them anywhere, and there is no legitimate
 * reason for the server to fetch them.
 */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

export function isBlockedHostname(hostname: string): BlockResult {
  const host = hostname.toLowerCase().replace(/\.$/, "");

  if (BLOCKED_HOSTNAMES.has(host)) {
    return { blocked: true, reason: "reserved hostname" };
  }
  if (host.endsWith(".localhost") || host.endsWith(".local")) {
    return { blocked: true, reason: "reserved hostname" };
  }
  if (host.endsWith(".internal")) {
    return { blocked: true, reason: "internal hostname" };
  }

  // A hostname that is already a literal IP never reaches DNS, so check it here.
  const literal = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (parseIpv4(literal) || literal.includes(":")) {
    return isBlockedAddress(literal);
  }

  return { blocked: false };
}
