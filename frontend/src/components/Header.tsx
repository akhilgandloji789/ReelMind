"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Newspaper, FileCheck, Mic, Inbox } from "lucide-react";

export function Header() {
  const pathname = usePathname();

  // Formatted date initialized with static fallback and hydrated in useEffect
  const [todayDate, setTodayDate] = React.useState("THURSDAY, OCTOBER 8, 2026");

  React.useEffect(() => {
    try {
      setTodayDate(
        new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }).toUpperCase()
      );
    } catch {
      // fallback
    }
  }, []);

  return (
    <header className="border-b-2 border-[#111111] bg-[#fbf9f4] no-print">
      {/* Top Broadsheet Weather & Vol Meta Bar */}
      <div className="border-b border-[#111111] px-4 py-1.5 text-[10px] sm:text-xs font-wire uppercase tracking-widest text-[#333333] flex flex-wrap items-center justify-between gap-2 max-w-7xl mx-auto">
        <div>
          <span>WEATHER: 72°F • ACOUSTIC CLARITY HIGH • ZERO NOISE</span>
        </div>
        <div className="hidden md:block font-bold tracking-widest text-[#111111]">
          ESTABLISHED 2026 • VOL. I, NO. 42 • ALL THE SPOKEN WORDS FIT TO PRINT
        </div>
        <div className="flex items-center gap-3">
          <span>{todayDate}</span>
          <span className="hidden sm:inline border border-[#111111] px-1.5 py-0.2 text-[9px] font-bold bg-[#111111] text-white">
            LATE CITY EDITION
          </span>
        </div>
      </div>

      {/* Main Masthead Banner */}
      <div className="max-w-7xl mx-auto px-4 py-5 text-center">
        <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4">
          {/* Left Decorative Vignette */}
          <div className="hidden md:flex md:col-span-3 flex-col items-center justify-center border-r border-[#111111] pr-4 text-center">
            <span className="text-[10px] font-wire uppercase tracking-wider font-bold">DISPATCH DESK</span>
            <p className="text-xs font-serif italic text-[#444444] mt-1 leading-snug">
              &ldquo;Accurate transcription of rapid code-switching, Devanagari Hindi, and technical vernacular.&rdquo;
            </p>
          </div>

          {/* Central Newspaper Title */}
          <div className="md:col-span-6 flex flex-col items-center">
            <Link href="/" className="inline-block group">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-headline font-black tracking-tight text-[#111111] uppercase hover:opacity-90 transition-opacity">
                The ReelMind Chronicle
              </h1>
            </Link>
            <div className="flex items-center justify-center gap-3 w-full mt-2">
              <span className="h-[1.5px] bg-[#111111] flex-1 max-w-[80px] sm:max-w-[120px]"></span>
              <p className="text-xs sm:text-sm font-serif italic text-[#333333] tracking-wide">
                The Daily Broadsheet for Verbatim Short-Form Video & Reel Transcripts
              </p>
              <span className="h-[1.5px] bg-[#111111] flex-1 max-w-[80px] sm:max-w-[120px]"></span>
            </div>
          </div>

          {/* Right Decorative Vignette */}
          <div className="hidden md:flex md:col-span-3 flex-col items-center justify-center border-l border-[#111111] pl-4 text-center">
            <span className="text-[10px] font-wire uppercase tracking-wider font-bold">ROTARY ENGINE</span>
            <p className="text-xs font-serif italic text-[#444444] mt-1 leading-snug">
              Powered by Groq Whisper Large v3 with Gemini Proofreader Verification.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Ribbons & Section Rules */}
      <div className="border-t-2 border-b-4 border-[#111111] bg-[#f6f4ee]">
        <div className="max-w-7xl mx-auto px-4 h-11 flex items-center justify-between">
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/"
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-wire uppercase font-bold tracking-wider transition-colors border ${
                pathname === "/"
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-transparent text-[#111111] border-transparent hover:border-[#111111]"
              }`}
            >
              <Newspaper className="w-3.5 h-3.5" />
              <span>Front Page</span>
            </Link>

            <Link
              href="/inbox"
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-wire uppercase font-bold tracking-wider transition-colors border ${
                pathname === "/inbox"
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-transparent text-[#111111] border-transparent hover:border-[#111111]"
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Wire Inbox</span>
            </Link>

            <Link
              href="/eval"
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-wire uppercase font-bold tracking-wider transition-colors border ${
                pathname === "/eval"
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-transparent text-[#111111] border-transparent hover:border-[#111111]"
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Proofreader&apos;s Desk</span>
            </Link>
          </nav>

          <div className="flex items-center gap-2 text-xs font-wire text-[#444444]">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            <span className="hidden sm:inline font-bold uppercase tracking-wider text-[#111111]">
              Typesetting Room: Active
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
