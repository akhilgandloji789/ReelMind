/**
 * WhatsApp Sharing Utilities for The ReelMind Chronicle
 * Allows 1-click sharing of Reel transcripts, recipes, and Sunday digests
 * directly from the user's personal WhatsApp account.
 */

export interface WhatsAppSharePayload {
  title?: string;
  reelUrl?: string;
  text: string;
  language?: string;
  duration?: number;
  viewMode?: "original" | "english" | "dual";
}

export function formatTranscriptForWhatsApp(payload: WhatsAppSharePayload): string {
  const lines: string[] = [];

  lines.push("🗞️ *THE REELMIND CHRONICLE • DISPATCH*");
  lines.push("═════════════════════════");

  if (payload.title && payload.title !== "Instagram Reel" && payload.title !== "Instagram Reel Dispatch") {
    lines.push(`📌 *${payload.title.trim()}*`);
  }

  if (payload.reelUrl) {
    lines.push(`📹 *Original Reel:* ${payload.reelUrl.trim()}`);
  }

  const metaParts: string[] = [];
  if (payload.duration && payload.duration > 0) {
    metaParts.push(`⏱️ ${payload.duration.toFixed(0)}s`);
  }
  if (payload.language) {
    metaParts.push(`🗣️ ${payload.language}`);
  }
  if (payload.viewMode === "english") {
    metaParts.push("🌐 English Wire Edition");
  } else if (payload.viewMode === "dual") {
    metaParts.push("📑 Dual Edition");
  }

  if (metaParts.length > 0) {
    lines.push(metaParts.join(" • "));
  }

  lines.push("═════════════════════════");
  lines.push("📝 *VERBATIM TRANSCRIPTION / RECIPE STEPS:*");
  lines.push("");

  // Clean and format text
  const cleanText = payload.text.trim();
  // WhatsApp maximum recommended message length is ~3500 chars to avoid truncation
  if (cleanText.length > 3200) {
    lines.push(cleanText.substring(0, 3200) + "...\n\n_(Read full dispatch on web)_");
  } else {
    lines.push(cleanText);
  }

  lines.push("");
  lines.push("═════════════════════════");
  lines.push("🗞️ *Printed by The ReelMind Chronicle*");
  lines.push("👉 https://reelmind-c0293.web.app");

  return lines.join("\n");
}

export function openWhatsAppShare(formattedText: string): void {
  if (typeof window === "undefined") return;

  const encoded = encodeURIComponent(formattedText);
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encoded}`;

  // Attempt window.open with fallback
  const opened = window.open(whatsappUrl, "_blank");
  if (!opened) {
    window.location.href = whatsappUrl;
  }
}
