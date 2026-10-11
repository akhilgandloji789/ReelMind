"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "../../components/Header";
import { parseInstagramShare, ParsedShareResult } from "../../lib/shareParser";
import { addInboxItem, transcribeReelUrl } from "../../lib/api";
import { InboxItem } from "../../lib/types";
import {
  Inbox,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Share2,
  Film,
  ExternalLink,
} from "lucide-react";

function ShareTargetContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<"parsing" | "saved" | "duplicate" | "error">("parsing");
  const [parsed, setParsed] = useState<ParsedShareResult | null>(null);
  const [savedItem, setSavedItem] = useState<InboxItem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [manualUrl, setManualUrl] = useState("");

  useEffect(() => {
    const rawTitle = searchParams.get("title");
    const rawText = searchParams.get("text");
    const rawUrl = searchParams.get("url");

    const result = parseInstagramShare({
      title: rawTitle,
      text: rawText,
      url: rawUrl,
    });
    setParsed(result);

    if (!result.success || !result.extractedUrl) {
      setStatus("error");
      setErrorMessage(result.errorMessage || "No valid Instagram Reel detected.");
      return;
    }

    // Attempt to file into inbox
    const saveToInbox = async () => {
      try {
        const payload = {
          url: result.extractedUrl!,
          clean_url: result.cleanUrl || result.extractedUrl!,
          title: result.title || "Instagram Reel",
          shared_text: result.sharedText || "",
        };

        const res = await addInboxItem(payload);
        setSavedItem(res.item);

        // Also mirror to localStorage for offline access
        try {
          const cached = JSON.parse(localStorage.getItem("reelmind_inbox") || "[]");
          const exists = cached.some((it: any) => it.url === payload.url || it.clean_url === payload.clean_url);
          if (!exists) {
            cached.unshift(res.item);
            localStorage.setItem("reelmind_inbox", JSON.stringify(cached.slice(0, 50)));
          }
        } catch (e) {
          // ignore localstorage errors
        }

        if (res.is_duplicate) {
          setStatus("duplicate");
        } else {
          setStatus("saved");
        }
      } catch (err: any) {
        console.error("Failed to save to inbox:", err);
        // Fallback to local storage if network glitch
        const fallbackItem: InboxItem = {
          id: "local-" + Date.now(),
          url: result.extractedUrl!,
          clean_url: result.cleanUrl || result.extractedUrl!,
          title: result.title || "Instagram Reel",
          shared_text: result.sharedText || "",
          created_at: new Date().toISOString(),
          status: "saved",
        };
        try {
          const cached = JSON.parse(localStorage.getItem("reelmind_inbox") || "[]");
          cached.unshift(fallbackItem);
          localStorage.setItem("reelmind_inbox", JSON.stringify(cached.slice(0, 50)));
        } catch (e) {}

        setSavedItem(fallbackItem);
        setStatus("saved");
      }
    };

    saveToInbox();
  }, [searchParams]);

  const handleTranscribeNow = async () => {
    const targetUrl = savedItem?.url || parsed?.extractedUrl;
    if (!targetUrl) return;

    setIsTranscribing(true);
    try {
      const res = await transcribeReelUrl(targetUrl);
      // Navigate to homepage with active job ID in query so tracker activates
      router.push(`/?jobId=${res.job_id}`);
    } catch (err: any) {
      alert(`Transcription trigger failed: ${err.message}`);
      setIsTranscribing(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrl.trim()) return;
    const result = parseInstagramShare({ text: manualUrl });
    if (!result.success || !result.extractedUrl) {
      setErrorMessage(result.errorMessage || "Invalid Instagram Reel URL.");
      return;
    }
    setParsed(result);
    setErrorMessage(null);
    setStatus("parsing");

    addInboxItem({
      url: result.extractedUrl,
      clean_url: result.cleanUrl || result.extractedUrl,
      title: result.title,
      shared_text: result.sharedText,
    })
      .then((res) => {
        setSavedItem(res.item);
        setStatus(res.is_duplicate ? "duplicate" : "saved");
      })
      .catch(() => {
        setStatus("saved");
      });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      {/* Broadsheet Telegram Dispatch Header */}
      <div className="border-4 border-[#111111] bg-[#fcfbf9] p-6 sm:p-8 shadow-sm">
        <div className="border-b-2 border-[#111111] pb-4 mb-6 text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-wire uppercase font-bold tracking-widest text-[#555555]">
            <Share2 className="w-3.5 h-3.5" />
            <span>WIRE DESK TELEGRAPH • INCOMING DISPATCH</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-headline font-black uppercase tracking-tight text-[#111111] mt-2">
            {status === "parsing" && "INGESTING TELEGRAPH DISPATCH..."}
            {status === "saved" && "DISPATCH FILED TO WIRE INBOX"}
            {status === "duplicate" && "DISPATCH ALREADY ON RECORD"}
            {status === "error" && "DISPATCH REJECTED: INVALID REEL"}
          </h1>
          <p className="text-xs font-serif italic text-[#666666] mt-1">
            Android System Share Target Receiver • Official Ingestion Desk
          </p>
        </div>

        {/* Loading State */}
        {status === "parsing" && (
          <div className="py-12 text-center space-y-4">
            <div className="inline-block w-8 h-8 border-4 border-[#111111] border-t-transparent rounded-full animate-spin"></div>
            <p className="font-wire text-sm uppercase tracking-wider text-[#333333]">
              Verifying Instagram Reel Credentials &amp; Filing into Inbox...
            </p>
          </div>
        )}

        {/* Success or Duplicate State */}
        {(status === "saved" || status === "duplicate") && (
          <div className="space-y-6">
            <div className="border-2 border-[#111111] bg-white p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-[#111111] text-white rounded-none">
                    <Film className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-wire uppercase font-bold tracking-wider text-[#111111]">
                    INSTAGRAM REEL DISPATCH
                  </span>
                </div>
                <span className="border border-[#111111] px-2 py-0.5 text-[10px] font-wire uppercase font-bold bg-[#fbf9f4]">
                  {status === "saved" ? "NEWLY FILED" : "ALREADY IN INBOX"}
                </span>
              </div>

              <div>
                <h3 className="font-headline font-bold text-base sm:text-lg text-[#111111] line-clamp-2">
                  {savedItem?.title || parsed?.title || "Instagram Reel Dispatch"}
                </h3>
                <a
                  href={savedItem?.url || parsed?.extractedUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-mono text-[#444444] hover:text-[#111111] underline break-all mt-1"
                >
                  <span>{savedItem?.clean_url || parsed?.cleanUrl || savedItem?.url}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              </div>

              {parsed?.sharedText && !parsed.sharedText.startsWith("http") && (
                <div className="text-xs font-serif italic text-[#555555] bg-[#fbf9f4] p-2 border-l-2 border-[#111111]">
                  &ldquo;{parsed.sharedText}&rdquo;
                </div>
              )}
            </div>

            {/* Clear Separation Notice */}
            <div className="border-l-4 border-amber-600 bg-amber-50/70 p-3 sm:p-4 text-xs font-serif text-[#444444] space-y-1">
              <p className="font-bold text-[#111111] font-wire uppercase tracking-wider">
                NOTICE REGARDING AUDIO &amp; VIDEO EXTRACTION
              </p>
              <p>
                The Reel URL has been safely filed into your <strong>Wire Inbox</strong>. The video has <em>not</em> been
                downloaded yet, and acoustic AI analysis has <em>not</em> started. You may transcribe it now or keep it saved
                for later.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleTranscribeNow}
                disabled={isTranscribing}
                className="w-full py-3 px-4 bg-[#111111] text-white hover:bg-[#333333] transition-colors border-2 border-[#111111] text-xs font-wire uppercase font-bold tracking-wider flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isTranscribing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Starting Rotary Press...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Transcribe Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <Link
                href="/inbox"
                className="w-full py-3 px-4 bg-[#f6f4ee] hover:bg-[#eae6db] text-[#111111] transition-colors border-2 border-[#111111] text-xs font-wire uppercase font-bold tracking-wider flex items-center justify-center gap-2 text-center"
              >
                <Inbox className="w-4 h-4" />
                <span>View Wire Inbox</span>
              </Link>
            </div>

            <div className="text-center pt-2">
              <Link
                href="/"
                className="text-xs font-wire uppercase tracking-wider text-[#666666] hover:text-[#111111] underline"
              >
                ← Return to Front Page
              </Link>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === "error" && (
          <div className="space-y-6">
            <div className="border-2 border-red-700 bg-red-50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-red-800 font-wire font-bold uppercase text-xs tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                <span>UNSUPPORTED OR INVALID DISPATCH</span>
              </div>
              <p className="text-xs font-serif text-red-950">
                {errorMessage || "No valid Instagram Reel link was found in the share intent."}
              </p>
            </div>

            {/* Manual Fallback Input */}
            <form onSubmit={handleManualSubmit} className="space-y-3 pt-2">
              <label className="block text-xs font-wire uppercase font-bold tracking-wider text-[#111111]">
                Paste or Correct Instagram Reel URL:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  placeholder="https://www.instagram.com/reel/..."
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  className="flex-1 px-3 py-2 border-2 border-[#111111] bg-white text-xs font-mono text-[#111111] focus:outline-none"
                  required
                />
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#111111] text-white hover:bg-[#333333] border-2 border-[#111111] text-xs font-wire uppercase font-bold tracking-wider"
                >
                  File to Inbox
                </button>
              </div>
            </form>

            <div className="pt-4 border-t border-[#111111] text-center">
              <Link
                href="/"
                className="text-xs font-wire uppercase tracking-wider text-[#666666] hover:text-[#111111] underline"
              >
                ← Return to Front Page
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShareTargetPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f6f4ee] text-[#111111]">
      <Header />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="max-w-2xl mx-auto px-4 py-16 text-center">
              <div className="inline-block w-8 h-8 border-4 border-[#111111] border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 font-wire text-xs uppercase tracking-wider text-[#444444]">
                Loading Telegraph Dispatch...
              </p>
            </div>
          }
        >
          <ShareTargetContent />
        </Suspense>
      </main>
    </div>
  );
}
