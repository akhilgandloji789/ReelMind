"use client";

import React, { useState } from "react";
import { Send, HelpCircle, Clock, Sparkles, MessageSquare } from "lucide-react";
import { askQuestionAboutTranscript } from "../lib/api";
import { InquiryCitation } from "../lib/types";

interface InquiryDeskProps {
  jobId: string;
  onSeek: (seconds: number) => void;
}

const QUICK_PROMPTS = [
  { label: "Core Takeaways", text: "What are the core takeaways and main message of this reel?" },
  { label: "ఈ రీల్ సారాంశం (Telugu)", text: "ఈ వీడియోలో చెప్పిన ముఖ్యమైన విషయాలు ఏమిటి? తెలుగులో వివరించండి." },
  { label: "मुख्य बिंदु (Hindi)", text: "इस रील का मुख्य संदेश क्या है? सरल हिंदी में बताएं।" },
  { label: "Hardware & Tools", text: "What software, hardware tools, or repositories are mentioned?" },
];

export function InquiryDesk({ jobId, onSeek }: InquiryDeskProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<InquiryCitation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async (queryText?: string) => {
    const q = (queryText || question).trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await askQuestionAboutTranscript(jobId, q);
      setAnswer(res.answer);
      setCitations(res.citations || []);
      if (queryText) {
        setQuestion(queryText);
      }
    } catch (err: any) {
      setError(err.message || "Failed to contact the Inquiry Desk.");
    } finally {
      setLoading(false);
    }
  };

  // Render clickable timestamps inside answer text
  const renderFormattedAnswer = (text: string) => {
    // Regex for [MM:SS]
    const parts = text.split(/(\[\d{1,2}:\d{2}\])/g);

    return parts.map((part, index) => {
      const match = part.match(/\[(\d{1,2}):(\d{2})\]/);
      if (match) {
        const mins = parseInt(match[1], 10);
        const secs = parseInt(match[2], 10);
        const totalSecs = mins * 60 + secs;

        return (
          <button
            key={index}
            type="button"
            onClick={() => onSeek(totalSecs)}
            className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 bg-[#111111] text-white font-wire text-xs font-bold hover:bg-[#333333] transition-colors rounded-none align-baseline cursor-pointer"
            title={`Jump video to ${match[1]}:${match[2]}`}
          >
            <Clock className="w-3 h-3" />
            <span>{match[1]}:{match[2]}</span>
          </button>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="newspaper-box p-6 space-y-4">
      {/* Masthead Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b-2 border-[#111111] gap-2">
        <div className="flex items-center gap-2">
          <span className="font-wire text-xs font-bold uppercase tracking-widest bg-[#111111] text-white px-2 py-0.5">
            EDITORIAL DESK
          </span>
          <h3 className="font-headline text-xl sm:text-2xl font-bold uppercase tracking-tight text-[#111111]">
            Telegraph an Inquiry • Multilingual Q&amp;A
          </h3>
        </div>
        <span className="font-wire text-[11px] uppercase tracking-wider text-[#666666]">
          ACCEPTS TELUGU • HINDI • ENGLISH • ANY TONGUE
        </span>
      </div>

      <p className="font-serif italic text-xs text-[#444444]">
        Submit any question regarding this dispatch in your native tongue. Our editorial intelligence engine cross-references verbatim spoken words and exact timestamps.
      </p>

      {/* Quick Prompt Chips */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="font-wire text-[10px] font-bold uppercase tracking-widest text-[#777777] mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> QUICK INQUIRIES:
        </span>
        {QUICK_PROMPTS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleAsk(p.text)}
            disabled={loading}
            className="font-wire text-xs font-bold px-2.5 py-1 bg-white border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk();
        }}
        className="flex gap-2 pt-2"
      >
        <div className="relative flex-1">
          <MessageSquare className="w-4 h-4 text-[#666666] absolute left-3 top-3" />
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your question in Telugu, Hindi, English, or any language..."
            disabled={loading}
            className="w-full pl-9 pr-3 py-2 bg-white border-2 border-[#111111] font-serif text-sm sm:text-base text-[#111111] placeholder-[#777777] focus:outline-none focus:ring-1 focus:ring-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="newspaper-btn font-wire text-xs font-bold uppercase tracking-widest px-4 py-2 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <span className="animate-pulse">PRINTING...</span>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>TELEGRAPH</span>
            </>
          )}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-700 text-red-900 font-serif text-xs">
          <strong>DISPATCH ERROR:</strong> {error}
        </div>
      )}

      {/* Answer Broadsheet Box */}
      {answer && (
        <div className="p-4 bg-[#fcfbf9] border-2 border-[#111111] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] space-y-3 mt-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#dddddd]">
            <span className="font-wire text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center gap-1.5">
              <span>EDITORIAL RESPONSE</span>
            </span>
            <span className="font-wire text-[10px] text-[#777777] uppercase">
              CLICK ANY BLACK TIMESTAMP BADGE TO JUMP VIDEO
            </span>
          </div>

          <div className="font-serif text-sm sm:text-base text-[#111111] leading-relaxed whitespace-pre-wrap">
            {renderFormattedAnswer(answer)}
          </div>

          {/* Citations Row */}
          {citations.length > 0 && (
            <div className="pt-2 border-t border-[#e2ded2] flex flex-wrap items-center gap-2">
              <span className="font-wire text-[10px] font-bold uppercase text-[#555555]">
                DIRECT AUDIO CITATIONS:
              </span>
              {citations.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSeek(c.seconds)}
                  className="font-wire text-xs font-bold bg-[#111111] text-white px-2 py-0.5 hover:bg-[#333333] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Clock className="w-2.5 h-2.5" />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
