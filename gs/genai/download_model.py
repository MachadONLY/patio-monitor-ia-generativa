"""Download the official quantized model and verify its pinned SHA-256."""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

parser = argparse.ArgumentParser()
parser.add_argument("destination", type=Path)
args = parser.parse_args()
manifest = json.loads((Path(__file__).parent / "model.json").read_text())
path = args.destination
path.parent.mkdir(parents=True, exist_ok=True)
temporary = path.with_suffix(path.suffix + ".part")
digest = hashlib.sha256()
try:
    with urlopen(manifest["url"], timeout=45) as response, temporary.open("wb") as out:
        while chunk := response.read(1024 * 1024):
            digest.update(chunk)
            out.write(chunk)
    if digest.hexdigest() != manifest["sha256"]:
        raise ValueError("SHA-256 incompatível. O peso recebido foi descartado.")
    temporary.replace(path)
finally:
    temporary.unlink(missing_ok=True)
print(path.resolve(), digest.hexdigest())
