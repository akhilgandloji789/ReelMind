"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "../../components/Header";
import {
  fetchInboxItems,
  deleteInboxItem,
  transcribeInboxItem,
  addInboxItem,
} from "../../lib/api";
import { InboxItem } from "../../lib/types";
import { parseInstagramShare } from "../../lib/shareParser";
import {
  Inbox,
  Sparkles,
  Trash2,
  ExternalLink,
  Film,
  Plus,
  RotateCcw,
  CheckCircle2,
  Clock,
  ArrowRight,
  Share2,
} from "lucide-react";
import { formatTranscriptForWhatsApp, openWhatsAppShare } from "../../lib/whatsapp";

export default function InboxPage() {
  const router = useRouter();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchInboxItems();
      if (data && data.length > 0) {
        setItems(data);
      } else {
        // Fallback to local storage
        try {
          const cached = JSON.parse(localStorage.getItem("reelmind_inbox") || "[]");
          setItems(cached);
        } catch {
          setItems([]);
        }
      }
    } catch {
      try {
        const cached = JSON.parse(localStorage.getItem("reelmind_inbox") || "[]");
        setItems(cached);
      } catch {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleTranscribe = async (item: InboxItem) => {
    setActionLoadingId(item.id);
    try {
      const res = await transcribeInboxItem(item.id);
      // Navigate to home page with active job
      router.push(`/?jobId=${res.job_id}`);
    } catch (err: any) {
      alert(`Could not start transcription: ${err.message}`);
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (item: InboxItem) => {
    if (!confirm("Are you sure you want to remove this dispatch from your inbox?")) return;
    try {
      await deleteInboxItem(item.id);
      setItems((prev) => prev.filter((it) => it.id !== item.id));

      // Also clean up local storage
      try {
        const cached = JSON.parse(localStorage.getItem("reelmind_inbox") || "[]");
        const filtered = cached.filter((it: any) => it.id !== item.id && it.url !== item.url);
        localStorage.setItem("reelmind_inbox", JSON.stringify(filtered));
      } catch {}
    } catch (err: any) {
      alert(`Could not remove item: ${err.message}`);
    }
  };

  const handleShareToWhatsApp = (item: InboxItem) => {
    const formatted = formatTranscriptForWhatsApp({
      title: item.title || "Instagram Reel Dispatch",
      reelUrl: item.clean_url || item.url,
      text: item.shared_text || "Filed in ReelMind Wire Inbox for verbatim audio transcription.",
    });
    openWhatsAppShare(formatted);
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    const parsed = parseInstagramShare({ text: newUrl });
    if (!parsed.success || !parsed.extractedUrl) {
      alert(parsed.errorMessage || "Please enter a valid Instagram Reel link.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addInboxItem({
        url: parsed.extractedUrl,
        clean_url: parsed.cleanUrl || parsed.extractedUrl,
        title: parsed.title,
        shared_text: parsed.sharedText,
      });

      if (res.is_duplicate) {
        alert("This Reel link is already filed in your Wire Inbox.");
      } else {
        setItems((prev) => [res.item, ...prev]);
        setNewUrl("");
      }
    } catch (err: any) {
      alert(`Failed to save dispatch: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f4ee] text-[#111111]">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Masthead Banner for Wire Inbox */}
        <div className="border-b-4 border-[#111111] pb-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-wire uppercase font-bold tracking-widest text-[#555555]">
                <Inbox className="w-3.5 h-3.5" />
                <span>INCOMING TELEGRAPH WIRE DESK</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-headline font-black uppercase tracking-tight text-[#111111] mt-1">
                The Wire Inbox
              </h1>
              <p className="text-xs sm:text-sm font-serif italic text-[#444444] mt-1">
                Saved Instagram Reels filed from Android Share Sheet or web dispatches. Unanalyzed until you trigger transcription.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadItems}
                className="px-3 py-1.5 border-2 border-[#111111] bg-white hover:bg-[#f2efe9] text-xs font-wire uppercase font-bold tracking-wider flex items-center gap-1.5 transition-colors"
                title="Refresh Inbox"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
              <Link
                href="/"
                className="px-3 py-1.5 border-2 border-[#111111] bg-[#111111] text-white hover:bg-[#333333] text-xs font-wire uppercase font-bold tracking-wider flex items-center gap-1.5 transition-colors"
              >
                <span>Front Page</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Manual Link Ingestion Bar */}
        <div className="border-2 border-[#111111] bg-[#fcfbf9] p-4 sm:p-5 mb-8">
          <div className="flex items-center gap-2 text-xs font-wire uppercase font-bold tracking-wider text-[#111111] mb-2">
            <Plus className="w-3.5 h-3.5" />
            <span>FILE DISPATCH MANUALLY TO WIRE INBOX</span>
          </div>
          <form onSubmit={handleAddManual} className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              placeholder="Paste Instagram Reel link (https://www.instagram.com/reel/...)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="flex-1 px-3 py-2 border-2 border-[#111111] bg-white text-xs font-mono text-[#111111] focus:outline-none"
              required
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#111111] text-white hover:bg-[#333333] border-2 border-[#111111] text-xs font-wire uppercase font-bold tracking-wider transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Filing..." : "Save to Inbox"}
            </button>
          </form>
        </div>

        {/* Inbox Content Area */}
        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block w-8 h-8 border-4 border-[#111111] border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 font-wire text-xs uppercase tracking-wider text-[#555555]">
              Scanning Wire Inbox Dispatches...
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="border-4 border-dashed border-[#cccccc] bg-[#fcfbf9] p-8 sm:p-12 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-none border-2 border-[#111111] bg-white flex items-center justify-center">
              <Inbox className="w-6 h-6 text-[#111111]" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-xl uppercase tracking-tight text-[#111111]">
                No Pending Dispatches on the Wire
              </h3>
              <p className="text-xs sm:text-sm font-serif italic text-[#555555] max-w-md mx-auto mt-1">
                Your Wire Inbox is currently empty. Share a Reel from Android or paste a link above to queue dispatches.
              </p>
            </div>

            {/* Android Share Instructions Card */}
            <div className="max-w-md mx-auto border-2 border-[#111111] bg-white p-4 text-left text-xs font-serif text-[#333333] space-y-2">
              <div className="flex items-center gap-2 font-wire uppercase font-bold tracking-wider text-[#111111]">
                <Share2 className="w-3.5 h-3.5" />
                <span>How to use Android Share Sheet:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 pl-1">
                <li>Install ReelMind on your Android phone (Add to Home screen).</li>
                <li>Open Instagram and find any public Reel.</li>
                <li>Tap <strong>Share</strong> and select <strong>ReelMind</strong>.</li>
                <li>The link is automatically saved here in your Wire Inbox!</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-wire uppercase tracking-wider text-[#555555] px-1">
              <span>{items.length} {items.length === 1 ? "DISPATCH" : "DISPATCHES"} ON FILE</span>
              <span>LATEST FIRST</span>
            </div>

            <div className="divide-y-2 divide-[#111111] border-2 border-[#111111] bg-white">
              {items.map((item, idx) => {
                const isTranscribingThis = actionLoadingId === item.id;
                const formattedDate = new Date(item.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#fbf9f4] transition-colors"
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-wire text-[10px] font-bold px-1.5 py-0.5 border border-[#111111] bg-[#111111] text-white uppercase">
                          #{items.length - idx}
                        </span>
                        <span className="text-[11px] font-wire text-[#666666] uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formattedDate}</span>
                        </span>
                        {item.status === "completed" && (
                          <span className="border border-emerald-800 bg-emerald-50 text-emerald-900 text-[10px] font-wire font-bold uppercase px-1.5 py-0.2">
                            ✓ TYPESET ARCHIVED
                          </span>
                        )}
                        {item.status === "transcribing" && (
                          <span className="border border-amber-800 bg-amber-50 text-amber-900 text-[10px] font-wire font-bold uppercase px-1.5 py-0.2 animate-pulse">
                            ROTARY PRESS RUNNING
                          </span>
                        )}
                        {item.status === "saved" && (
                          <span className="border border-[#777777] bg-[#f6f4ee] text-[#333333] text-[10px] font-wire font-bold uppercase px-1.5 py-0.2">
                            SAVED • AWAITING ROTARY
                          </span>
                        )}
                      </div>

                      <h3 className="font-headline font-bold text-base sm:text-lg text-[#111111] truncate">
                        {item.title || "Instagram Reel Dispatch"}
                      </h3>

                      <div className="flex items-center gap-1">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-mono text-[#555555] hover:text-[#111111] underline truncate"
                          title={item.url}
                        >
                          <span className="truncate">{item.clean_url || item.url}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </div>

                      {item.shared_text && !item.shared_text.startsWith("http") && (
                        <p className="text-xs font-serif italic text-[#666666] line-clamp-1">
                          &ldquo;{item.shared_text}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.status === "completed" && item.job_id ? (
                        <button
                          onClick={() => router.push(`/?jobId=${item.job_id}`)}
                          className="px-3.5 py-2 bg-[#111111] text-white hover:bg-[#333333] border-2 border-[#111111] text-xs font-wire uppercase font-bold tracking-wider flex items-center gap-1.5 transition-colors"
                        >
                          <span>View Broadsheet</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTranscribe(item)}
                          disabled={isTranscribingThis}
                          className="px-3.5 py-2 bg-[#111111] text-white hover:bg-[#333333] border-2 border-[#111111] text-xs font-wire uppercase font-bold tracking-wider flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          {isTranscribingThis ? (
                            <>
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                              <span>Starting...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                              <span>Transcribe</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Share to WhatsApp */}
                      <button
                        onClick={() => handleShareToWhatsApp(item)}
                        className="p-2 border-2 border-[#111111] bg-white hover:bg-[#25D366] text-[#111111] transition-colors cursor-pointer"
                        title="Share Reel to WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(item)}
                        className="p-2 border-2 border-transparent hover:border-[#111111] hover:bg-[#f6f4ee] text-[#777777] hover:text-red-700 transition-colors"
                        title="Delete from Wire Inbox"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
