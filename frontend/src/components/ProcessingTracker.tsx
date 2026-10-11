"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { fetchJobStatus, fetchTranscription } from "../lib/api";
import { JobStatusResponse, TranscriptResult } from "../lib/types";

interface ProcessingTrackerProps {
  jobId: string;
  onCompleted: (result: TranscriptResult) => void;
  onReset: () => void;
}

interface StageItem {
  id: string;
  label: string;
  stageKey: string;
}

const STAGES: StageItem[] = [
  { id: "audit", label: "I. FORMAT AUDIT & INGESTION", stageKey: "validating" },
  { id: "extract", label: "II. ACOUSTIC EXTRACTION & CHUNKING", stageKey: "extracting_audio" },
  { id: "transcribe", label: "III. WHISPER ROTARY TRANSCRIPTION", stageKey: "transcribing" },
  { id: "proofread", label: "IV. GEMINI PROOFREADER & CODE-SWITCHING", stageKey: "correcting" },
  { id: "finalize", label: "V. FINAL IMPRESSION & TYPESET ARCHIVE", stageKey: "completed" },
];

export function ProcessingTracker({ jobId, onCompleted, onReset }: ProcessingTrackerProps) {
  const [jobState, setJobState] = useState<JobStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onCompletedRef = React.useRef(onCompleted);

  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  useEffect(() => {
    let isMounted = true;
    let isFinished = false;

    const checkStatus = async () => {
      if (isFinished) return;
      try {
        const data = await fetchJobStatus(jobId);
        if (!isMounted || isFinished) return;
        setJobState(data);

        if (data.status === "completed") {
          isFinished = true;
          let finalResult = data.result;
          if (!finalResult) {
            try {
              finalResult = await fetchTranscription(jobId);
            } catch (fetchErr) {
              console.warn("Could not fetch full transcription payload:", fetchErr);
            }
          }
          if (finalResult && isMounted) {
            onCompletedRef.current(finalResult);
          }
        } else if (data.status === "failed") {
          isFinished = true;
          setError(data.error || data.stage_message || "Processing failed.");
        }
      } catch (err: any) {
        if (!isMounted) return;
        // Don't kill polling on transient network glitch, show warn
        console.warn("Status poll error:", err);
      }
    };

    // Immediate first check
    checkStatus();
    const interval = setInterval(checkStatus, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [jobId]);

  const currentStatus = jobState?.status || "queued";
  const progressPercent = jobState?.progress_percent || 15;

  const getStageStatus = (stageKey: string) => {
    const order = [
      "queued",
      "downloading_url",
      "validating",
      "extracting_audio",
      "normalizing_audio",
      "transcribing",
      "correcting",
      "completed",
    ];
    const currentIndex = order.indexOf(currentStatus);
    const targetIndex = order.indexOf(stageKey);

    if (currentStatus === "failed") return "failed";
    if (currentIndex > targetIndex) return "completed";
    if (currentIndex === targetIndex) return "active";
    return "pending";
  };

  const renderAsciiGauge = (percent: number) => {
    const totalBlocks = 20;
    const filled = Math.min(totalBlocks, Math.max(1, Math.round((percent / 100) * totalBlocks)));
    const empty = totalBlocks - filled;
    return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="newspaper-box p-6 sm:p-8">
        {/* Top Header Stamp */}
        <div className="flex items-center justify-between border-b-2 border-[#111111] pb-3 mb-6">
          <div className="flex items-center gap-2">
            <span className="font-wire text-xs font-bold uppercase tracking-widest text-[#111111]">
              TELEGRAPH BUREAU • JOB ID:
            </span>
            <span className="font-wire text-xs font-bold bg-[#111111] text-white px-2 py-0.5">
              {jobId.slice(0, 8)}
            </span>
          </div>
          <span className="font-wire text-[11px] uppercase tracking-wider text-[#555555]">
            ROTARY PRESS RUNNING
          </span>
        </div>

        {/* Central Linotype Headline */}
        <div className="text-center mb-6">
          <h3 className="text-2xl sm:text-3xl font-headline font-black text-[#111111] uppercase tracking-tight">
            Typesetting in Progress
          </h3>
          <p className="font-serif italic text-sm text-[#444444] mt-1">
            {jobState?.stage_message || "The rotary presses are preparing verbatim text blocks..."}
          </p>

          {/* Mechanical ASCII Gauge */}
          <div className="mt-4 p-3 bg-white border-2 border-[#111111] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between text-xs font-wire font-bold uppercase mb-1">
              <span>PRESS PROGRESSION GAUGE</span>
              <span>{progressPercent}% COMPLETE</span>
            </div>
            <div className="font-wire text-base tracking-widest text-[#111111] select-none overflow-hidden text-center py-1">
              {renderAsciiGauge(progressPercent)}
            </div>
          </div>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="mb-6 p-4 bg-white border-2 border-red-700 text-red-900 shadow-[3px_3px_0px_0px_rgba(185,28,28,1)]">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-wire uppercase font-bold text-xs tracking-wider text-red-700">
                  STOP THE PRESSES — PRINT FAILURE
                </p>
                <p className="font-serif text-sm mt-0.5">{error}</p>
                <div className="mt-3 pt-2 border-t border-red-200 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onReset}
                    className="font-wire text-xs font-bold uppercase tracking-wider bg-red-700 text-white px-3 py-1.5 hover:bg-black transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Upload Video File Directly / Try Another</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stage Timeline */}
        <div className="space-y-2 border-t-2 border-b-2 border-[#111111] py-4 my-6 bg-white p-4">
          {STAGES.map((stage) => {
            const status = getStageStatus(stage.stageKey);
            return (
              <div
                key={stage.id}
                className={`flex items-center justify-between p-2 border transition-colors ${
                  status === "active"
                    ? "bg-[#fef9c3] border-[#111111] font-bold"
                    : status === "completed"
                    ? "bg-[#f6f4ee] border-[#cccccc] text-[#111111]"
                    : "bg-transparent border-transparent text-[#777777]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-wire text-xs font-bold w-6 text-center">
                    {status === "completed" ? "✓" : status === "active" ? "▶" : "·"}
                  </span>
                  <span className="font-wire text-xs uppercase tracking-wider">
                    {stage.label}
                  </span>
                </div>
                <span className="font-wire text-[10px] uppercase font-bold px-2 py-0.5 border border-[#111111]">
                  {status === "completed"
                    ? "TYPESET"
                    : status === "active"
                    ? "IN PRINT"
                    : "QUEUED"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Abort / Reset Button */}
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onReset}
            className="newspaper-btn-outline font-wire text-xs font-bold uppercase tracking-widest px-5 py-2.5 inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Halt the Presses (Cancel)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
