import argparse
import json
from pathlib import Path

from .inference import infer
from .train import HERE, prepare, prepare_backbone, train

parser = argparse.ArgumentParser(
    description="Treino e visão de portaria em vídeo gravado"
)
parser.add_argument("command", choices=("prepare", "train", "infer"))
parser.add_argument(
    "--data",
    type=Path,
    required=True,
    help="Diretório local dos vídeos e pesos auxiliares",
)
parser.add_argument("--output", type=Path, default=HERE / "artifacts")
arguments = parser.parse_args()
if arguments.command == "prepare":
    result = {
        "sources": list(prepare(arguments.data)),
        "backbone": str(prepare_backbone(arguments.data)),
    }
elif arguments.command == "train":
    result = train(arguments.data, arguments.output)
else:
    result = infer(arguments.data, arguments.output)
print(json.dumps(result, indent=2, ensure_ascii=False))
