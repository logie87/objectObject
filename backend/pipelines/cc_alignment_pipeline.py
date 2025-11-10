"""
core_competency_alignment_pipeline.py
Full pipeline:
- extract text from worksheets (PDF/text)
- load core competencies JSON for a subject (e.g., sample_data/CCs/math.json)
- flatten/normalize competencies for a target grade band
- compile deterministic prompts (worksheet x competency)
- call local LLM (llama:phi3-mini via llama-cpp-python)
- parse, normalize model output into strict schema
- assemble score matrix (worksheets x competencies) and write JSON for API

Usage:
  python iep_alignment_pipeline.py ^
    --cc-file "./sample_data/CCs/math.json" ^
    --grade-band "6-9" ^
    --worksheets-dir "./worksheets" ^
    --out "output_cc_scores.json"
"""

import argparse
import json
import os
import re
import logging
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional

from tqdm import tqdm

# PDF & OCR libs
from PyPDF2 import PdfReader
from pdf2image import convert_from_path
import pytesseract
from PIL import Image

from llm import run_llm
from logger import SimpleAppLogger

# ---------- Configuration / Schema ----------

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
LOG_DIR = BASE_DIR / "logs"

LOG_DIR.mkdir(parents=True, exist_ok=True)
logging.getLogger("httpx").setLevel(logging.ERROR)
logger = SimpleAppLogger(
    str(LOG_DIR), "cc_alignment_pipeline", logging.INFO
).get_logger()

# Strict response schema expected from model (keys and types)
CC_EXPECTED_KEYS = [
    "alignment",  # integer 0-100
    "explanation",  # short string
]


def safe_load_json_file(path: Path) -> Dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json_file(obj: Any, path: Path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)


# ---------- Text Extraction ----------


def extract_text_from_searchable_pdf(path: Path) -> str:
    """Try to extract text using PyPDF2. Best for searchable PDFs."""
    text_chunks = []
    try:
        reader = PdfReader(str(path))
        for p in reader.pages:
            try:
                txt = p.extract_text() or ""
            except Exception:
                txt = ""
            text_chunks.append(txt)
    except Exception as e:
        logger.warning(f"PyPDF2 failed for {path}: {e}")
    return "\n".join(text_chunks).strip()


def ocr_pdf(path: Path, dpi=300, pages_limit=None) -> str:
    """Perform OCR using pdf2image + pytesseract."""
    text_chunks = []
    try:
        images = convert_from_path(str(path), dpi=dpi)
        if pages_limit:
            images = images[:pages_limit]
        for img in images:
            txt = pytesseract.image_to_string(img)
            text_chunks.append(txt)
    except Exception as e:
        logger.warning(f"OCR failed for {path}: {e}")
    return "\n".join(text_chunks).strip()


def extract_text_from_pdf(path: Path, ocr_if_empty=True, pages_limit=None) -> str:
    text = extract_text_from_searchable_pdf(path)
    if (not text or len(text) < 50) and ocr_if_empty:
        logger.info(f"Performing OCR for (probably scanned) PDF: {path}")
        text = ocr_pdf(path, pages_limit=pages_limit)
    return text


def extract_text_from_file(path: Path) -> str:
    """Generic extractor: support .pdf and .txt"""
    if path.suffix.lower() == ".pdf":
        return extract_text_from_pdf(path)
    else:
        # fallback to read text file
        try:
            return path.read_text(encoding="utf-8")
        except Exception:
            return ""


# ---------- Core Competency Normalization ----------


@dataclass
class Competency:
    competency_id: str  # e.g., "questioning_and_investigating"
    title: str  # human readable title
    description: str  # category description
    indicators: List[str]  # grade-aligned indicators/descriptors
    meta: Dict[str, Any]  # any extra metadata (subject, grade_band, etc.)


def snake_to_title(s: str) -> str:
    return " ".join(w.capitalize() for w in s.replace("-", "_").split("_"))


def normalize_competencies(
    cc_raw: Dict, grade_band: Optional[str] = None
) -> List[Competency]:
    """
    Flatten a core competencies JSON (like sample_data/CCs/math.json) into a list of Competency.
    - If grade_band provided, use that band from cc_raw["grade_bands"].
    - If not, pick the first available grade band.
    - Within each category, collect indicators from the 'grades' mapping:
      - If the selected grade_band exists as a key in 'grades', use that list.
      - Else, fallback by aggregating all available grade descriptor lists.
    """
    subject = cc_raw.get("subject", "Unknown Subject")
    gb_map = cc_raw.get("grade_bands", {}) or {}
    if not gb_map:
        logger.warning("No grade_bands found in core competencies JSON.")
        return []

    # Pick a grade band
    if grade_band and grade_band in gb_map:
        gb_key = grade_band
    else:
        gb_key = next(iter(gb_map.keys()))
        if grade_band:
            logger.warning(
                f"Requested grade band '{grade_band}' not found. Using '{gb_key}' instead."
            )

    gb = gb_map[gb_key]
    criteria = gb.get("criteria_categories", {}) or {}

    competencies: List[Competency] = []
    for cat_key, cat in criteria.items():
        description = cat.get("description", "")
        grades_map: Dict[str, List[str]] = cat.get("grades", {}) or {}

        # Choose indicators for this grade_band if present; otherwise aggregate all
        if gb_key in grades_map:
            indicators = grades_map[gb_key]
        else:
            # concatenate and de-duplicate while preserving order
            seen = set()
            indicators = []
            for _, arr in grades_map.items():
                for item in arr:
                    if item not in seen:
                        indicators.append(item)
                        seen.add(item)

        comp = Competency(
            competency_id=str(cat_key),
            title=snake_to_title(str(cat_key)),
            description=str(description),
            indicators=[str(x) for x in indicators],
            meta={
                "subject": subject,
                "grade_band": gb_key,
                "source": gb.get("source", ""),
            },
        )
        competencies.append(comp)

    return competencies


# ---------- Prompt Compiler ----------

ALIGNMENT_PROMPT_TEMPLATE = """
You are an expert curriculum analyst. Evaluate how well the given worksheet aligns with ONE specific core competency.

CORE COMPETENCY:
Title: {competency_title}
Description: {competency_description}
Indicators (grade band {grade_band}):
- {competency_indicators}

WORKSHEET METADATA:
Worksheet Title: {worksheet_title}

WORKSHEET FULL TEXT:
{worksheet_text}

TASK:
Rate the alignment of this worksheet to the specified core competency.

RETURN A JSON OBJECT ONLY with exactly these keys:
- alignment: integer 0-100 (overall degree of alignment to the competency and its indicators)
- explanation: short string (1-2 brief sentences explaining the score)

SCORING RULES:
- Use 0-100 integer values.
- Keep explanation concise.
- Do not output ANY extra text outside the JSON.
- Do not add ANY comments on individual JSON entries.

Produce the JSON now.
""".strip()


def compile_alignment_prompt(
    competency: Competency,
    worksheet_text: str,
    worksheet_id: str,
    worksheet_title: str = "",
) -> str:
    indicators_block = (
        "\n- ".join(competency.indicators[:8]) if competency.indicators else "N/A"
    )
    prompt = ALIGNMENT_PROMPT_TEMPLATE.format(
        competency_title=competency.title or "N/A",
        competency_description=competency.description or "N/A",
        competency_indicators=indicators_block or "N/A",
        grade_band=competency.meta.get("grade_band", "N/A"),
        worksheet_title=worksheet_title or "N/A",
        worksheet_text=(worksheet_text or "")[:2500],  # keep prompt size bounded
    )
    return prompt


# ---------- Response Parsing & Normalization ----------


def extract_json_from_text(s: str) -> Tuple[Dict, str]:
    """
    Try to extract the first JSON object from text.
    Returns (json_obj_or_empty, raw_json_string_or_empty)
    """
    if not s:
        return {}, ""
    s = s.strip()

    # try direct parse first
    try:
        j = json.loads(s)
        if isinstance(j, dict):
            return j, s
    except Exception:
        pass

    # strip common code fences
    for fence in ("```json", "```", "~~~json", "~~~"):
        if s.startswith(fence):
            s = s[len(fence) :].strip()
        if s.endswith("```") or s.endswith("~~~"):
            s = s[:-3].strip()

    # try again
    try:
        j = json.loads(s)
        if isinstance(j, dict):
            return j, s
    except Exception:
        pass

    # scan braces
    brace_stack = []
    start = None
    for i, ch in enumerate(s):
        if ch == "{":
            if start is None:
                start = i
            brace_stack.append(i)
        elif ch == "}":
            if brace_stack:
                brace_stack.pop()
                if not brace_stack and start is not None:
                    candidate = s[start : i + 1]
                    try:
                        j = json.loads(candidate)
                        if isinstance(j, dict):
                            return j, candidate
                    except Exception:
                        start = None
                        continue
    return {}, ""


def enforce_cc_schema_and_normalize(raw: Dict) -> Dict:
    """Ensure keys exist and numeric values are ints between 0 and 100."""
    out = {}
    # alignment
    if "alignment" in raw:
        try:
            v = int(round(float(raw["alignment"])))
        except Exception:
            digits = re.findall(r"\d+", str(raw["alignment"]))
            v = int(digits[0]) if digits else 0
        out["alignment"] = max(0, min(100, v))
    else:
        out["alignment"] = 0
    # explanation
    ex = str(raw.get("explanation", "")).strip()
    out["explanation"] = (" ".join(ex.split()))[:260]
    return out


# ---------- Pipeline: worksheet x competency ----------


def evaluate_alignment_for_pair(
    competency: Competency,
    worksheet_text: str,
    worksheet_id: str,
    worksheet_title: str = "",
) -> Dict:
    prompt = compile_alignment_prompt(
        competency, worksheet_text, worksheet_id, worksheet_title
    )
    raw_output = run_llm(prompt=prompt)

    parsed, raw_json = extract_json_from_text(raw_output or "")
    if not parsed:
        logger.warning(
            f"Failed to extract JSON from LLM for {worksheet_id} x {competency.competency_id}. Raw: {str(raw_output)[:160]}"
        )
        parsed = None

    if parsed is None or set(parsed.keys()) != set(CC_EXPECTED_KEYS):
        normalized = evaluate_alignment_for_pair(
            competency, worksheet_text, worksheet_id, worksheet_title
        )
    else:
        normalized = enforce_cc_schema_and_normalize(parsed)
    logger.info(
        f"LLM Output [{worksheet_title} x {competency.title}]: "
        f"{json.dumps(normalized, ensure_ascii=False)}"
    )
    return normalized


# ---------- Worksheets collection ----------


def collect_worksheets_texts(worksheets_dir: Path) -> Dict[str, Dict]:
    """
    Walk worksheets_dir; expects structure optionally with units:
      worksheets_dir/unit1/worksheet1.pdf
      worksheets_dir/unit1/worksheet2.pdf
    If a file is passed, treat it as a single worksheet.
    Returns dict worksheet_id -> {"text":..., "title":..., "path":...}
    """
    worksheets: Dict[str, Dict[str, str]] = {}

    if worksheets_dir.is_file():
        fname = worksheets_dir.name
        if not fname.lower().endswith((".pdf", ".txt")):
            return {}
        worksheet_id = f"{fname}".strip("_")
        title = fname
        try:
            text = extract_text_from_file(worksheets_dir)
            if not text:
                logger.warning(f"No text found in {worksheets_dir}")
        except Exception as e:
            logger.warning(f"Failed to extract text from {worksheets_dir}: {e}")
            text = ""
        worksheets[worksheet_id] = {
            "text": text,
            "title": title,
            "path": str(worksheets_dir),
        }
        return worksheets

    for root, dirs, files in os.walk(str(worksheets_dir)):
        for fname in files:
            if not fname.lower().endswith((".pdf", ".txt")):
                continue
            fpath = Path(root) / fname
            rel = (
                Path(root).relative_to(worksheets_dir)
                if Path(root) != worksheets_dir
                else Path(".")
            )
            worksheet_id = f"{rel.as_posix().replace('/', '_')}_{fname}".strip("_")
            title = fname
            try:
                text = extract_text_from_file(fpath)
                if not text:
                    logger.warning(f"No text found in {fpath}")
            except Exception as e:
                logger.warning(f"Failed to extract text from {fpath}: {e}")
                text = ""
            worksheets[worksheet_id] = {
                "text": text,
                "title": title,
                "path": str(fpath),
            }
    return worksheets


# ---------- Assemble score table ----------


def assemble_score_matrix(
    results: Dict[str, Dict[str, int]], competencies: List[str], worksheets: List[str]
) -> Dict:
    """
    results: mapping worksheet_id -> mapping competency_id -> score (alignment)
    """
    matrix = []
    for wid in worksheets:
        row = []
        for c in competencies:
            row.append(results.get(wid, {}).get(c, 0))
        matrix.append(row)
    return {"competencies": competencies, "worksheets": worksheets, "matrix": matrix}


# ---------- High level run ----------


def run_pipeline(
    cc_file: str,
    worksheets_dir: str,
    out_path: Optional[str] = None,
    grade_band: Optional[str] = None,
):
    cc_raw = safe_load_json_file(Path(cc_file))
    competencies = normalize_competencies(cc_raw, grade_band=grade_band)
    if len(competencies) == 0:
        logger.warning("No competencies available. Exiting.")
        return

    comp_ids = [c.competency_id for c in competencies]
    logger.info(f"Loaded {len(competencies)} competencies: {comp_ids}")

    worksheets = collect_worksheets_texts(Path(worksheets_dir))
    worksheet_ids = list(worksheets.keys())
    logger.info(f"Found {len(worksheets)} worksheet files.")

    # Results map: worksheet_id -> competency_id -> score
    results_alignment: Dict[str, Dict[str, int]] = {wid: {} for wid in worksheet_ids}
    # And store per-pair details as well
    full_results: Dict[str, Dict[str, Dict[str, Any]]] = {
        wid: {} for wid in worksheet_ids
    }

    for wid in tqdm(worksheet_ids, desc="Worksheets"):
        wtext = worksheets[wid]["text"] or ""
        wtitle = worksheets[wid]["title"]
        for comp in competencies:
            eval_result = evaluate_alignment_for_pair(
                comp, wtext, worksheet_id=wid, worksheet_title=wtitle
            )
            results_alignment[wid][comp.competency_id] = int(eval_result["alignment"])
            full_results[wid][comp.competency_id] = eval_result

    # Build matrix
    matrix_json = assemble_score_matrix(results_alignment, comp_ids, worksheet_ids)
    # Save outputs
    api_payload = {
        "meta": {
            "subject": cc_raw.get("subject", "Unknown"),
            "grade_band": competencies[0].meta.get("grade_band"),
            "competencies": comp_ids,
            "worksheets": worksheet_ids,
        },
        "matrix": matrix_json,
        "details": full_results,
    }

    if out_path:
        out_p = Path(out_path)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        write_json_file(api_payload, out_p)
        logger.info(f"Wrote results to {out_p}")

    return api_payload


# ---------- CLI ----------


def parse_args():
    p = argparse.ArgumentParser(description="Core Competency Alignment Pipeline")
    p.add_argument(
        "--cc-file",
        required=True,
        help="Path to core competencies JSON (e.g., sample_data/CCs/math.json)",
    )
    p.add_argument(
        "--grade-band",
        required=False,
        help="Grade band key to use (e.g., '6-9', '8-9'). Defaults to first in file.",
    )
    p.add_argument(
        "--worksheets-dir",
        required=True,
        help="Directory (or single file) for worksheets (PDF/TXT). Subdirs retained as units.",
    )
    p.add_argument("--out", required=True, help="Path to output JSON file")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_pipeline(
        args.cc_file, args.worksheets_dir, args.out, grade_band=args.grade_band
    )
