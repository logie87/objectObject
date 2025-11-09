import hashlib, json, os, sys
from pathlib import Path
from datetime import datetime

BASE = Path(__file__).resolve().parents[1]   # project-root/
DATA = BASE / "data" / "library"
INDEX = DATA / "index.json"

def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1024*1024), b""):
            h.update(chunk)
    return h.hexdigest()

def now_iso(ts: float) -> str:
    return datetime.utcfromtimestamp(ts).isoformat(timespec="seconds") + "Z"

def safe_title(name: str) -> str:
    return Path(name).stem

def main():
    if not DATA.exists():
        print(f"Library folder not found: {DATA}")
        sys.exit(1)

    # load or init index
    if INDEX.exists():
        with INDEX.open("r", encoding="utf-8") as f:
            db = json.load(f)
    else:
        db = {"docs": {}}

    docs = db.setdefault("docs", {})

    # scan PDFs
    pdfs = sorted([p for p in DATA.iterdir() if p.is_file() and p.suffix.lower() == ".pdf"])
    added = 0
    for p in pdfs:
        # compute content hash → id
        digest = sha256_file(p)
        doc_id = digest[:16]

        if doc_id in docs:
            # already indexed (skip)
            continue

        size = p.stat().st_size
        mtime = p.stat().st_mtime
        # keep existing filename (don’t rename)
        meta = {
            "id": doc_id,
            "filename": p.name,
            "title": safe_title(p.name),
            "size": size,
            "sha256": digest,
            "uploaded_at": now_iso(mtime),
            "tags": [],
            "source": "manual-import",
        }
        docs[doc_id] = meta
        added += 1

    # write pretty
    tmp = str(INDEX) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
    os.replace(tmp, INDEX)

    print(f"Reindex complete. Added {added} documents. Index at: {INDEX}")

if __name__ == "__main__":
    main()
