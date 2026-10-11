import { JobStatusResponse, TranscriptResult, EvaluationResult, InquiryResponse, InboxItem } from "./types";

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined" && window.location.hostname) {
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return "https://reelmind-hxh2.onrender.com";
    }
    return `http://${window.location.hostname}:8000`;
  }
  return "https://reelmind-hxh2.onrender.com";
}

export function getVideoMediaUrl(videoFilename?: string): string {
  if (!videoFilename) return "";
  return `${getApiBaseUrl()}/storage/uploads/${videoFilename}`;
}

export async function uploadVideoFile(file: File, language?: string): Promise<{ job_id: string; message: string }> {
  const formData = new FormData();
  formData.append("file", file);
  if (language && language !== "auto") {
    formData.append("language", language);
  }

  const res = await fetch(`${getApiBaseUrl()}/api/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Upload failed with status ${res.status}`);
  }

  return res.json();
}

export async function transcribeReelUrl(url: string, language?: string): Promise<{ job_id: string; message: string }> {
  const bodyPayload: Record<string, any> = { url };
  if (language && language !== "auto") {
    bodyPayload.language = language;
  }

  const res = await fetch(`${getApiBaseUrl()}/api/transcribe-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `URL transcription failed with status ${res.status}`);
  }

  return res.json();
}

export async function fetchJobStatus(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/status/${jobId}`);
  if (!res.ok) {
    throw new Error(`Failed to check job status: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchTranscription(jobId: string): Promise<TranscriptResult> {
  const res = await fetch(`${getApiBaseUrl()}/api/transcription/${jobId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch transcription: ${res.statusText}`);
  }
  return res.json();
}

export async function askQuestionAboutTranscript(jobId: string, question: string): Promise<InquiryResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/transcription/${jobId}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Inquiry failed with status ${res.status}`);
  }

  return res.json();
}

export async function fetchRecentTranscriptions(): Promise<any[]> {
  const res = await fetch(`${getApiBaseUrl()}/api/transcriptions`);
  if (!res.ok) {
    return [];
  }
  return res.json();
}

export async function compareEvaluation(
  groundTruth: string,
  transcriptionId?: string,
  hypothesis?: string
): Promise<EvaluationResult> {
  const res = await fetch(`${getApiBaseUrl()}/api/eval/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ground_truth: groundTruth,
      transcription_id: transcriptionId,
      hypothesis: hypothesis,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Evaluation comparison failed");
  }

  return res.json();
}

export async function fetchInboxItems(): Promise<InboxItem[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/inbox`);
    if (!res.ok) return [];
    return res.json();
  } catch (err) {
    console.warn("Could not fetch remote inbox items, falling back to local:", err);
    return [];
  }
}

export async function addInboxItem(payload: {
  url: string;
  clean_url?: string;
  title?: string;
  shared_text?: string;
}): Promise<{ item: InboxItem; is_duplicate: boolean; message: string }> {
  const res = await fetch(`${getApiBaseUrl()}/api/inbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to save inbox item: ${res.status}`);
  }

  return res.json();
}

export async function deleteInboxItem(id: string): Promise<boolean> {
  const res = await fetch(`${getApiBaseUrl()}/api/inbox/${id}`, {
    method: "DELETE",
  });
  return res.ok;
}

export async function transcribeInboxItem(id: string): Promise<{ job_id: string; status: string }> {
  const res = await fetch(`${getApiBaseUrl()}/api/inbox/${id}/transcribe`, {
    method: "POST",
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to start transcription for inbox item.");
  }

  return res.json();
}
