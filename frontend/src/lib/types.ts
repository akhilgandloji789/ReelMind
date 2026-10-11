export interface Segment {
  id: number;
  start: number;
  end: number;
  language: string;
  text: string;
  translation?: string;
}

export interface SourceInfo {
  type: "upload" | "url";
  filename?: string;
  url?: string;
}

export interface TranscriptResult {
  id: string;
  source: SourceInfo;
  video_filename?: string;
  duration: number;
  languages: string[];
  segments: Segment[];
  raw_transcript: string;
  corrected_transcript: string;
  english_transcript?: string;
  headline?: string;
  summary_bullets?: string[];
  created_at: string;
  status: "queued" | "validating" | "downloading_url" | "extracting_audio" | "normalizing_audio" | "transcribing" | "correcting" | "completed" | "failed";
  stage_message: string;
  progress_percent: number;
  error?: string | null;
}

export interface JobStatusResponse {
  id: string;
  status: string;
  stage_message: string;
  progress_percent: number;
  error?: string | null;
  result?: TranscriptResult | null;
}

export interface InquiryCitation {
  label: string;
  seconds: number;
}

export interface InquiryResponse {
  answer: string;
  citations: InquiryCitation[];
}

export interface EvaluationResult {
  wer: number;
  cer: number;
  ground_truth_words: number;
  hypothesis_words: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  diff_html: string;
  latency_seconds?: number | null;
}

export interface InboxItem {
  id: string;
  url: string;
  clean_url?: string;
  title?: string;
  shared_text?: string;
  created_at: string;
  status: "saved" | "transcribing" | "completed";
  job_id?: string;
}
