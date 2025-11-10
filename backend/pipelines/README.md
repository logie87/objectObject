# Pipelines: IEP and Core Competency Alignment

This package exposes two convenience functions via `backend/pipelines/__init__.py` for programmatic use:

- `run_iep_alignment(iep_dir: str, worksheets_dir: str)`
- `run_cc_alignment(cc_file: str, worksheets_dir: str, grade_band: str)`

They wrap the underlying pipelines, add averages, and return a JSON-serializable Python dict.

---

## 1) IEP Alignment

Function:
- `run_iep_alignment(iep_dir: str, worksheets_dir: str) -> Dict[str, Any]`

Inputs:
- `iep_dir`: Path to an IEP JSON file or a directory of IEP JSON files.
  - Each JSON should minimally include:
    - `student` object with fields such as `student_name`, `grade`, `designation` (other fields preserved in `meta`).
    - `performance_progress` (free text).
    - `education_goals` (object/dict of key -> text).
    - `accommodations` (object/dict of key -> text).
- `worksheets_dir`: Path to a single `.pdf`/`.txt` file or a directory tree of worksheets.
  - Text is extracted from PDFs (searchable or OCR fallback) or read directly from `.txt`.

Output (Dict):
- `meta`:
  - `students`: list of student names (columns of the matrix).
  - `worksheets`: list of worksheet IDs (rows of the matrix).
- `matrix`: object
  - `students`: same as above (column labels).
  - `worksheets`: same as above (row labels).
  - `matrix`: 2D list of integers shape `[len(worksheets)] x [len(students)]`, values 0–100 representing `overall_alignment`.
- `details`: nested dictionary with full per-pair metrics
  - `{[worksheet_id]: {[student_name]: {
       understanding_fit: int,
       accessibility_fit: int,
       accommodation_fit: int,
       engagement_fit: int,
       overall_alignment: int,
       explanation: str
  }}}`
- `row_averages`: list of per-worksheet averages (0–100 float rounded to 2 decimals).
- `column_averages`: list of per-student averages (0–100 float rounded to 2 decimals).

Notes:
- Scores are integers in range 0–100.
- Worksheet IDs are derived from relative paths and filenames, preserving subdirectory structure.

Example:
```python
from pipelines import run_iep_alignment

results = run_iep_alignment(
    iep_dir="d:/nathacks2025/objectObject/data/students",
    worksheets_dir="d:/nathacks2025/objectObject/data/curriculum/Math 8 Adapted"
)
print(results["matrix"]["matrix"])       # 2D list of overall scores
print(results["row_averages"])           # per-worksheet averages
print(results["column_averages"])        # per-student averages
```

---

## 2) Core Competency Alignment

Function:
- `run_cc_alignment(cc_file: str, worksheets_dir: str, grade_band: str) -> Dict[str, Any]`

Inputs:
- `cc_file`: Path to a Core Competencies JSON. Expected structure (simplified):
  - `subject`: string
  - `grade_bands`: object where keys are grade band labels (e.g., `"6-9"`) and values contain:
    - `source`: optional string
    - `criteria_categories`: object mapping category keys to:
      - `description`: string
      - `grades`: object mapping grade band keys to lists of indicator strings
- `worksheets_dir`: Path to a single `.pdf`/`.txt` or a directory of worksheets.
- `grade_band`: Target grade band label to use. If not found, the pipeline falls back to the first available band in the file.

Output (Dict):
- `meta`:
  - `subject`: string from the CC file.
  - `grade_band`: effective grade band used.
  - `competencies`: list of competency IDs (columns of the matrix).
  - `worksheets`: list of worksheet IDs (rows of the matrix).
- `matrix`: object
  - `competencies`: same as above (column labels).
  - `worksheets`: same as above (row labels).
  - `matrix`: 2D list of integers shape `[len(worksheets)] x [len(competencies)]`, values 0–100 representing competency alignment.
- `details`: nested dictionary with per-pair outputs
  - `{[worksheet_id]: {[competency_id]: {
       alignment: int,
       explanation: str
  }}}`
- `row_averages`: list of per-worksheet averages (0–100 float rounded to 2 decimals).
- `column_averages`: list of per-competency averages (0–100 float rounded to 2 decimals).

Notes:
- When compiling prompts, the first ~2,500 characters of worksheet text are used to bound context size.
- Indicators for the chosen grade band are used when available; otherwise, available indicators are aggregated.

Example:
```python
from pipelines import run_cc_alignment

results = run_cc_alignment(
    cc_file="d:/nathacks2025/objectObject/data/CCs/math.json",
    worksheets_dir="d:/nathacks2025/objectObject/data/curriculum/Math 8 Adapted",
    grade_band="6-9"
)
print(results["matrix"]["matrix"])       # 2D list of alignment scores
print(results["row_averages"])           # per-worksheet averages
print(results["column_averages"])        # per-competency averages
```

---

## Worksheet ID and Text Extraction

- Supported worksheet formats: `.pdf` (searchable or OCR) and `.txt`.
- Worksheet ID is built from `relative/path_under_root` and filename (slashes replaced with underscores).
- If a single file path is given instead of a directory, it is processed as a single worksheet.

---

## Score Semantics

- IEP alignment returns the following per student–worksheet pair:
  - `understanding_fit`, `accessibility_fit`, `accommodation_fit`, `engagement_fit`, `overall_alignment` (0–100), and a concise `explanation`.
- Core competency alignment returns per competency–worksheet pair:
  - `alignment` (0–100) and a concise `explanation`.

Averages appended by `__init__.py`:
- `row_averages`: average across columns for each row (worksheet).
- `column_averages`: average down rows for each column (student or competency).


# Other stuff
## Chat Bot
Chat bot is currently working only in CLI. I don't think it's very important feature therefore I will leave that as is and go to sleep. Sorry, clouldn't do better. You can find it as `chat_pipeline.py`, it's colorful.