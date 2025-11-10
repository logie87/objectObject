"""
cc_alignment_pipeline.py

Pipeline purpose:
- Load Canadian curriculum core competency directives (JSON)
- Extract text from teacher course materials (units / worksheets; PDF scanned or searchable, or .txt)
- For each worksheet, compile an alignment prompt with all directives
- Call local LLM (phi3-mini via llama-cpp-python) N times to obtain multiple candidate JSON evaluations
- Compile a consensus prompt from the multiple candidate responses ("democratic" consolidation)
- Run consensus prompt to get final per-worksheet directive alignment scores + recommendations
- Compile an API-ready JSON data structure:
    - matrix: worksheets x directives alignment score table
    - details: per worksheet per directive full evaluation
    - unit_summary: per unit averages + aggregated recommendations

Final output schema (top-level):
{
  "meta": {
     "directives": [directive_ids...],
     "worksheets": [worksheet_ids...],
     "units": [unit_ids...],
     "generations": N
  },
  "matrix": {
     "directives": [...],
     "worksheets": [...],
     "scores": [[int]]   # rows = worksheets, columns = directives
  },
  "details": {
     "worksheet_id": {
        "directive_id": {
           "alignment_score": int 0-100,
           "evidence": str,
           "recommendation": str
        }, ...
     }, ...
  },
  "unit_summary": {
     "unit_id": {
        "directive_id": {
           "average_score": int,
           "top_recommendations": [str, ... up to 3]
        }, ...
     }, ...
  }
}

CLI Usage:
  python cc_alignment_pipeline.py \
      --directives-json ./sample_data/CCs/math.json \
      --coursework ./data/curriculum/Math8 \
      --generations 3 \
      --out output_cc_alignment.json
"""

import argparse
import json
import os
import re
import logging
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Any, Tuple
from collections import defaultdict, Counter

from PyPDF2 import PdfReader
from pdf2image import convert_from_path
import pytesseract
from PIL import Image

from llm import run_llm
from logger import SimpleAppLogger

# ---------------- Configuration ----------------

BASE_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

logger = SimpleAppLogger(
    str(LOG_DIR), "cc_alignment_pipeline", logging.INFO
).get_logger()

# Expected schema per directive (single evaluation)
DIRECTIVE_EVAL_KEYS = ["alignment_score", "evidence", "recommendation"]

# ---------------- Data Classes ----------------


@dataclass
class Directive:
    id: str
    title: str
    description: str
    grade_band: str
    category: str
    raw: Dict[str, Any]


@dataclass
class WorksheetMeta:
    worksheet_id: str
    title: str
    unit_id: str
    path: str
    text: str


# ---------------- JSON Helpers ----------------


def safe_load_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(obj: Any, path: Path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)


# ---------------- PDF / Text Extraction ----------------


def extract_text_from_searchable_pdf(path: Path) -> str:
    chunks = []
    try:
        reader = PdfReader(str(path))
        for page in reader.pages:
            try:
                txt = page.extract_text() or ""
            except Exception:
                txt = ""
            chunks.append(txt)
    except Exception as e:
        logger.warning(f"PyPDF2 failed for {path}: {e}")
    return "\n".join(chunks).strip()


def ocr_pdf(path: Path, dpi=300, pages_limit=None) -> str:
    ocr_chunks = []
    try:
        images = convert_from_path(str(path), dpi=dpi)
        if pages_limit:
            images = images[:pages_limit]
        for img in images:
            txt = pytesseract.image_to_string(img)
            ocr_chunks.append(txt)
    except Exception as e:
        logger.warning(f"OCR failed for {path}: {e}")
    return "\n".join(ocr_chunks).strip()


def extract_text_from_pdf(path: Path, ocr_if_empty=True) -> str:
    text = extract_text_from_searchable_pdf(path)
    if (not text or len(text) < 50) and ocr_if_empty:
        logger.info(f"OCR fallback for scanned PDF: {path}")
        text = ocr_pdf(path)
    return text


def extract_text_generic(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        return extract_text_from_pdf(path)
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""


# ---------------- Directive Loading ----------------


def load_directives(directives_json: Path) -> List[Directive]:
    raw = safe_load_json(directives_json)
    directives: List[Directive] = []
    # Accept multiple structural variants:
    # Option A: {"directives":[{id,title,description,...}]}
    # Option B: curriculum schema like sample math CC
    if "directives" in raw and isinstance(raw["directives"], list):
        for d in raw["directives"]:
            directives.append(
                Directive(
                    id=str(d.get("id") or d.get("code") or d.get("title")),
                    title=str(d.get("title") or d.get("id")),
                    description=str(d.get("description") or ""),
                    grade_band=str(d.get("grade_band") or d.get("grades") or ""),
                    category=str(d.get("category") or ""),
                    raw=d,
                )
            )
        return directives

    # Parse sample BC math style for categories and grade bands
    subject = raw.get("subject", "Unknown Subject")
    gbands = raw.get("grade_bands", {})
    for band_key, band_val in gbands.items():
        categories = band_val.get("criteria_categories", {})
        for cat_key, cat_val in categories.items():
            cat_desc = cat_val.get("description", "")
            grades_dict = cat_val.get("grades", {})
            # Flatten grade-specific statements
            for gk, statements in grades_dict.items():
                for idx, stmt in enumerate(statements):
                    did = f"{cat_key}_{gk}_{idx}".lower()
                    directives.append(
                        Directive(
                            id=did,
                            title=f"{subject}:{cat_key}:{gk}",
                            description=stmt,
                            grade_band=gk,
                            category=cat_key,
                            raw={"statement": stmt, "category_desc": cat_desc},
                        )
                    )
    return directives


# ---------------- Coursework Collection ----------------


def collect_course_materials(coursework_path: Path) -> List[WorksheetMeta]:
    """
    Accepts:
      - A directory containing units (subdirectories) each with worksheets
      - A directory containing worksheets directly (no subdirectories)
      - A single worksheet file
    Returns list[WorksheetMeta]
    """
    worksheets: List[WorksheetMeta] = []
    if coursework_path.is_file():
        if coursework_path.suffix.lower() not in (".pdf", ".txt"):
            return worksheets
        wid = coursework_path.stem
        unit_id = "single_unit"
        text = extract_text_generic(coursework_path)
        worksheets.append(
            WorksheetMeta(
                worksheet_id=wid,
                title=coursework_path.name,
                unit_id=unit_id,
                path=str(coursework_path),
                text=text,
            )
        )
        return worksheets

    # Directory logic
    has_subdirs = any(p.is_dir() for p in coursework_path.iterdir())
    if has_subdirs:
        for unit_dir in sorted(p for p in coursework_path.iterdir() if p.is_dir()):
            unit_id = unit_dir.name
            for f in sorted(unit_dir.iterdir()):
                if f.is_file() and f.suffix.lower() in (".pdf", ".txt"):
                    wid = f"{unit_id}_{f.stem}"
                    text = extract_text_generic(f)
                    worksheets.append(
                        WorksheetMeta(
                            worksheet_id=wid,
                            title=f.name,
                            unit_id=unit_id,
                            path=str(f),
                            text=text,
                        )
                    )
    else:
        unit_id = coursework_path.name
        for f in sorted(coursework_path.iterdir()):
            if f.is_file() and f.suffix.lower() in (".pdf", ".txt"):
                wid = f"{unit_id}_{f.stem}"
                text = extract_text_generic(f)
                worksheets.append(
                    WorksheetMeta(
                        worksheet_id=wid,
                        title=f.name,
                        unit_id=unit_id,
                        path=str(f),
                        text=text,
                    )
                )
    return worksheets


# ---------------- JSON Extraction ----------------


def extract_first_json(text: str) -> Tuple[Any, str]:
    txt = text.strip()
    # Direct attempt
    try:
        obj = json.loads(txt)
        return obj, txt
    except Exception:
        pass
    # Braces scan
    brace_stack = []
    start = None
    for i, ch in enumerate(txt):
        if ch == "{":
            if start is None:
                start = i
            brace_stack.append(i)
        elif ch == "}":
            if brace_stack:
                brace_stack.pop()
                if not brace_stack and start is not None:
                    candidate = txt[start : i + 1]
                    try:
                        obj = json.loads(candidate)
                        return obj, candidate
                    except Exception:
                        start = None
    # Also allow a top-level array
    if "[" in txt and "]" in txt:
        arr_start = txt.find("[")
        arr_end = txt.rfind("]")
        candidate = txt[arr_start : arr_end + 1]
        try:
            obj = json.loads(candidate)
            return obj, candidate
        except Exception:
            pass
    return {}, ""


# ---------------- Prompt Templates ----------------

INITIAL_ALIGNMENT_PROMPT = """
You are a Canadian curriculum alignment analyst.
Given a worksheet TEXT and a list of DIRECTIVES (curriculum competency statements),
produce a JSON array. Each array element corresponds to one directive and must have:

{
  "id": "<directive_id>",
  "alignment_score": <integer 0-100>,
  "evidence": "<concise (<=160 chars) justification referencing worksheet themes or tasks>",
  "recommendation": "<concise (<=160 chars) actionable improvement to better align>"
}

Rules:
- alignment_score: judge how strongly the worksheet supports or evidences the directive.
- Use only integer scores 0-100.
- evidence must NOT invent content absent from text.
- recommendation must be actionable and specific.
- Return ONLY valid JSON array. No extra commentary.

WORKSHEET:
ID: {worksheet_id}
Title: {worksheet_title}
Text (truncated):
{worksheet_text}

DIRECTIVES:
{directives_block}

Produce JSON array now.
"""

CONSENSUS_PROMPT_TEMPLATE = """
You are consolidating multiple candidate JSON evaluations for worksheet alignment to curriculum directives.

Worksheet ID: {worksheet_id}
Title: {worksheet_title}

DIRECTIVES LIST (reference):
{directives_block}

CANDIDATE RESPONSES (each is a JSON array of directive evaluations):
{candidate_json_blobs}

TASK:
Produce ONE consolidated JSON array (same schema) where:
- alignment_score is a reasoned consensus (e.g., median or trimmed mean) and coherent across directives.
- Select the most precise evidence (avoid repetition).
- Recommendation should combine best actionable suggestion (do not merge conflicting ones; pick most practical).
- Keep evidence and recommendation <=160 chars each.
- Maintain original directive ids.
Return ONLY the JSON array.
"""

# FINAL_API_PROMPT_TEMPLATE = """
# You are preparing an API payload summarizing curriculum alignment.

# Input: CONSENSUS EVALUATIONS for ALL worksheets (JSON mapping worksheet_id -> [directive evaluations]) and directives list.

# You must output a JSON object with this schema:

# {
#   "meta": {
#      "directives": [ ...directive_ids ],
#      "worksheets": [ ...worksheet_ids ],
#      "units": [ ...unit_ids ],
#      "generations": <int>
#   },
#   "matrix": {
#      "directives": [...],
#      "worksheets": [...],
#      "scores": [[int]]  // rows correspond to worksheets in same order
#   },
#   "details": {
#      "worksheet_id": {
#         "directive_id": {
#           "alignment_score": int,
#           "evidence": str,
#           "recommendation": str
#         }
#      }
#   },
#   "unit_summary": {
#      "unit_id": {
#         "directive_id": {
#            "average_score": int,
#            "top_recommendations": [str, ... up to 3]
#         }
#      }
#   }
# }

# Constraints:
# - average_score must be integer (rounded).
# - top_recommendations: choose top distinct actionable recommendations seen in that unit for the directive (up to 3).
# - Do not hallucinate directives or worksheets.

# DATA:
# Directives IDs:
# {directive_ids}

# Worksheet Consensus Map (JSON):
# {consensus_map_json}

# Units Map (worksheet_id -> unit_id):
# {worksheet_unit_map}

# Return ONLY the JSON object.
# """

# ---------------- Prompt Compilation ----------------


def compile_initial_prompt(
    worksheet: WorksheetMeta, directives: List[Directive], max_chars=3000
) -> str:
    directives_block = []
    for d in directives:
        directives_block.append(
            f"- {d.id}: {d.description} (grade_band={d.grade_band}, category={d.category})"
        )
    wtext = (worksheet.text or "")[:max_chars]
    return INITIAL_ALIGNMENT_PROMPT.format(
        worksheet_id=worksheet.worksheet_id,
        worksheet_title=worksheet.title,
        worksheet_text=wtext,
        directives_block="\n".join(directives_block),
    )


def compile_consensus_prompt(
    worksheet: WorksheetMeta,
    directives: List[Directive],
    candidate_json_blobs: List[str],
) -> str:
    directives_block = "\n".join([f"- {d.id}: {d.description}" for d in directives])
    combined_blob = "\n\n".join(candidate_json_blobs)
    return CONSENSUS_PROMPT_TEMPLATE.format(
        worksheet_id=worksheet.worksheet_id,
        worksheet_title=worksheet.title,
        directives_block=directives_block,
        candidate_json_blobs=combined_blob,
    )


# def compile_final_api_prompt(
#     consensus_map: Dict[str, List[Dict[str, Any]]],
#     directives: List[Directive],
#     worksheets: List[WorksheetMeta],
#     generations: int,
# ) -> str:
#     directive_ids = [d.id for d in directives]
#     consensus_map_json = json.dumps(consensus_map, ensure_ascii=False, indent=2)
#     worksheet_unit_map = {w.worksheet_id: w.unit_id for w in worksheets}
#     return FINAL_API_PROMPT_TEMPLATE.format(
#         directive_ids=", ".join(directive_ids),
#         consensus_map_json=consensus_map_json,
#         worksheet_unit_map=json.dumps(worksheet_unit_map, ensure_ascii=False, indent=2),
#     )


# ---------------- Evaluation Normalization ----------------


def normalize_directive_eval(entry: Dict[str, Any]) -> Dict[str, Any]:
    norm = {}
    # id
    norm_id = str(entry.get("id", "")).strip()
    norm["id"] = norm_id
    # alignment_score
    try:
        score = int(round(float(entry.get("alignment_score", 0))))
    except Exception:
        digits = re.findall(r"\d+", str(entry.get("alignment_score", "")))
        score = int(digits[0]) if digits else 0
    score = max(0, min(100, score))
    norm["alignment_score"] = score
    # evidence
    ev = str(entry.get("evidence", "")).strip()
    norm["evidence"] = (" ".join(ev.split()))[:160]
    # recommendation
    rec = str(entry.get("recommendation", "")).strip()
    norm["recommendation"] = (" ".join(rec.split()))[:160]
    return norm


def normalize_response_array(raw: Any) -> List[Dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out = []
    for e in raw:
        if isinstance(e, dict):
            out.append(normalize_directive_eval(e))
    return out


# ---------------- LLM Call Wrappers ----------------


def llm_json_attempt(prompt: str) -> Any:
    raw = run_llm(prompt=prompt)
    print(raw)
    cleaned = raw.strip()
    # Remove possible markdown fences
    cleaned = cleaned.strip("```").strip()
    # Try direct or extraction
    obj, _ = extract_first_json(cleaned)
    return obj


def multi_generate_alignment(
    worksheet: WorksheetMeta, directives: List[Directive], generations: int
) -> List[List[Dict[str, Any]]]:
    candidates = []
    prompt = compile_initial_prompt(worksheet, directives)
    for i in range(generations):
        logger.info(
            f"LLM initial generation {i+1}/{generations} for worksheet {worksheet.worksheet_id}"
        )
        obj = llm_json_attempt(prompt)
        norm = normalize_response_array(obj)
        candidates.append(norm)
    return candidates


def build_consensus_via_llm(
    worksheet: WorksheetMeta,
    directives: List[Directive],
    candidates: List[List[Dict[str, Any]]],
) -> List[Dict[str, Any]]:
    # Prepare candidate blobs (raw JSON string of each normalized candidate)
    candidate_blobs = [json.dumps(c, ensure_ascii=False) for c in candidates]
    consensus_prompt = compile_consensus_prompt(worksheet, directives, candidate_blobs)
    logger.info(
        f"Requesting consensus LLM output for worksheet {worksheet.worksheet_id}"
    )
    obj = llm_json_attempt(consensus_prompt)
    consensus = normalize_response_array(obj)
    # Fallback: if consensus missing entries, fill using median of candidates
    directive_ids = [d.id for d in directives]
    got_ids = {e["id"] for e in consensus}
    if got_ids != set(directive_ids):
        logger.warning(
            f"Consensus missing directives for {worksheet.worksheet_id}, applying fallback merge."
        )
        # Build score map per id
        score_map = defaultdict(list)
        ev_map = defaultdict(list)
        rec_map = defaultdict(list)
        for cand in candidates:
            for e in cand:
                score_map[e["id"]].append(e["alignment_score"])
                ev_map[e["id"]].append(e["evidence"])
                rec_map[e["id"]].append(e["recommendation"])
        merged = []
        for did in directive_ids:
            scores = score_map.get(did, [0])
            # median
            scores_sorted = sorted(scores)
            med = scores_sorted[len(scores_sorted) // 2]
            # pick most common short evidence
            evidences = [x for x in ev_map.get(did, []) if x]
            evidence = evidences[0] if evidences else ""
            # pick most common recommendation
            recs = [x for x in rec_map.get(did, []) if x]
            recommendation = recs[0] if recs else ""
            merged.append(
                {
                    "id": did,
                    "alignment_score": med,
                    "evidence": evidence[:160],
                    "recommendation": recommendation[:160],
                }
            )
        consensus = merged
    return consensus


# def build_final_api_payload_via_llm(
#     consensus_map: Dict[str, List[Dict[str, Any]]],
#     directives: List[Directive],
#     worksheets: List[WorksheetMeta],
#     generations: int,
# ) -> Dict[str, Any]:
#     final_prompt = compile_final_api_prompt(
#         consensus_map, directives, worksheets, generations
#     )
#     logger.info("Requesting final API payload LLM compilation.")
#     obj = llm_json_attempt(final_prompt)
#     # basic validation
#     if not isinstance(obj, dict):
#         logger.warning(
#             "Final API LLM response not a dict; constructing programmatic fallback."
#         )
#         return programmatic_api_payload(
#             consensus_map, directives, worksheets, generations
#         )
#     # Ensure required top-level keys exist
#     required_top = {"meta", "matrix", "details", "unit_summary"}
#     if not required_top.issubset(set(obj.keys())):
#         logger.warning("Final API LLM response missing keys; using fallback builder.")
#         return programmatic_api_payload(
#             consensus_map, directives, worksheets, generations
#         )
#     return obj


# ---------------- Programmatic Fallback API ----------------


def programmatic_api_payload(
    consensus_map: Dict[str, List[Dict[str, Any]]],
    directives: List[Directive],
    worksheets: List[WorksheetMeta],
    generations: int,
) -> Dict[str, Any]:
    directive_ids = [d.id for d in directives]
    worksheet_ids = [w.worksheet_id for w in worksheets]
    unit_ids = sorted({w.unit_id for w in worksheets})

    # Matrix scores
    scores_matrix = []
    details = {}
    for w in worksheets:
        evals = consensus_map.get(w.worksheet_id, [])
        eval_map = {e["id"]: e for e in evals}
        row = []
        details[w.worksheet_id] = {}
        for did in directive_ids:
            entry = eval_map.get(
                did, {"alignment_score": 0, "evidence": "", "recommendation": ""}
            )
            row.append(int(entry["alignment_score"]))
            details[w.worksheet_id][did] = {
                "alignment_score": int(entry["alignment_score"]),
                "evidence": entry["evidence"],
                "recommendation": entry["recommendation"],
            }
        scores_matrix.append(row)

    # Unit summary aggregation
    unit_summary: Dict[str, Dict[str, Dict[str, Any]]] = {}
    # Accumulate per unit per directive
    acc_scores = defaultdict(list)
    acc_recs = defaultdict(list)
    for w in worksheets:
        for did, dv in details[w.worksheet_id].items():
            acc_scores[(w.unit_id, did)].append(dv["alignment_score"])
            if dv["recommendation"]:
                acc_recs[(w.unit_id, did)].append(dv["recommendation"])

    for unit in unit_ids:
        unit_summary[unit] = {}
        for did in directive_ids:
            scores = acc_scores.get((unit, did), [])
            if scores:
                avg = int(round(sum(scores) / len(scores)))
            else:
                avg = 0
            # top 3 distinct recommendations
            recs = acc_recs.get((unit, did), [])
            # simple frequency ordering
            top = []
            if recs:
                freq = Counter(recs)
                for r, _cnt in freq.most_common():
                    if r not in top:
                        top.append(r)
                    if len(top) >= 3:
                        break
            unit_summary[unit][did] = {"average_score": avg, "top_recommendations": top}

    payload = {
        "meta": {
            "directives": directive_ids,
            "worksheets": worksheet_ids,
            "units": unit_ids,
            "generations": generations,
        },
        "matrix": {
            "directives": directive_ids,
            "worksheets": worksheet_ids,
            "scores": scores_matrix,
        },
        "details": details,
        "unit_summary": unit_summary,
    }
    return payload


# ---------------- High-Level Worksheet Evaluation ----------------


def evaluate_worksheet(
    worksheet: WorksheetMeta,
    directives: List[Directive],
    generations: int,
) -> List[Dict[str, Any]]:
    candidates = multi_generate_alignment(worksheet, directives, generations)
    consensus = build_consensus_via_llm(worksheet, directives, candidates)
    return consensus


# ---------------- Pipeline Runner ----------------


def run_pipeline(
    directives_json: str,
    coursework: str,
    generations: int,
    out_path: str,
) -> Dict[str, Any]:
    directives = load_directives(Path(directives_json))
    if not directives:
        logger.error("No directives loaded; aborting.")
        return {}
    logger.info(f"Loaded {len(directives)} directives.")

    worksheets = collect_course_materials(Path(coursework))
    if not worksheets:
        logger.error("No worksheets found in coursework path.")
        return {}
    logger.info(f"Collected {len(worksheets)} worksheets.")

    # Per worksheet consensus evaluations
    consensus_map: Dict[str, List[Dict[str, Any]]] = {}
    for w in worksheets:
        consensus = evaluate_worksheet(w, directives, generations)
        # Filter invalid directive ids (should be in loaded directives)
        valid_ids = {d.id for d in directives}
        filtered = [e for e in consensus if e.get("id") in valid_ids]
        if len(filtered) != len(consensus):
            logger.warning(
                f"Filtered out entries with invalid directive ids for worksheet {w.worksheet_id}."
            )
        consensus_map[w.worksheet_id] = filtered

    payload = programmatic_api_payload(
        consensus_map, directives, worksheets, generations
    )
    # else:
    #     payload = build_final_api_payload_via_llm(
    #         consensus_map, directives, worksheets, generations
    #     )
    #     # If LLM produced but lacks some entries, ensure completeness by merging fallback
    #     fallback = programmatic_api_payload(
    #         consensus_map, directives, worksheets, generations
    #     )
    #     # Merge only missing parts
    #     for key in ["meta", "matrix", "details", "unit_summary"]:
    #         if key not in payload:
    #             payload[key] = fallback[key]

    # Persist
    out_p = Path(out_path)
    write_json(payload, out_p)
    logger.info(f"Wrote curriculum alignment payload to {out_p}")
    return payload


# ---------------- CLI ----------------


def parse_args():
    p = argparse.ArgumentParser(description="Canadian Curriculum Alignment Pipeline")
    p.add_argument(
        "--directives-json", required=True, help="Path to directives JSON file"
    )
    p.add_argument(
        "--coursework",
        required=True,
        help="Path to coursework (dir with units, single unit dir, or worksheet file)",
    )
    p.add_argument(
        "--generations",
        type=int,
        default=3,
        help="Number of LLM generations per worksheet for democratic consensus",
    )
    p.add_argument("--out", required=True, help="Output JSON file path")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_pipeline(
        directives_json=args.directives_json,
        coursework=args.coursework,
        generations=args.generations,
        out_path=args.out,
    )
