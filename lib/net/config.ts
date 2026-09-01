/**
 * Whether the server is allowed to fetch URLs on a visitor's behalf.
 *
 * Self-hosting on your own machine, this should stay on: it is your server
 * fetching pages for you. A *public* deployment is a different proposition —
 * the endpoint will happily fetch any public URL for anyone who finds it,
 * which means strangers can spend your bandwidth and get your deployment's IP
 * blocked by sites that dislike the traffic. The SSRF guard stops the endpoint
 * reaching private networks; it cannot stop it being used as a general-purpose
 * proxy to the public internet.
 *
 * Set WDT_DISABLE_URL_FETCH=1 to turn it off. Both tools stay usable:
 * the Typography Analyzer keeps its paste mode, and the Responsive Tester
 * keeps its frames, since the iframes load in the visitor's own browser.
 */
export function isUrlFetchEnabled(): boolean {
  return !isTruthyFlag(process.env.WDT_DISABLE_URL_FETCH);
}

/** Reads a boolean-ish env var. Anything unset, empty, "0" or "false" is off. */
export function isTruthyFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== "" && normalized !== "0" && normalized !== "false";
}

export const URL_FETCH_DISABLED_MESSAGE =
  "URL fetching is turned off on this deployment. Paste the page source instead, " +
  "or run your own copy locally where it is enabled by default.";
