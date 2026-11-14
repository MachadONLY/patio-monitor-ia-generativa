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
parser.add_argument("--video", type=Path, help="Gravação local de uma câmera fixa para inferência")
parser.add_argument("--source-label", help="Identificação operacional da gravação")
parser.add_argument("--line", type=float, default=0.61, help="Posição horizontal da linha, fração da largura")
arguments = parser.parse_args()
if arguments.video and (
    arguments.command != "infer" or not arguments.source_label or not arguments.source_label.strip()
    or len(arguments.source_label) > 160 or not arguments.video.is_file()
    or arguments.output.resolve() == (HERE / "artifacts").resolve()
):
    parser.error("Use infer com vídeo local, identificação e diretório de saída próprio.")
if not 0.05 <= arguments.line <= 0.95:
    parser.error("A posição da linha deve estar entre 0,05 e 0,95.")
if arguments.command == "prepare":
    result = {
        "sources": list(prepare(arguments.data)),
        "backbone": str(prepare_backbone(arguments.data)),
    }
elif arguments.command == "train":
    result = train(arguments.data, arguments.output)
else:
    result = infer(arguments.data, arguments.output, arguments.video, arguments.source_label, arguments.line)
print(json.dumps(result, indent=2, ensure_ascii=False))
