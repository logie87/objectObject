from typing import List, Optional

class DocMeta(BaseModel):
    id: str
    filename: str
    title: str
    size: int
    sha256: str
    uploaded_at: str
    tags: List[str] = []
    source: Optional[str] = None
