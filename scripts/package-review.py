"""Package the local review artifacts without databases, SDKs, or private config."""
from pathlib import Path
import hashlib
import json
import os
import zipfile

root = Path(__file__).resolve().parents[1]
artifacts = root / "artifacts"
artifacts.mkdir(exist_ok=True)
archive = artifacts / "handback-tv-review.zip"
manifest = artifacts / "review-manifest.json"

root_names = {
    "README.md", "LICENSE", "THIRD_PARTY_NOTICES.md", "HANDBACK_PLAN.md",
    "DEMO_SCRIPT.md", "FRICTION_LOG.md", "package.json", "package-lock.json",
    "tsconfig.json", "vite.config.ts", ".gitignore", ".env.example", "Dockerfile", ".dockerignore",
}
source_dirs = {"server", "web", "android", "tests", "scripts", "docs", "artifacts", "deploy", "brag-output"}
excluded_parts = {".gradle", "build", "raw", "__pycache__"}
excluded_names = {
    "local.properties", "review-manifest.json", "emulator-initial.png",
    "emulator-current.png", "azure-debug.png",
}

def include(path):
    rel = path.relative_to(root)
    if not path.is_file() or path.is_symlink():
        return False
    if len(rel.parts) == 1:
        return rel.name in root_names
    if rel.parts[0] not in source_dirs:
        return False
    if any(part in excluded_parts or part.startswith(".") for part in rel.parts):
        return False
    if rel.parts[0] == "brag-output":
        production_root_files = {
            "brag-plan.md", "composition-brief.md", "STORYBOARD.md", "demo-edit.json",
            "demo-beat-edit-evidence.json", "share-copy.txt", "VIDEO_DESCRIPTION.txt",
            "VOICE_TRANSCRIPT_REVIEW.md", "kokoro-model-provenance.json",
        }
        if len(rel.parts) == 2:
            return rel.name in production_root_files
        if rel.parts[1] == "judges-demo":
            return rel.name not in {"package-lock.json"} and rel.suffix not in {".log", ".zip"}
        if rel.parts[1] == "music":
            return rel.name in {"LICENSE.md", "demo-cues.json"}
        if rel.parts[1] == "transcripts":
            return rel.name == "transcript.json" and "trailer" not in rel.parts
        return False
    if rel.name in excluded_names or rel.suffix in {".zip", ".sha256", ".pyc", ".log"}:
        return False
    if str(rel) in {"artifacts/demo-frame-90s.png", "artifacts/screenshots/demo-frame-90s.png", "artifacts/screenshots/demo-frame-135s.png"}:
        return False
    return True

candidates = [root / name for name in root_names]
for directory in sorted(source_dirs):
    for current, dirs, names in os.walk(root / directory):
        dirs[:] = [name for name in dirs if name not in excluded_parts and not name.startswith(".")]
        candidates.extend(Path(current) / name for name in names)
files = sorted(path for path in candidates if include(path))
records = [
    {"path": str(path.relative_to(root)), "bytes": path.stat().st_size,
     "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    for path in files
]
manifest.write_text(json.dumps({
    "project": "Handback TV", "kind": "local review package",
    "excludes": "SDKs, browser downloads, node_modules, local databases/tokens, private config, build caches, raw media, Git history",
    "fileCount": len(records), "files": records,
}, indent=2) + "\n")
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
    for path in files + [manifest]:
        bundle.write(path, "Handback-TV/" + str(path.relative_to(root)))
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None, "Archive integrity check failed"
    assert not any("/.data/" in name or "/node_modules/" in name for name in bundle.namelist())
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix(".zip.sha256").write_text(f"{digest}  {archive.name}\n")
print(json.dumps({"archive": str(archive), "bytes": archive.stat().st_size,
                  "files": len(files) + 1, "sha256": digest, "integrity": "passed"}))
