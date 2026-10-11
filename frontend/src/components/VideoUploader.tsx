"use client";

import React, { useState, useRef } from "react";
import { Upload, Link as LinkIcon, FileVideo, AlertCircle, ArrowRight, Globe, FileText, CheckCircle2 } from "lucide-react";
import { uploadVideoFile, transcribeReelUrl } from "../lib/api";

interface VideoUploaderProps {
  onJobStarted: (jobId: string) => void;
}

export function VideoUploader({ onJobStarted }: VideoUploaderProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload");
  const [reelUrl, setReelUrl] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("auto");
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await uploadVideoFile(file, selectedLanguage);
      onJobStarted(res.job_id);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit video dispatch.");
      setIsSubmitting(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reelUrl.trim()) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await transcribeReelUrl(reelUrl.trim(), selectedLanguage);
      onJobStarted(res.job_id);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to retrieve Reel from wire URL.");
      setIsSubmitting(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileUpload(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6">
      {/* Front-Page Lead Headline Banner */}
      <div className="text-center mb-8 border-b-2 border-[#111111] pb-6">
        <div className="inline-block border border-[#111111] px-3 py-1 bg-[#111111] text-white font-wire text-xs uppercase font-bold tracking-widest mb-3">
          ★ TELEGRAPHIC WIRE DESK • LATEST EDITION ★
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-headline font-black text-[#111111] uppercase tracking-tight">
          Submit Reel Dispatch for Verbatim Typesetting
        </h2>
        <div className="max-w-2xl mx-auto mt-3">
          <p className="font-serif italic text-base sm:text-lg text-[#333333] leading-relaxed">
            Every spoken second transcribed from start to finish. Robust continuous audio processing preserves full speech across background melodies and linguistic transitions.
          </p>
        </div>
      </div>

      {/* Classifieds / Dispatch Form Box */}
      <div className="newspaper-box p-6 sm:p-8">
        {/* Box Top Header: Tabs and Language routing */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-5 border-b-2 border-[#111111]">
          {/* Method Selector Tabs */}
          <div className="flex gap-1 border-2 border-[#111111] p-1 bg-[#f6f4ee]">
            <button
              type="button"
              onClick={() => {
                setActiveTab("upload");
                setErrorMessage(null);
              }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 py-2 px-4 text-xs font-wire uppercase font-bold tracking-wider transition-all ${
                activeTab === "upload"
                  ? "bg-[#111111] text-white shadow-sm"
                  : "text-[#333333] hover:text-[#111111] hover:bg-[#eae6da]"
              }`}
            >
              <FileVideo className="w-3.5 h-3.5" />
              <span>Dispatch Upload (File)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("url");
                setErrorMessage(null);
              }}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 py-2 px-4 text-xs font-wire uppercase font-bold tracking-wider transition-all ${
                activeTab === "url"
                  ? "bg-[#111111] text-white shadow-sm"
                  : "text-[#333333] hover:text-[#111111] hover:bg-[#eae6da]"
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Telegraph Wire (URL)</span>
            </button>
          </div>

          {/* Dialect / Language Selector */}
          <div className="flex items-center gap-2">
            <span className="font-wire text-xs uppercase font-bold text-[#111111] shrink-0">
              Dialect:
            </span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-white border-2 border-[#111111] text-xs font-wire text-[#111111] font-bold px-3 py-2 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              <option value="auto">Auto-Detect (Multilingual)</option>
              <option value="hi">Hindi (Devanagari • हिन्दी)</option>
              <option value="te">Telugu (తెలుగు)</option>
              <option value="ta">Tamil (தமிழ்)</option>
              <option value="kn">Kannada (ಕನ್ನಡ)</option>
              <option value="ml">Malayalam (മലയാളം)</option>
              <option value="en">English (Verbatim)</option>
              <option value="ja">Japanese (日本語)</option>
              <option value="es">Spanish (Español)</option>
            </select>
          </div>
        </div>

        {/* Error Alert styled as Editorial Notice */}
        {errorMessage && (
          <div className="mt-5 p-4 bg-white border-2 border-red-700 text-red-900 shadow-[3px_3px_0px_0px_rgba(185,28,28,1)]">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-wire uppercase font-bold text-xs tracking-wider text-red-700">
                  DISPATCH TRANSMISSION ERROR
                </p>
                <p className="font-serif text-sm mt-0.5">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Ingestion Area */}
        <div className="mt-6">
          {activeTab === "upload" ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed p-8 sm:p-12 text-center transition-all cursor-pointer ${
                isDragging
                  ? "border-[#111111] bg-[#efeade]"
                  : "border-[#111111] bg-white hover:bg-[#faf8f2]"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/avi"
                disabled={isSubmitting}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />

              <div className="inline-block border-2 border-[#111111] p-3 mb-4 bg-[#f6f4ee]">
                <Upload className="w-8 h-8 text-[#111111]" />
              </div>

              <h3 className="text-xl sm:text-2xl font-headline font-bold text-[#111111] uppercase tracking-tight mb-2">
                Deposit Moving Picture Dispatch Here
              </h3>
              <p className="font-serif italic text-sm text-[#444444] mb-6 max-w-md mx-auto">
                Drag and drop your Reel, Short, or video clip directly, or browse local files from your terminal.
              </p>

              <button
                type="button"
                disabled={isSubmitting}
                className="newspaper-btn-primary font-wire text-xs font-bold uppercase tracking-widest px-6 py-3 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "TRANSMITTING TO PRESS..." : "TRANSMIT DISPATCH TO PRESS"}
              </button>

              <div className="mt-6 pt-4 border-t border-[#111111] flex flex-wrap justify-center items-center gap-3 text-[11px] font-wire uppercase text-[#555555]">
                <span className="border border-[#111111] px-1.5 py-0.5 font-bold">MP4</span>
                <span className="border border-[#111111] px-1.5 py-0.5 font-bold">MOV</span>
                <span className="border border-[#111111] px-1.5 py-0.5 font-bold">WEBM</span>
                <span>• WEIGHT LIMIT: 100 MEGABYTES</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUrlSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="reelUrl"
                  className="block font-wire text-xs uppercase font-bold tracking-wider text-[#111111] mb-2"
                >
                  TELEGRAPHIC WIRE ADDRESS (REEL / SHORT URL)
                </label>
                <div className="relative">
                  <input
                    id="reelUrl"
                    type="url"
                    placeholder="https://www.instagram.com/reel/... or https://youtube.com/shorts/..."
                    value={reelUrl}
                    onChange={(e) => setReelUrl(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full pl-4 pr-12 py-3 bg-white border-2 border-[#111111] font-wire text-sm text-[#111111] placeholder-[#888888] focus:outline-none focus:ring-1 focus:ring-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !reelUrl.trim()}
                    className="absolute right-2 top-2 p-2 bg-[#111111] text-white hover:bg-[#333333] disabled:opacity-30 border border-[#111111] transition-colors"
                    aria-label="Send wire request"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 bg-white border border-[#111111] text-xs font-serif text-[#333333] space-y-1">
                <p className="font-wire font-bold uppercase tracking-wider text-[#111111]">
                  DISPATCH NOTICE:
                </p>
                <p>
                  Public Instagram Reels, YouTube Shorts, and TikTok video dispatches are retrieved across the wire. If a link has privacy restrictions, download the dispatch and submit via the file drop above.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !reelUrl.trim()}
                className="w-full newspaper-btn-primary font-wire text-xs font-bold uppercase tracking-widest py-3.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "INGESTING FROM WIRE..." : "COMMENCE WIRE INGESTION"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 3-Column Broadsheet Feature Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 pt-6 border-t-2 border-[#111111]">
        <div className="newspaper-card-sm p-4 text-center">
          <span className="font-wire text-xs font-bold uppercase tracking-wider block border-b border-[#111111] pb-1 mb-2">
            I. FULL-DURATION COVERAGE
          </span>
          <p className="font-serif text-xs text-[#333333] leading-relaxed">
            Sequential chunk processing ensures the entire reel is transcribed from 00:00 to the end, never stopping at music breaks or pauses.
          </p>
        </div>

        <div className="newspaper-card-sm p-4 text-center">
          <span className="font-wire text-xs font-bold uppercase tracking-wider block border-b border-[#111111] pb-1 mb-2">
            II. HINDI & CODE-SWITCHING
          </span>
          <p className="font-serif text-xs text-[#333333] leading-relaxed">
            Hindustani speech is guaranteed in Devanagari Hindi. Seamless multilingual detection captures Telugu, Tamil, and English transitions.
          </p>
        </div>

        <div className="newspaper-card-sm p-4 text-center">
          <span className="font-wire text-xs font-bold uppercase tracking-wider block border-b border-[#111111] pb-1 mb-2">
            III. TECHNICAL LEXICON
          </span>
          <p className="font-serif text-xs text-[#333333] leading-relaxed">
            High-precision vocabulary preservation guarantees Docker, Kubernetes, React, Spring Boot, and Python terms in clean print.
          </p>
        </div>
      </div>
    </div>
  );
}
