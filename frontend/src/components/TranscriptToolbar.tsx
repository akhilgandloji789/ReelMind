"use client";

import React, { useState } from "react";
import { Copy, Check, Printer, RotateCcw, FileText, Subtitles, Code2, Globe, Languages } from "lucide-react";
import { TranscriptResult } from "../lib/types";
import { downloadFile, generateSRT } from "../lib/utils";

export type ViewMode = "original" | "english" | "dual";

interface TranscriptToolbarProps {
  transcript: TranscriptResult;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  useCorrected: boolean;
  onToggleCorrected: (val: boolean) => void;
  onReset: () => void;
}

export function TranscriptToolbar({
  transcript,
  viewMode,
  onViewModeChange,
  useCorrected,
  onToggleCorrected,
  onReset,
}: TranscriptToolbarProps) {
  const [copied, setCopied] = useState(false);

  // Active text depending on viewMode
  const getActiveText = () => {
    if (viewMode === "english") {
      return transcript.english_transcript || transcript.corrected_transcript || transcript.raw_transcript;
    }
    if (viewMode === "dual") {
      return (transcript.segments || [])
        .map((s) => `[${s.start}s - ${s.end}s]\nORIGINAL: ${s.text}\nENGLISH: ${s.translation || s.text}\n`)
        .join("\n");
    }
    return useCorrected
      ? transcript.corrected_transcript || transcript.raw_transcript
      : transcript.raw_transcript;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getActiveText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadTxt = () => {
    const filename = `ReelMind-${viewMode.toUpperCase()}-${transcript.id}.txt`;
    downloadFile(filename, getActiveText(), "text/plain");
  };

  const handleDownloadJson = () => {
    downloadFile(`ReelMind-Archive-${transcript.id}.json`, JSON.stringify(transcript, null, 2), "application/json");
  };

  const handleDownloadSrt = () => {
    // Generate SRT with active viewMode's text
    const srtSegments = (transcript.segments || []).map((s) => ({
      ...s,
      text: viewMode === "english" ? (s.translation || s.text) : s.text,
    }));
    const srtContent = generateSRT(srtSegments);
    downloadFile(`ReelMind-Captions-${viewMode}-${transcript.id}.srt`, srtContent, "text/plain");
  };

  return (
    <div className="newspaper-box p-4 mb-6 space-y-4 no-print">
      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b-2 border-[#111111]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Detected Language Tag */}
          <div className="font-wire text-xs font-bold uppercase tracking-wider px-3 py-1 bg-[#111111] text-white flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5" />
            <span>DIALECTS:</span>
            <span>
              {transcript.languages && transcript.languages.length > 0
                ? transcript.languages.join(" • ")
                : "Multilingual"}
            </span>
          </div>

          {/* Duration Badge */}
          <span className="font-wire text-xs border border-[#111111] bg-white px-2.5 py-1 text-[#111111] font-bold">
            {transcript.duration.toFixed(1)}s TOTAL DURATION • {transcript.segments?.length || 0} SEGMENTS
          </span>

          {/* Dual-Track Wire Indicator */}
          <span className="font-wire text-xs font-bold uppercase tracking-wider px-2 py-0.5 bg-[#f6f4ee] border border-[#111111] text-[#111111] flex items-center gap-1">
            <Globe className="w-3 h-3" />
            <span>DUAL-TRACK ENABLED</span>
          </span>
        </div>

        {/* New Dispatch Button */}
        <button
          onClick={onReset}
          className="newspaper-btn-outline font-wire text-xs font-bold uppercase tracking-widest px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>New Dispatch</span>
        </button>
      </div>

      {/* Middle Row: The Dual-Track Language Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#dddddd]">
        <div className="flex items-center gap-2">
          <span className="font-wire text-xs font-bold uppercase text-[#555555]">
            EDITION TRACK:
          </span>
          <div className="inline-flex border-2 border-[#111111] p-0.5 bg-[#f6f4ee]">
            <button
              type="button"
              onClick={() => onViewModeChange("original")}
              className={`px-3 py-1 font-wire text-xs uppercase font-bold tracking-wider transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === "original"
                  ? "bg-[#111111] text-white"
                  : "text-[#333333] hover:text-[#111111] hover:bg-[#eae6da]"
              }`}
            >
              <span>🗣️ Original Voice</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("english")}
              className={`px-3 py-1 font-wire text-xs uppercase font-bold tracking-wider transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === "english"
                  ? "bg-[#111111] text-white"
                  : "text-[#333333] hover:text-[#111111] hover:bg-[#eae6da]"
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>🌐 English Wire</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("dual")}
              className={`px-3 py-1 font-wire text-xs uppercase font-bold tracking-wider transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === "dual"
                  ? "bg-[#111111] text-white"
                  : "text-[#333333] hover:text-[#111111] hover:bg-[#eae6da]"
              }`}
            >
              <span>📑 Dual Edition</span>
            </button>
          </div>
        </div>

        {/* Quality Proofing State */}
        <div className="flex items-center gap-1 font-wire text-[11px] text-[#555555] uppercase">
          <span>TYPESETTING:</span>
          <span className="font-bold text-[#111111]">
            {useCorrected ? "GROQ EDITORIAL PROOFED" : "VERBATIM RAW"}
          </span>
        </div>
      </div>

      {/* Bottom Actions Row: Action Tools */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="newspaper-btn-outline font-wire text-xs font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1 cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "COPIED" : `COPY ${viewMode.toUpperCase()}`}</span>
        </button>

        {/* Print Broadsheet Button */}
        <button
          type="button"
          onClick={handlePrint}
          className="newspaper-btn-outline font-wire text-xs font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1 cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>PRINT BROADSHEET</span>
        </button>

        {/* Export Wire TXT */}
        <button
          type="button"
          onClick={handleDownloadTxt}
          className="newspaper-btn-outline font-wire text-xs font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1 cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>EXPORT TXT</span>
        </button>

        {/* Export Captions SRT */}
        <button
          type="button"
          onClick={handleDownloadSrt}
          className="newspaper-btn-outline font-wire text-xs font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1 cursor-pointer"
        >
          <Subtitles className="w-3.5 h-3.5" />
          <span>SUBTITLES (SRT)</span>
        </button>

        {/* Export Metadata JSON */}
        <button
          type="button"
          onClick={handleDownloadJson}
          className="newspaper-btn-outline font-wire text-xs font-bold uppercase tracking-wider px-3 py-1.5 flex items-center gap-1 cursor-pointer"
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>METADATA (JSON)</span>
        </button>
      </div>
    </div>
  );
}
