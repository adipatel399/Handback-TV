"""Package runtime source and prepare a private Azure Run Command script; no Git needed."""
from pathlib import Path
import tarfile, io, json, base64
root = Path(__file__).resolve().parents[1]
private = root / ".tools/azure"
state = json.loads((private / "state.json").read_text())
data = io.BytesIO()
paths = [root / name for name in ["Dockerfile", ".dockerignore", "package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "LICENSE", "THIRD_PARTY_NOTICES.md"]]
paths += [p for folder in ["server", "web", "deploy/azure"] for p in (root / folder).rglob("*") if p.is_file()]
with tarfile.open(fileobj=data, mode="w:gz") as archive:
    for path in paths:
        archive.add(path, arcname=str(path.relative_to(root)))
(private / "source.tar.gz").write_bytes(data.getvalue())
payload = base64.b64encode(data.getvalue()).decode()
script = """#!/bin/bash
set -euo pipefail
cloud-init status --wait >/dev/null 2>&1 || true
command -v docker >/dev/null
docker compose version
mkdir -p /opt/handback/source /opt/handback/data
chown 1000:1000 /opt/handback/data
"""
script += "base64 -d <<'HANDBACK_SOURCE' | tar xz -C /opt/handback/source\n" + payload + "\nHANDBACK_SOURCE\n"
script += "umask 077\ncat > /opt/handback/private.env <<'HANDBACK_ENV'\nHANDBACK_PUBLIC_ORIGIN=" + state["url"] + "\nHANDBACK_PREVIEW_PASSWORD=" + state["password"] + "\nHANDBACK_ENV\n"
script += "cp /opt/handback/source/deploy/azure/Caddyfile /opt/handback/Caddyfile\ncp /opt/handback/source/deploy/azure/compose.yaml /opt/handback/compose.yaml\nprintf '%s\\n' 'HANDBACK_DOMAIN=" + state["fqdn"] + "' > /opt/handback/.env\ncd /opt/handback\nnohup bash -c 'docker compose -f compose.yaml up -d --build && docker compose -f compose.yaml exec -T proxy caddy reload --config /etc/caddy/Caddyfile' </dev/null > /opt/handback/deploy.log 2>&1 &\necho 'Handback build started in background.'\n"
path = private / "bootstrap.sh"
path.write_text(script)
path.chmod(0o600)
print("Private upload script prepared; runtime source archive bytes:", len(data.getvalue()))
