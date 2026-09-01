import { afterEach, describe, expect, it } from "vitest";

import {
  BlockedUrlError,
  isBlockedAddress,
  isBlockedHostname,
  parseTargetUrl,
} from "@/lib/net/url-guard";
import { extractStyleRefs, readEmbeddingPolicy } from "@/lib/net/fetch-site";
import { isTruthyFlag, isUrlFetchEnabled } from "@/lib/net/config";

describe("parseTargetUrl", () => {
  it("assumes https for a bare hostname", () => {
    expect(parseTargetUrl("example.com").toString()).toBe("https://example.com/");
  });

  it("keeps an explicit protocol, path and query", () => {
    const url = parseTargetUrl("http://example.com/a?b=1");
    expect(url.protocol).toBe("http:");
    expect(url.pathname).toBe("/a");
    expect(url.search).toBe("?b=1");
  });

  it.each([
    ["javascript:alert(1)", "javascript"],
    ["file:///etc/passwd", "file"],
    ["data:text/html,<script>", "data"],
    ["ftp://example.com", "ftp"],
    ["gopher://example.com:70/_", "gopher"],
  ])("rejects %s", (input) => {
    expect(() => parseTargetUrl(input)).toThrow(BlockedUrlError);
  });

  it("rejects empty input", () => {
    expect(() => parseTargetUrl("   ")).toThrow(BlockedUrlError);
  });

  it("reads host:port as a host and a port, not as a scheme", () => {
    // new URL("localhost:3100") would otherwise parse "localhost:" as the
    // scheme, rejecting the most common input a responsive tester gets.
    const url = parseTargetUrl("localhost:3100");
    expect(url.hostname).toBe("localhost");
    expect(url.port).toBe("3100");
    expect(url.protocol).toBe("http:");

    const withPath = parseTargetUrl("example.com:8080/dashboard");
    expect(withPath.hostname).toBe("example.com");
    expect(withPath.port).toBe("8080");
    expect(withPath.protocol).toBe("https:");
  });

  it("defaults local hosts to http and everything else to https", () => {
    expect(parseTargetUrl("localhost").protocol).toBe("http:");
    expect(parseTargetUrl("127.0.0.1:8080").protocol).toBe("http:");
    expect(parseTargetUrl("example.com").protocol).toBe("https:");
  });

  it("still rejects a scheme it does not support when a port follows", () => {
    expect(() => parseTargetUrl("ftp://example.com:21")).toThrow(BlockedUrlError);
  });
});

describe("isBlockedAddress — IPv4", () => {
  it.each([
    ["127.0.0.1", "loopback"],
    ["127.1.2.3", "loopback"],
    ["0.0.0.0", "unspecified"],
    ["10.0.0.1", "private network"],
    ["10.255.255.255", "private network"],
    ["172.16.0.1", "private network"],
    ["172.31.255.254", "private network"],
    ["192.168.1.1", "private network"],
    ["169.254.169.254", "link-local / cloud metadata"],
    ["100.64.0.1", "carrier-grade NAT"],
    ["224.0.0.1", "multicast"],
    ["255.255.255.255", "reserved"],
    ["198.18.0.1", "benchmarking range"],
  ])("blocks %s", (address, reason) => {
    const result = isBlockedAddress(address);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe(reason);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "93.184.216.34",
    "172.32.0.1",
    "172.15.255.255",
    "11.0.0.1",
    "100.128.0.1",
  ])("allows the public address %s", (address) => {
    expect(isBlockedAddress(address).blocked).toBe(false);
  });

  it("blocks addresses it cannot parse", () => {
    expect(isBlockedAddress("not-an-ip").blocked).toBe(true);
    expect(isBlockedAddress("999.1.1.1").blocked).toBe(true);
    expect(isBlockedAddress("").blocked).toBe(true);
  });
});

describe("isBlockedAddress — IPv6", () => {
  it.each([
    ["::1", "loopback"],
    ["::", "unspecified"],
    ["fe80::1", "link-local"],
    ["fd00::1", "unique local address"],
    ["fc00::abcd", "unique local address"],
    ["ff02::1", "multicast"],
    ["2001:db8::1", "documentation range"],
    ["64:ff9b::1", "NAT64 translation range"],
    ["::7f00:1", "IPv4-compatible range"],
    ["::127.0.0.1", "IPv4-compatible range"],
    ["2001::1", "Teredo tunneling range"],
    ["2002:7f00:1::1", "6to4 embedding loopback"],
    ["2002:a9fe:a9fe::1", "6to4 embedding link-local / cloud metadata"],
  ])("blocks %s", (address, reason) => {
    const result = isBlockedAddress(address);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe(reason);
  });

  it("sees through IPv4-mapped addresses", () => {
    expect(isBlockedAddress("::ffff:127.0.0.1")).toEqual({
      blocked: true,
      reason: "loopback",
    });
    expect(isBlockedAddress("::ffff:169.254.169.254").blocked).toBe(true);
    expect(isBlockedAddress("::ffff:8.8.8.8").blocked).toBe(false);
  });

  it("allows public IPv6", () => {
    expect(isBlockedAddress("2606:4700:4700::1111").blocked).toBe(false);
    expect(isBlockedAddress("2a00:1450:4009:80f::200e").blocked).toBe(false);
    // 6to4 wrapping a public IPv4 address stays reachable.
    expect(isBlockedAddress("2002:801:801::1").blocked).toBe(false);
  });

  it("ignores a zone index and brackets", () => {
    expect(isBlockedAddress("fe80::1%eth0").blocked).toBe(true);
    expect(isBlockedAddress("[::1]").blocked).toBe(true);
  });
});

describe("isBlockedHostname", () => {
  it.each([
    "localhost",
    "LOCALHOST",
    "localhost.",
    "app.localhost",
    "printer.local",
    "metadata.google.internal",
    "db.internal",
    "instance-data",
  ])("blocks the reserved hostname %s", (hostname) => {
    expect(isBlockedHostname(hostname).blocked).toBe(true);
  });

  it("checks literal IP hostnames without a DNS lookup", () => {
    expect(isBlockedHostname("127.0.0.1").blocked).toBe(true);
    expect(isBlockedHostname("169.254.169.254").blocked).toBe(true);
    expect(isBlockedHostname("[::1]").blocked).toBe(true);
    expect(isBlockedHostname("8.8.8.8").blocked).toBe(false);
  });

  it("allows ordinary hostnames", () => {
    expect(isBlockedHostname("example.com").blocked).toBe(false);
    expect(isBlockedHostname("www.github.com").blocked).toBe(false);
  });
});

describe("readEmbeddingPolicy", () => {
  const policy = (headers: Record<string, string>) =>
    readEmbeddingPolicy(new Headers(headers));

  it("treats a site with no framing headers as embeddable", () => {
    expect(policy({}).embeddable).toBe(true);
  });

  it("respects X-Frame-Options", () => {
    expect(policy({ "x-frame-options": "DENY" }).embeddable).toBe(false);
    expect(policy({ "x-frame-options": "sameorigin" }).embeddable).toBe(false);
  });

  it("respects CSP frame-ancestors", () => {
    expect(
      policy({ "content-security-policy": "frame-ancestors 'none'" }).embeddable,
    ).toBe(false);
    expect(
      policy({ "content-security-policy": "default-src 'self'; frame-ancestors 'self'" })
        .embeddable,
    ).toBe(false);
    expect(
      policy({ "content-security-policy": "frame-ancestors *" }).embeddable,
    ).toBe(true);
  });

  it("explains why a site cannot be framed", () => {
    expect(policy({ "x-frame-options": "DENY" }).reason).toMatch(/DENY/);
  });

  it("reports the raw header values", () => {
    const result = policy({
      "x-frame-options": "SAMEORIGIN",
      "content-security-policy": "frame-ancestors 'self' https://ok.example",
    });
    expect(result.xFrameOptions).toBe("SAMEORIGIN");
    expect(result.frameAncestors).toBe("'self' https://ok.example");
  });
});

describe("extractStyleRefs", () => {
  const base = new URL("https://example.com/page/");

  it("finds inline style blocks", () => {
    const { inline } = extractStyleRefs(
      "<style>body { color: red }</style><style></style>",
      base,
    );
    expect(inline).toEqual(["body { color: red }"]);
  });

  it("resolves stylesheet links against the page URL", () => {
    const { links } = extractStyleRefs(
      `<link rel="stylesheet" href="a.css">
       <link rel="stylesheet" href="/b.css">
       <link rel="stylesheet" href="https://cdn.example/c.css">`,
      base,
    );
    expect(links).toEqual([
      "https://example.com/page/a.css",
      "https://example.com/b.css",
      "https://cdn.example/c.css",
    ]);
  });

  it("ignores links that are not stylesheets", () => {
    const { links } = extractStyleRefs(
      '<link rel="icon" href="favicon.ico"><link rel="preconnect" href="https://x.example">',
      base,
    );
    expect(links).toEqual([]);
  });

  it("handles unquoted and single-quoted hrefs", () => {
    const { links } = extractStyleRefs(
      "<link rel=stylesheet href=a.css><link rel='stylesheet' href='b.css'>",
      base,
    );
    expect(links).toHaveLength(2);
  });

  it("skips non-http stylesheet URLs", () => {
    const { links } = extractStyleRefs(
      '<link rel="stylesheet" href="data:text/css,body{}">',
      base,
    );
    expect(links).toEqual([]);
  });
});

describe("URL fetch feature flag", () => {
  const original = process.env.WDT_DISABLE_URL_FETCH;
  afterEach(() => {
    if (original === undefined) delete process.env.WDT_DISABLE_URL_FETCH;
    else process.env.WDT_DISABLE_URL_FETCH = original;
  });

  it("is on by default, so self-hosting needs no configuration", () => {
    delete process.env.WDT_DISABLE_URL_FETCH;
    expect(isUrlFetchEnabled()).toBe(true);
  });

  it.each(["1", "true", "TRUE", "yes", " 1 "])(
    "is off when the flag is set to %j",
    (value) => {
      process.env.WDT_DISABLE_URL_FETCH = value;
      expect(isUrlFetchEnabled()).toBe(false);
    },
  );

  it.each(["", "0", "false", "FALSE"])(
    "stays on for the falsy value %j",
    (value) => {
      process.env.WDT_DISABLE_URL_FETCH = value;
      expect(isUrlFetchEnabled()).toBe(true);
    },
  );

  it("treats an unset variable as false", () => {
    expect(isTruthyFlag(undefined)).toBe(false);
  });
});
