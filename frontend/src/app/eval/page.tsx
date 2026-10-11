"use client";

import React, { useState, useEffect } from "react";
import { Header } from "../../components/Header";
import { compareEvaluation, fetchRecentTranscriptions } from "../../lib/api";
import { EvaluationResult } from "../../lib/types";
import { FileCheck, AlertTriangle, ArrowRight, BarChart3, RefreshCw } from "lucide-react";

export default function EvalPage() {
  const [groundTruth, setGroundTruth] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [selectedTranscriptionId, setSelectedTranscriptionId] = useState("");
  const [recentTranscripts, setRecentTranscripts] = useState<any[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentTranscriptions().then(setRecentTranscripts).catch(() => {});
  }, []);

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groundTruth.trim()) {
      setErrorMessage("Please enter a verified ground truth manuscript.");
      return;
    }

    if (!selectedTranscriptionId && !hypothesis.trim()) {
      setErrorMessage("Please select an archived dispatch or enter hypothesis text.");
      return;
    }

    setIsEvaluating(true);
    setErrorMessage(null);

    try {
      const data = await compareEvaluation(
        groundTruth.trim(),
        selectedTranscriptionId || undefined,
        hypothesis.trim() || undefined
      );
      setResult(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Evaluation audit failed");
    } finally {
      setIsEvaluating(false);
    }
  };

  const getWerStamp = (wer: number) => {
    const pct = (wer * 100).toFixed(1);
    if (wer <= 0.05) {
      return {
        label: `${pct}% WER • APPROVED (SUPERIOR)`,
        className: "bg-[#111111] text-white border-2 border-[#111111]",
      };
    }
    if (wer <= 0.15) {
      return {
        label: `${pct}% WER • ACCEPTABLE QUALITY`,
        className: "bg-[#fef9c3] text-[#111111] border-2 border-[#111111]",
      };
    }
    return {
      label: `${pct}% WER • REVISION REQUIRED`,
      className: "bg-white text-red-700 border-2 border-red-700",
    };
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f4ee] text-[#111111]">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Desk Header Banner */}
        <div className="mb-8 border-b-2 border-[#111111] pb-6">
          <div className="inline-block border border-[#111111] px-3 py-1 bg-[#111111] text-white font-wire text-xs uppercase font-bold tracking-widest mb-3">
            ★ PROOFREADER&apos;S DESK • BENCHMARK AUDIT ★
          </div>
          <h1 className="text-3xl sm:text-4xl font-headline font-black uppercase tracking-tight text-[#111111]">
            Editorial Accuracy Benchmark
          </h1>
          <p className="font-serif italic text-base text-[#333333] mt-2 max-w-3xl leading-relaxed">
            Audit verbatim transcripts against ground-truth manuscripts. Calculates Word Error Rate (WER), Character Error Rate (CER), and renders typesetter red-pen correction marks.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Form: Inputs */}
          <form
            onSubmit={handleEvaluate}
            className="lg:col-span-6 space-y-5 newspaper-box p-6 sm:p-7"
          >
            <div className="border-b-2 border-[#111111] pb-2">
              <span className="font-wire text-xs uppercase font-bold tracking-wider text-[#111111]">
                FORM I: AUDIT SPECIFICATION
              </span>
            </div>

            {errorMessage && (
              <div className="p-3 bg-white border-2 border-red-700 text-red-900 font-wire text-xs">
                {errorMessage}
              </div>
            )}

            {/* Ground Truth Textarea */}
            <div>
              <label className="block font-wire text-xs font-bold uppercase tracking-wider text-[#111111] mb-2">
                1. VERIFIED MANUSCRIPT (GROUND TRUTH)
              </label>
              <textarea
                rows={4}
                placeholder="Enter verified verbatim speech text..."
                value={groundTruth}
                onChange={(e) => setGroundTruth(e.target.value)}
                className="w-full p-3 bg-white border-2 border-[#111111] font-serif text-sm text-[#111111] placeholder-[#888888] focus:outline-none focus:ring-1 focus:ring-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              />
            </div>

            {/* Archived Transcription Selector */}
            {recentTranscripts.length > 0 && (
              <div>
                <label className="block font-wire text-xs font-bold uppercase tracking-wider text-[#111111] mb-2">
                  2. SELECT RECENT ARCHIVED DISPATCH
                </label>
                <select
                  value={selectedTranscriptionId}
                  onChange={(e) => {
                    setSelectedTranscriptionId(e.target.value);
                    if (e.target.value) setHypothesis("");
                  }}
                  className="w-full p-2.5 bg-white border-2 border-[#111111] font-wire text-xs font-bold text-[#111111] focus:outline-none cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  <option value="">-- Or enter hypothesis text below --</option>
                  {recentTranscripts.map((t) => (
                    <option key={t.id} value={t.id}>
                      Dispatch {t.id.slice(0, 8)} ({t.duration?.toFixed(1) || 0}s • {t.languages?.join(", ") || "Multi"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Manual Hypothesis Textarea */}
            <div>
              <label className="block font-wire text-xs font-bold uppercase tracking-wider text-[#111111] mb-2">
                3. OR ENTER HYPOTHESIS DISPATCH TEXT
              </label>
              <textarea
                rows={4}
                placeholder="Paste ReelMind generated transcript to compare..."
                value={hypothesis}
                onChange={(e) => {
                  setHypothesis(e.target.value);
                  if (e.target.value) setSelectedTranscriptionId("");
                }}
                disabled={Boolean(selectedTranscriptionId)}
                className="w-full p-3 bg-white border-2 border-[#111111] font-serif text-sm text-[#111111] placeholder-[#888888] focus:outline-none focus:ring-1 focus:ring-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-40"
              />
            </div>

            <button
              type="submit"
              disabled={isEvaluating}
              className="w-full newspaper-btn-primary font-wire text-xs font-bold uppercase tracking-widest py-3 cursor-pointer disabled:opacity-50"
            >
              {isEvaluating ? "AUDITING DISPATCH..." : "EXECUTE ACCURACY AUDIT"}
            </button>
          </form>

          {/* Right Column: Audit Results Report */}
          <div className="lg:col-span-6 space-y-6">
            {result ? (
              <div className="newspaper-box p-6 space-y-6">
                {/* Result Masthead */}
                <div className="border-b-2 border-[#111111] pb-3 flex items-center justify-between">
                  <span className="font-wire text-xs font-bold uppercase tracking-wider text-[#111111]">
                    AUDIT REPORT • VERIFICATION SLIP
                  </span>
                  <span className="font-wire text-[10px] uppercase text-[#666666]">
                    PROOFED
                  </span>
                </div>

                {/* Accuracy Verdict Stamp */}
                <div className="text-center py-2">
                  <span
                    className={`inline-block font-wire text-xs uppercase font-black px-4 py-2 tracking-widest shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
                      getWerStamp(result.wer).className
                    }`}
                  >
                    {getWerStamp(result.wer).label}
                  </span>
                </div>

                {/* Broadsheet Statistics Table */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t-2 border-b-2 border-[#111111] py-4 bg-white p-3">
                  <div className="border border-[#111111] p-2.5 text-center">
                    <span className="font-wire text-[10px] uppercase font-bold text-[#555555] block">
                      WORD ERROR RATE
                    </span>
                    <span className="font-wire text-xl font-black text-[#111111]">
                      {(result.wer * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="border border-[#111111] p-2.5 text-center">
                    <span className="font-wire text-[10px] uppercase font-bold text-[#555555] block">
                      CHAR ERROR RATE
                    </span>
                    <span className="font-wire text-xl font-black text-[#111111]">
                      {(result.cer * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="border border-[#111111] p-2.5 text-center">
                    <span className="font-wire text-[10px] uppercase font-bold text-[#555555] block">
                      SUBSTITUTIONS
                    </span>
                    <span className="font-wire text-xl font-black text-[#111111]">
                      {result.substitutions}
                    </span>
                  </div>

                  <div className="border border-[#111111] p-2.5 text-center">
                    <span className="font-wire text-[10px] uppercase font-bold text-[#555555] block">
                      DELETIONS
                    </span>
                    <span className="font-wire text-xl font-black text-[#111111]">
                      {result.deletions}
                    </span>
                  </div>

                  <div className="border border-[#111111] p-2.5 text-center">
                    <span className="font-wire text-[10px] uppercase font-bold text-[#555555] block">
                      INSERTIONS
                    </span>
                    <span className="font-wire text-xl font-black text-[#111111]">
                      {result.insertions}
                    </span>
                  </div>

                  <div className="border border-[#111111] p-2.5 text-center">
                    <span className="font-wire text-[10px] uppercase font-bold text-[#555555] block">
                      TOTAL WORDS
                    </span>
                    <span className="font-wire text-xl font-black text-[#111111]">
                      {result.ground_truth_words}
                    </span>
                  </div>
                </div>

                {/* Typesetter's Markup / Diff View */}
                {result.diff_html && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-wire text-xs font-bold uppercase tracking-wider text-[#111111]">
                        TYPESETTER MARKUP (RED-PEN AUDIT)
                      </span>
                      <span className="font-wire text-[10px] text-[#555555]">
                        <span className="text-red-700 font-bold">RED</span> = CORRECTION
                      </span>
                    </div>

                    <div
                      className="p-4 bg-white border-2 border-[#111111] font-serif text-sm leading-relaxed text-[#111111] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      dangerouslySetInnerHTML={{ __html: result.diff_html }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="newspaper-box p-12 text-center text-[#555555]">
                <FileCheck className="w-10 h-10 mx-auto mb-3 opacity-30 text-[#111111]" />
                <h3 className="font-headline uppercase text-lg font-bold text-[#111111]">
                  AWAITING MANUSCRIPT
                </h3>
                <p className="font-serif italic text-sm mt-1 max-w-sm mx-auto">
                  Provide ground truth text and dispatch on the left to generate the proofreader audit certificate.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t-2 border-[#111111] bg-[#fbf9f4] py-6 text-center text-xs font-wire uppercase tracking-wider text-[#555555] no-print mt-12">
        <p>THE PROOFREADER&apos;S DESK • REELMIND CHRONICLE BENCHMARK FACILITY</p>
      </footer>
    </div>
  );
}
