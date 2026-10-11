"use client";

import React, { useState } from "react";
import { Search, Clock, BookOpen, Globe, Newspaper, CheckCircle2 } from "lucide-react";
import { TranscriptResult, Segment } from "../lib/types";
import { formatTime } from "../lib/utils";
import { ViewMode } from "./TranscriptToolbar";

interface TranscriptViewProps {
  transcript: TranscriptResult;
  viewMode: ViewMode;
  useCorrected: boolean;
  currentTime: number;
  onSeek: (seconds: number) => void;
}

export function TranscriptView({
  transcript,
  viewMode,
  useCorrected,
  currentTime,
  onSeek,
}: TranscriptViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const segments = transcript.segments || [];

  const filteredSegments = segments.filter((seg) => {
    const q = searchQuery.toLowerCase();
    const textMatch = seg.text.toLowerCase().includes(q);
    const transMatch = seg.translation ? seg.translation.toLowerCase().includes(q) : false;
    return textMatch || transMatch;
  });

  const getLanguageStamp = (lang: string) => {
    const l = lang.toLowerCase();
    switch (l) {
      case "hi":
      case "hindi":
        return "HINDI (हिन्दी)";
      case "te":
      case "telugu":
        return "TELUGU (తెలుగు)";
      case "ta":
      case "tamil":
        return "TAMIL (தமிழ்)";
      case "en":
      case "english":
        return "ENGLISH";
      case "mixed":
        return "MIXED / CODE-SWITCH";
      case "ja":
      case "japanese":
        return "JAPANESE (日本語)";
      default:
        return lang.toUpperCase();
    }
  };

  return (
    <div className="newspaper-box p-6 flex flex-col h-full max-h-[820px]">
      {/* Broadsheet Column Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b-2 border-[#111111] gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-wire text-xs font-bold uppercase tracking-widest bg-[#111111] text-white px-2 py-0.5">
              COLUMN II
            </span>
            <h3 className="font-headline text-xl sm:text-2xl font-bold uppercase tracking-tight text-[#111111]">
              Broadsheet Verbatim &amp; Wire
            </h3>
          </div>
          <p className="font-serif italic text-xs text-[#444444] mt-1">
            Click any margin timestamp to scrub audio-visual playback. Switch tracks above anytime.
          </p>
        </div>

        {/* Vintage Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[#555555] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search words across all tracks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border-2 border-[#111111] font-wire text-xs text-[#111111] placeholder-[#888888] focus:outline-none focus:ring-1 focus:ring-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          />
        </div>
      </div>

      {/* Editorial Lead Headline & Summary (Broadsheet Lead Box) */}
      {(transcript.headline || (transcript.summary_bullets && transcript.summary_bullets.length > 0)) && (
        <div className="my-3 p-4 bg-[#f8f6f0] border-2 border-[#111111] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] space-y-2">
          <div className="flex items-center gap-1.5 font-wire text-[10px] font-bold uppercase tracking-widest text-[#111111]">
            <Newspaper className="w-3.5 h-3.5" />
            <span>FRONT PAGE DISPATCH BRIEF</span>
          </div>

          {transcript.headline && (
            <h4 className="font-headline text-lg sm:text-xl font-bold uppercase tracking-tight text-[#111111] leading-snug">
              {transcript.headline}
            </h4>
          )}

          {transcript.summary_bullets && transcript.summary_bullets.length > 0 && (
            <ul className="space-y-1 pt-1 border-t border-[#d8d3c5]">
              {transcript.summary_bullets.map((bullet, idx) => (
                <li key={idx} className="font-serif text-xs sm:text-sm text-[#222222] flex items-start gap-2">
                  <span className="font-bold text-[#111111] mt-0.5">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Column Lead Info / Summary */}
      <div className="py-2 px-3 bg-[#f6f4ee] border-b border-[#111111] flex items-center justify-between font-wire text-[11px] text-[#444444] uppercase">
        <span>
          SHOWING {filteredSegments.length} OF {segments.length} RECORDED SEGMENTS
        </span>
        <span className="font-bold text-[#111111]">
          ACTIVE VIEW: {viewMode === "original" ? "ORIGINAL SPOKEN SCRIPT" : viewMode === "english" ? "UNIVERSAL ENGLISH WIRE" : "DUAL TRACK (SIDE-BY-SIDE)"}
        </span>
      </div>

      {/* Scrollable Article Body / Segments List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#e2ded2] pr-2 my-2 space-y-2">
        {filteredSegments.length === 0 ? (
          <div className="py-16 text-center text-[#777777]">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#111111]" />
            <p className="font-headline uppercase text-sm font-bold text-[#111111]">
              NO CORRESPONDING DISPATCH FOUND
            </p>
            <p className="font-serif italic text-xs mt-1">
              Adjust search query to locate spoken phrases in this reel edition.
            </p>
          </div>
        ) : (
          filteredSegments.map((seg) => {
            const isActive = currentTime >= seg.start && currentTime <= seg.end;

            return (
              <div
                key={seg.id}
                onClick={() => onSeek(seg.start)}
                className={`p-3 transition-all cursor-pointer border ${
                  isActive
                    ? "bg-[#fef9c3] border-2 border-[#111111] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-white border-[#dddddd] hover:border-[#111111] hover:bg-[#faf8f2]"
                }`}
              >
                {/* Segment Header Bar */}
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#eeeeee]">
                  <div className="flex items-center gap-2">
                    {/* Timestamp Button */}
                    <button
                      type="button"
                      className="font-wire text-xs font-bold bg-[#111111] text-white px-2 py-0.5 border border-[#111111] hover:bg-[#333333] transition-colors flex items-center gap-1"
                    >
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(seg.start)} - {formatTime(seg.end)}</span>
                    </button>

                    {/* Language Badge */}
                    <span className="font-wire text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border border-[#111111] bg-[#f6f4ee] text-[#111111]">
                      {getLanguageStamp(seg.language)}
                    </span>
                  </div>

                  <span className="font-wire text-[10px] text-[#777777]">
                    SEC. {seg.id}
                  </span>
                </div>

                {/* Segment Content by viewMode */}
                {viewMode === "original" && (
                  <p className="font-serif text-base sm:text-lg text-[#111111] leading-relaxed">
                    {seg.text}
                  </p>
                )}

                {viewMode === "english" && (
                  <div className="space-y-1">
                    <p className="font-serif text-base sm:text-lg text-[#111111] leading-relaxed">
                      {seg.translation || seg.text}
                    </p>
                    {seg.translation && seg.translation !== seg.text && (
                      <span className="inline-block font-wire text-[10px] uppercase text-[#666666] tracking-wider">
                        • TRANSLATED FROM {getLanguageStamp(seg.language)}
                      </span>
                    )}
                  </div>
                )}

                {viewMode === "dual" && (
                  <div className="space-y-2">
                    {/* Original Voice */}
                    <div>
                      <span className="block font-wire text-[9px] font-bold uppercase tracking-widest text-[#777777] mb-0.5">
                        ORIGINAL VOICE ({getLanguageStamp(seg.language)}):
                      </span>
                      <p className="font-serif text-base sm:text-lg text-[#111111] leading-relaxed">
                        {seg.text}
                      </p>
                    </div>

                    {/* English Translation */}
                    {seg.translation && (
                      <div className="pt-1.5 border-t border-[#eeeeee]">
                        <span className="block font-wire text-[9px] font-bold uppercase tracking-widest text-[#555555] mb-0.5 flex items-center gap-1">
                          <Globe className="w-2.5 h-2.5" /> ENGLISH WIRE:
                        </span>
                        <p className="font-serif italic text-sm sm:text-base text-[#333333] leading-relaxed">
                          &ldquo;{seg.translation}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Editorial Rule */}
      <div className="pt-3 border-t-2 border-[#111111] flex items-center justify-between font-wire text-[11px] text-[#555555]">
        <span>THE REELMIND CHRONICLE • BROADCAST VERBATIM &amp; WIRE</span>
        <span>PAGE END</span>
      </div>
    </div>
  );
}
