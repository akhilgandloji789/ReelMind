/**
 * Robust extraction and validation of Instagram Reel URLs from Android Share Sheet payloads.
 */

export interface ParsedShareResult {
  success: boolean;
  extractedUrl: string | null;
  cleanUrl: string | null;
  title: string;
  sharedText: string;
  errorMessage?: string;
}

// Regex matching Instagram Reel, Post (video), or Share links
const IG_URL_PATTERN =
  /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/(?:reel|p|share\/reel|reels)\/([A-Za-z0-9_-]+)(?:\/[^\s]*)?/i;

// Broader check for Instagram domain
const IG_DOMAIN_PATTERN = /^(?:[a-zA-Z0-9-]+\.)*(?:instagram\.com|instagr\.am)$/i;

export function parseInstagramShare(payload: {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}): ParsedShareResult {
  const rawTitle = (payload.title || "").trim();
  const rawText = (payload.text || "").trim();
  const rawUrl = (payload.url || "").trim();

  // Combine candidates in prioritized order: explicit url -> text -> title
  const candidates = [rawUrl, rawText, rawTitle].filter(Boolean);

  let foundUrl: string | null = null;
  let reelId: string | null = null;

  for (const candidate of candidates) {
    const match = candidate.match(IG_URL_PATTERN);
    if (match) {
      foundUrl = match[0].trim();
      reelId = match[1];
      break;
    }
  }

  // If no direct regex match, test if candidate starts with http and has an instagram domain
  if (!foundUrl) {
    for (const candidate of candidates) {
      try {
        const words = candidate.split(/\s+/);
        for (const w of words) {
          if (w.startsWith("http://") || w.startsWith("https://")) {
            const parsed = new URL(w);
            if (IG_DOMAIN_PATTERN.test(parsed.hostname)) {
              foundUrl = w;
              const pathParts = parsed.pathname.split("/").filter(Boolean);
              if (pathParts.length >= 2 && ["reel", "p", "reels"].includes(pathParts[0])) {
                reelId = pathParts[1];
              }
              break;
            }
          }
        }
      } catch {
        // Not a URL
      }
      if (foundUrl) break;
    }
  }

  // If still no valid Instagram URL found, check if a non-Instagram URL was passed
  if (!foundUrl) {
    for (const candidate of candidates) {
      const anyHttp = candidate.match(/https?:\/\/[^\s]+/i);
      if (anyHttp) {
        return {
          success: false,
          extractedUrl: null,
          cleanUrl: null,
          title: rawTitle,
          sharedText: rawText,
          errorMessage: `The shared link (${anyHttp[0]}) is not from Instagram. ReelMind only ingests official Instagram Reel URLs.`,
        };
      }
    }

    return {
      success: false,
      extractedUrl: null,
      cleanUrl: null,
      title: rawTitle,
      sharedText: rawText,
      errorMessage:
        "No Instagram Reel link was found in the shared dispatch. Please ensure you share directly from a public Instagram Reel.",
    };
  }

  // Clean and normalize URL (remove tracking noise like ?stkn= or ?igsh= for canonical representation)
  let cleanUrl = foundUrl;
  try {
    const parsed = new URL(foundUrl);
    // Standardize to https://www.instagram.com/reel/<id>/
    if (reelId) {
      cleanUrl = `https://www.instagram.com/reel/${reelId}/`;
    } else {
      // Remove common share-tracking query parameters while preserving necessary ones
      const cleanedSearchParams = new URLSearchParams();
      for (const [key, val] of parsed.searchParams.entries()) {
        if (!["igsh", "utm_source", "utm_medium", "utm_campaign", "stkn"].includes(key)) {
          cleanedSearchParams.append(key, val);
        }
      }
      const qs = cleanedSearchParams.toString();
      cleanUrl = `${parsed.origin}${parsed.pathname}${qs ? "?" + qs : ""}`;
    }
  } catch {
    cleanUrl = foundUrl;
  }

  const displayTitle = rawTitle || (rawText && !rawText.startsWith("http") ? rawText.slice(0, 80) : "Instagram Reel");

  return {
    success: true,
    extractedUrl: foundUrl,
    cleanUrl,
    title: displayTitle,
    sharedText: rawText,
  };
}
