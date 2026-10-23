"""Write review captions from the exact composed narration and measured audio durations."""
import ast
import subprocess
from pathlib import Path
root = Path(__file__).resolve().parents[1]
module = ast.parse((root / "scripts/compose-demo.py").read_text())
segments = next(ast.literal_eval(node.value) for node in module.body if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "segments" for t in node.targets))
def stamp(seconds):
    ms = round(seconds * 1000)
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"
lines = []
for index, (start, text) in enumerate(segments):
    duration = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(root / f"artifacts/raw/narration-{index}.aiff")]))
    # Split the narration into readable phrases, with timing proportional to word count.
    words = text.split()
    chunks = [words[i:i + 13] for i in range(0, len(words), 13)]
    consumed = 0
    for chunk in chunks:
        a = start + duration * consumed / len(words)
        consumed += len(chunk)
        b = start + duration * consumed / len(words)
        lines.append(f"{len(lines)+1}\n{stamp(a)} --> {stamp(b)}\n{' '.join(chunk)}\n")
(root / "artifacts/demo-captions.srt").write_text("\n".join(lines))
print(f"Saved {len(lines)} timed caption phrases.")
