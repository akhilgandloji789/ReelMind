import html
from typing import Dict, Any, Optional
import jiwer
from backend.models.transcript import EvaluationResult

def compute_evaluation_metrics(
    ground_truth: str,
    hypothesis: str,
    latency_seconds: Optional[float] = None
) -> EvaluationResult:
    """
    Computes Word Error Rate (WER), Character Error Rate (CER),
    and generates an alignment diff comparing Ground Truth to Hypothesis.
    """
    gt_clean = ground_truth.strip()
    hyp_clean = hypothesis.strip()

    if not gt_clean:
        return EvaluationResult(
            wer=0.0 if not hyp_clean else 1.0,
            cer=0.0 if not hyp_clean else 1.0,
            ground_truth_words=0,
            hypothesis_words=len(hyp_clean.split()),
            substitutions=0,
            deletions=0,
            insertions=len(hyp_clean.split()),
            diff_html="<span class='text-muted'>Ground truth is empty.</span>",
            latency_seconds=latency_seconds
        )

    # Calculate WER and CER
    wer_score = float(jiwer.wer(gt_clean, hyp_clean))
    cer_score = float(jiwer.cer(gt_clean, hyp_clean))

    # Compute word-level alignments
    word_output = jiwer.process_words(gt_clean, hyp_clean)
    
    substitutions = word_output.substitutions
    deletions = word_output.deletions
    insertions = word_output.insertions
    hits = word_output.hits

    # Construct visual diff HTML
    diff_parts = []
    for chunk in word_output.alignments[0]:
        chunk_type = chunk.type
        ref_words = word_output.references[0][chunk.ref_start_idx:chunk.ref_end_idx]
        hyp_words = word_output.hypotheses[0][chunk.hyp_start_idx:chunk.hyp_end_idx]
        
        ref_str = html.escape(" ".join(ref_words))
        hyp_str = html.escape(" ".join(hyp_words))

        if chunk_type == "equal":
            diff_parts.append(f"<span class='text-emerald-400 font-medium'>{hyp_str}</span>")
        elif chunk_type == "substitute":
            diff_parts.append(
                f"<span class='bg-amber-950/60 border border-amber-600/40 text-amber-200 px-1.5 py-0.5 rounded text-sm' "
                f"title='Ground truth: {ref_str}'>{hyp_str} "
                f"<span class='line-through text-amber-400/60 text-xs'>({ref_str})</span></span>"
            )
        elif chunk_type == "delete":
            diff_parts.append(
                f"<span class='bg-rose-950/60 border border-rose-600/40 text-rose-300 line-through px-1.5 py-0.5 rounded text-sm' "
                f"title='Missing word'>{ref_str}</span>"
            )
        elif chunk_type == "insert":
            diff_parts.append(
                f"<span class='bg-blue-950/60 border border-blue-600/40 text-blue-200 px-1.5 py-0.5 rounded text-sm' "
                f"title='Extra word'>+{hyp_str}</span>"
            )

    diff_html = " ".join(diff_parts)

    return EvaluationResult(
        wer=round(wer_score, 4),
        cer=round(cer_score, 4),
        ground_truth_words=len(gt_clean.split()),
        hypothesis_words=len(hyp_clean.split()),
        substitutions=substitutions,
        deletions=deletions,
        insertions=insertions,
        diff_html=diff_html,
        latency_seconds=round(latency_seconds, 2) if latency_seconds is not None else None
    )
