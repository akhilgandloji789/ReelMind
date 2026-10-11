"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "../../components/Header";
import { fetchSundayDigest } from "../../lib/api";
import { SundayDigestData, SundayBulletin, SundayCategory } from "../../lib/types";
import { openWhatsAppShare } from "../../lib/whatsapp";
import {
  Newspaper,
  Share2,
  Printer,
  Sparkles,
  RotateCcw,
  ExternalLink,
  Clock,
  Languages,
  BookOpen,
  ArrowRight,
  TrendingUp,
  Award,
  Bell,
  BellRing,
  Check,
} from "lucide-react";
import { sendMobileNotification } from "../../lib/notifications";

export default function SundayPage() {
  const [digest, setDigest] = useState<SundayDigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDigest = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSundayDigest();
      setDigest(data);
    } catch (err: any) {
      setError(err.message || "Failed to compile the Sunday Edition.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDigest();
  }, []);

  const [notifSent, setNotifSent] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  const handleSendTestNotification = async () => {
    setNotifLoading(true);
    try {
      await sendMobileNotification(
        "🗞️ THE REELMIND CHRONICLE",
        `Sunday Edition Ready: ${digest?.total_reels || 14} Dispatches filed this week. Tap to read your intelligence brief!`,
        "/sunday"
      );
      setNotifSent(true);
      setTimeout(() => setNotifSent(false), 4000);
    } catch (e: any) {
      alert(e.message || "Please tap 'Allow' when your phone asks for notification permission.");
    } finally {
      setNotifLoading(false);
    }
  };

  const handleShareEntireDigest = () => {
    if (!digest) return;
    openWhatsAppShare(digest.whatsapp_text);
  };

  const handleShareSingleBulletin = (b: SundayBulletin) => {
    const text = [
      "🗞️ *THE REELMIND CHRONICLE • SUNDAY LESSON*",
      "═════════════════════════",
      `📌 *${b.title}*`,
      b.reel_url ? `📹 *Reel:* ${b.reel_url}` : "",
      `🏷️ *Beat:* ${b.category}`,
      "",
      `💡 *TAKEAWAY / RECIPE:*`,
      b.takeaway,
      "",
      "═════════════════════════",
      "🗞️ *Read the full Sunday Edition:*",
      "👉 https://reelmind-c0293.web.app/sunday",
    ]
      .filter(Boolean)
      .join("\n");

    openWhatsAppShare(text);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f4ee] text-[#111111]">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sunday Broadsheet Special Masthead Banner */}
        <div className="border-b-4 border-[#111111] pb-5 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-wire uppercase font-bold tracking-widest text-[#555555]">
                <Newspaper className="w-3.5 h-3.5" />
                <span>SPECIAL WEEKLY INTELLIGENCE SUPPLEMENT</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-headline font-black uppercase tracking-tight text-[#111111] mt-1">
                The Sunday Chronicle
              </h1>
              <p className="text-xs sm:text-sm font-serif italic text-[#444444] mt-1">
                {digest?.week_label || "Weekly Curation of Spoken Reels, Recipes & Insights"} • Edition: {digest?.edition_date || "Sunday Edition"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 no-print">
              <button
                onClick={handleShareEntireDigest}
                disabled={!digest}
                className="px-4 py-2 bg-[#25D366] hover:bg-[#1ebc57] text-[#111111] border-2 border-[#111111] text-xs font-wire uppercase font-bold tracking-wider flex items-center gap-2 shadow-[2px_2px_0px_#111111] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                title="Send entire weekly digest to WhatsApp"
              >
                <Share2 className="w-4 h-4 text-[#111111]" />
                <span>📲 Share to WhatsApp</span>
              </button>

              <button
                onClick={() => window.print()}
                className="px-3 py-2 border-2 border-[#111111] bg-white hover:bg-[#f2efe9] text-xs font-wire uppercase font-bold tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Print Sunday Broadsheet"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>

              <button
                onClick={loadDigest}
                className="px-3 py-2 border-2 border-[#111111] bg-white hover:bg-[#f2efe9] text-xs font-wire uppercase font-bold tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Refresh Sunday Press"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="newspaper-box p-12 text-center space-y-4">
            <div className="w-10 h-10 border-4 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h2 className="font-headline text-xl font-bold uppercase tracking-wider text-[#111111]">
              Press in Motion: Printing the Sunday Supplement...
            </h2>
            <p className="font-serif italic text-sm text-[#555555]">
              Analyzing your week&apos;s saved dispatches, calculating beat distributions, and synthesizing top takeaways...
            </p>
          </div>
        ) : error ? (
          <div className="newspaper-box p-8 border-red-700 bg-red-50 text-red-900 space-y-4">
            <h2 className="font-headline text-lg font-bold uppercase">The Sunday Press Encountered an Error</h2>
            <p className="text-sm font-serif">{error}</p>
            <button
              onClick={loadDigest}
              className="newspaper-btn font-wire text-xs font-bold uppercase px-4 py-2"
            >
              Re-spin Rotary Press
            </button>
          </div>
        ) : digest ? (
          <div className="space-y-8">
            {/* Mobile Push Notification Alert Box */}
            <div className="newspaper-box p-4 sm:p-5 bg-[#fbf9f4] border-2 border-[#111111] flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="p-2.5 bg-[#111111] text-white flex-shrink-0">
                  <Bell className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h4 className="font-headline font-bold text-sm uppercase tracking-wide text-[#111111]">
                    Receive Morning Intelligence On Your Mobile Device
                  </h4>
                  <p className="font-serif italic text-xs text-[#555555]">
                    Pops up on your Android notification bar &amp; lock screen every Sunday at 9:00 AM.
                  </p>
                </div>
              </div>

              <button
                onClick={handleSendTestNotification}
                disabled={notifLoading}
                className="w-full sm:w-auto px-4 py-2 bg-[#111111] hover:bg-[#333333] text-white border-2 border-[#111111] text-xs font-wire uppercase font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors flex-shrink-0 shadow-[2px_2px_0px_#111111]"
              >
                {notifSent ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>✓ Alert Delivered To Phone!</span>
                  </>
                ) : (
                  <>
                    <BellRing className="w-4 h-4 text-amber-300" />
                    <span>Send Notification To My Phone</span>
                  </>
                )}
              </button>
            </div>

            {/* Lead Story: Front-Page Headline & Editorial */}
            <div className="newspaper-box p-6 sm:p-8 bg-white border-4 border-[#111111]">
              <div className="border-b-2 border-[#111111] pb-3 mb-4">
                <span className="font-wire text-xs font-black uppercase tracking-widest bg-[#111111] text-white px-2 py-0.5 inline-block mb-2">
                  FRONT-PAGE INTELLIGENCE
                </span>
                <h2 className="font-headline font-black text-2xl sm:text-4xl uppercase tracking-tight text-[#111111] leading-tight">
                  {digest.headline}
                </h2>
                <div className="flex items-center gap-3 text-xs font-wire text-[#666666] uppercase tracking-wider mt-2">
                  <span>By Chief Newsroom Synthesizer</span>
                  <span>•</span>
                  <span>Typeset on Sunday Morning</span>
                </div>
              </div>

              <div className="prose max-w-none text-justify font-serif text-base sm:text-lg leading-relaxed text-[#222222] sm:columns-2 gap-8">
                <p className="first-letter:text-5xl first-letter:font-headline first-letter:font-black first-letter:mr-2 first-letter:float-left first-letter:leading-none">
                  {digest.editorial}
                </p>
              </div>
            </div>

            {/* Weekly Press Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="newspaper-box p-5 bg-[#fbf9f4] text-center space-y-1">
                <span className="text-xs font-wire font-bold uppercase tracking-widest text-[#666666]">
                  DISPATCHES FILED
                </span>
                <p className="font-headline font-black text-3xl sm:text-4xl text-[#111111]">
                  {digest.total_reels}
                </p>
                <p className="text-[11px] font-serif italic text-[#777777]">Captured from Instagram &amp; Uploads</p>
              </div>

              <div className="newspaper-box p-5 bg-[#fbf9f4] text-center space-y-1">
                <span className="text-xs font-wire font-bold uppercase tracking-widest text-[#666666]">
                  AUDIO DIGESTED
                </span>
                <p className="font-headline font-black text-3xl sm:text-4xl text-[#111111]">
                  {digest.total_duration_minutes}m
                </p>
                <p className="text-[11px] font-serif italic text-[#777777]">Total spoken content transcribed</p>
              </div>

              <div className="newspaper-box p-5 bg-[#fbf9f4] text-center space-y-1">
                <span className="text-xs font-wire font-bold uppercase tracking-widest text-[#666666]">
                  DIALECTS &amp; VOICES
                </span>
                <p className="font-headline font-bold text-xl sm:text-2xl text-[#111111] truncate">
                  {digest.top_languages.slice(0, 2).join(", ") || "Multilingual"}
                </p>
                <p className="text-[11px] font-serif italic text-[#777777]">Telugu, Hindi, and English code-switching</p>
              </div>
            </div>

            {/* Beat & Category Intelligence */}
            <div className="newspaper-box p-6 bg-white space-y-4">
              <div className="border-b-2 border-[#111111] pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#111111]" />
                  <h3 className="font-headline font-bold text-lg sm:text-xl uppercase tracking-wider text-[#111111]">
                    Beat &amp; Category Distribution
                  </h3>
                </div>
                <span className="font-wire text-xs font-bold text-[#666666] uppercase">
                  Weekly Attention Share
                </span>
              </div>

              <div className="space-y-3 pt-2">
                {digest.categories.map((cat, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-wire font-bold uppercase tracking-wider text-[#222222]">
                      <span>{cat.name}</span>
                      <span>{cat.percentage}% ({cat.count} reels)</span>
                    </div>
                    <div className="w-full bg-[#eae6da] h-4 border border-[#111111]">
                      <div
                        className="bg-[#111111] h-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(5, cat.percentage))}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Curated Sunday Bulletins & Recipe Highlights */}
            <div className="space-y-4">
              <div className="border-b-2 border-[#111111] pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#111111]" />
                  <h3 className="font-headline font-bold text-xl uppercase tracking-wider text-[#111111]">
                    The Sunday Briefing: Key Lessons &amp; Recipes
                  </h3>
                </div>
                <span className="font-wire text-xs font-bold text-[#666666] uppercase">
                  Curated Insights
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {digest.bulletins.map((b, idx) => (
                  <div
                    key={b.id || idx}
                    className="newspaper-box p-5 bg-white flex flex-col justify-between space-y-4 hover:border-black transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 border-b border-[#eeeeee] pb-2">
                        <span className="text-[10px] font-wire font-bold uppercase px-2 py-0.5 bg-[#f6f4ee] border border-[#111111] text-[#111111]">
                          {b.category || "Dispatch"}
                        </span>
                        <span className="text-[11px] font-wire font-bold text-[#777777]">
                          #{idx + 1}
                        </span>
                      </div>

                      <h4 className="font-headline font-bold text-base sm:text-lg text-[#111111] leading-snug">
                        {b.title}
                      </h4>

                      <p className="font-serif text-sm text-[#333333] leading-relaxed">
                        {b.takeaway}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#eeeeee]">
                      {b.reel_url ? (
                        <a
                          href={b.reel_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-wire font-bold uppercase text-[#555555] hover:text-[#111111] underline"
                        >
                          <span>Open Reel</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-xs font-wire text-[#888888] uppercase">Archive Record</span>
                      )}

                      <button
                        onClick={() => handleShareSingleBulletin(b)}
                        className="px-2.5 py-1 bg-white hover:bg-[#25D366] text-[#111111] border border-[#111111] text-[11px] font-wire uppercase font-bold tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                        title="Share this lesson to WhatsApp"
                      >
                        <Share2 className="w-3 h-3" />
                        <span>Send to WhatsApp</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Call to Action Banner */}
            <div className="newspaper-box p-6 bg-[#111111] text-white text-center space-y-4 no-print">
              <h3 className="font-headline font-black text-2xl uppercase tracking-wider">
                Share This Week&apos;s Intelligence With Your Network
              </h3>
              <p className="font-serif italic text-sm text-[#cccccc] max-w-xl mx-auto">
                Send your complete Sunday digest—including stats, category breakdowns, and top takeaways—straight to your personal WhatsApp chat, friends, or study group with one tap.
              </p>
              <div className="pt-2">
                <button
                  onClick={handleShareEntireDigest}
                  className="px-6 py-3 bg-[#25D366] hover:bg-[#1ebc57] text-[#111111] border-2 border-white text-sm font-wire font-black uppercase tracking-widest inline-flex items-center gap-2 shadow-[4px_4px_0px_#ffffff] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-[#111111]" />
                  <span>📲 Share Full Sunday Chronicle to WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      <footer className="border-t-2 border-[#111111] bg-[#fbf9f4] py-8 text-center text-xs font-wire uppercase tracking-wider text-[#555555] mt-12 no-print">
        <div className="max-w-4xl mx-auto px-4 space-y-2">
          <p className="font-bold text-[#111111]">
            THE SUNDAY REELMIND CHRONICLE • PUBLISHED EVERY SUNDAY MORNING • ARCHIVES OPEN 24/7
          </p>
          <div className="flex justify-center gap-4 text-[11px] text-[#444444] pt-2">
            <Link href="/" className="hover:underline font-bold">Front Page</Link>
            <span>•</span>
            <Link href="/inbox" className="hover:underline font-bold">Wire Inbox</Link>
            <span>•</span>
            <Link href="/eval" className="hover:underline font-bold">Proofreader&apos;s Desk</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
