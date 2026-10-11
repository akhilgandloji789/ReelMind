"use client";

import React, { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "../components/Header";
import { VideoUploader } from "../components/VideoUploader";
import { ProcessingTracker } from "../components/ProcessingTracker";
import { VideoPlayer, VideoPlayerRef } from "../components/VideoPlayer";
import { TranscriptView } from "../components/TranscriptView";
import { TranscriptToolbar, ViewMode } from "../components/TranscriptToolbar";
import { InquiryDesk } from "../components/InquiryDesk";
import { TranscriptResult } from "../lib/types";
import { getVideoMediaUrl, fetchJobStatus, fetchTranscription } from "../lib/api";

function HomeContent() {
  const searchParams = useSearchParams();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null);
  const [useCorrected, setUseCorrected] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("dual");
  const [currentTime, setCurrentTime] = useState(0);

  const playerRef = useRef<VideoPlayerRef>(null);

  useEffect(() => {
    const urlJobId = searchParams.get("jobId");
    if (urlJobId && !activeJobId && !transcript) {
      setActiveJobId(urlJobId);
      fetchJobStatus(urlJobId)
        .then((res) => {
          if (res.status === "completed") {
            if (res.result) {
              setTranscript(res.result);
            } else {
              fetchTranscription(urlJobId).then(setTranscript).catch(() => {});
            }
          }
        })
        .catch(() => {});
    }
  }, [searchParams, activeJobId, transcript]);

  const handleJobStarted = useCallback((jobId: string) => {
    setActiveJobId(jobId);
    setTranscript(null);
  }, []);

  const handleJobCompleted = useCallback((result: TranscriptResult) => {
    setTranscript(result);
  }, []);

  const handleReset = useCallback(() => {
    setActiveJobId(null);
    setTranscript(null);
    setCurrentTime(0);
    setViewMode("dual");
  }, []);

  const handleSeek = useCallback((seconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f4ee] text-[#111111]">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!activeJobId && !transcript && (
          <VideoUploader onJobStarted={handleJobStarted} />
        )}

        {activeJobId && !transcript && (
          <ProcessingTracker
            jobId={activeJobId}
            onCompleted={handleJobCompleted}
            onReset={handleReset}
          />
        )}

        {transcript && (
          <div className="space-y-6">
            <TranscriptToolbar
              transcript={transcript}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              useCorrected={useCorrected}
              onToggleCorrected={setUseCorrected}
              onReset={handleReset}
            />

            {/* Main Broadsheet Layout: Video Player + Transcript */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Moving Picture Player */}
              <div className="lg:col-span-5 xl:col-span-5 space-y-6">
                <VideoPlayer
                  ref={playerRef}
                  src={getVideoMediaUrl(transcript.video_filename)}
                  onTimeUpdate={setCurrentTime}
                />
              </div>

              {/* Right Column: Broadsheet Transcript */}
              <div className="lg:col-span-7 xl:col-span-7">
                <TranscriptView
                  transcript={transcript}
                  viewMode={viewMode}
                  useCorrected={useCorrected}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                />
              </div>
            </div>

            {/* Telegraph Inquiry Desk (Ask ReelMind in ANY language) */}
            <div className="pt-2">
              <InquiryDesk
                jobId={transcript.id}
                onSeek={handleSeek}
              />
            </div>
          </div>
        )}
      </main>

      <footer className="border-t-2 border-[#111111] bg-[#fbf9f4] py-8 text-center text-xs font-wire uppercase tracking-wider text-[#555555] mt-12 no-print">
        <div className="max-w-4xl mx-auto px-4 space-y-2">
          <p className="font-bold text-[#111111]">
            THE REELMIND CHRONICLE • ESTABLISHED 2026 • ALL SPOKEN DISPATCHES PRINTED VERBATIM
          </p>
          <p className="text-[11px] text-[#777777]">
            DUAL-TRACK ORIGINAL SCRIPT &amp; UNIVERSAL WIRE • GROQ WHISPER-LARGE-V3-TURBO &amp; MULTILINGUAL INTELLIGENCE
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f4ee]" />}>
      <HomeContent />
    </Suspense>
  );
}
