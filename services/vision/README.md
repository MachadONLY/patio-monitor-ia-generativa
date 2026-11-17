# Visão computacional na portaria

O detector identifica ônibus em gravações e rastreia o centro das caixas em relação a uma linha virtual. O relatório registra o quadro, o segundo, a direção na câmera, a pontuação do detector e a imagem anotada. `track_id` é uma associação temporária entre quadros. A demonstração usa uma gravação pública da barreira de saída do aeroporto de Praga, creditada a ŠJů sob CC BY 4.0. O processamento adiciona as anotações, redimensiona o vídeo e remove a faixa de áudio. [Gravação original](https://commons.wikimedia.org/wiki/File:Leti%C5%A1t%C4%9B_Ruzyn%C4%9B,_autobus_linky_119_u_v%C3%BDjezdov%C3%A9_z%C3%A1vory.webm) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

O modelo combina uma rede YOLOX congelada para propor regiões com dois componentes treinados para esta aplicação: classificação logística de ônibus e regressão Ridge para corrigir os quatro limites da caixa. As entradas das duas cabeças incluem descritores HOG, geometria e pontuações da rede de propostas. O treinamento usa anotações manuais e espelhamento nas imagens de treino. A avaliação seleciona o limiar pelo F1 no vídeo de validação e depois aplica esse valor ao vídeo retido. As origens, atribuições, licenças, hashes e caixas anotadas das cinco gravações constam em [dataset.json](dataset.json). O peso auxiliar vem do [OpenCV Zoo](https://github.com/opencv/opencv_zoo/tree/main/models/object_detection_yolox), com [licença Apache 2.0](https://github.com/opencv/opencv_zoo/blob/main/models/object_detection_yolox/LICENSE).

| Separação por vídeo | Quadros anotados | Resultados |
| --- | ---: | --- |
| Treino, 3 vídeos | 33 | 1.246 propostas usadas, 59 positivas |
| Validação, Londres | 10 | 6 acertos, 5 falsos positivos, 0 falsos negativos, F1 0,706 |
| Teste retido, Praga | 11 | 11 acertos, 0 falsos positivos, 0 falsos negativos |

A correspondência exige IoU ≥ 0,50. Há um ônibus alvo anotado por quadro positivo e os quadros negativos estão explicitamente marcados. Demais objetos em cena constituem distrações. O limiar 0,98 e os valores exibidos são pontuações do classificador. O resultado de teste cobre apenas a câmera e as condições daquele vídeo. A direção é do plano da imagem. A passagem visual não fornece a placa, o prefixo, a localização GPS ou o vínculo com uma partida escalada.

Na reprodução de 10,92 s, a linha virtual está em x=468 px no vídeo de 768×432. O rastreador associa quadros por IoU e exige três observações por lado fora da faixa de tolerância de 18 px. O detector produziu uma passagem da esquerda para a direita aos 7,44 s no quadro 186. O relatório inclui taxa de amostragem e velocidade medida do processamento local. O pipeline é offline.

## Verificar os resultados publicados, sem download externo

Os pesos treinados, as métricas, o vídeo anotado e o registro de cruzamento estão no repositório. Para conferir o material submetido mesmo quando um servidor de vídeo original restringir downloads, execute na raiz:

```bash
python -m pip install -r services/api/requirements-dev.txt
python gs/release_preflight.py
```

Essa verificação confere a integridade dos arquivos, os hashes dos pesos e da gravação e a coerência do PDF com a execução versionada. **Não equivale a treinar o modelo novamente.** O treinamento completo abaixo usa os cinco vídeos originais creditados em `dataset.json` e pode encontrar limitação temporária HTTP 429 do Wikimedia Commons; os arquivos locais, quando disponíveis, são reutilizados e conferidos por SHA-256.

## Reproduzir

Execute na raiz do repositório com Python 3.12 e FFmpeg com `libx264` disponíveis. O diretório local de dados recebe os vídeos originais e o peso auxiliar, todos verificados por SHA-256.

```bash
python -m pip install -r services/vision/requirements.txt
python -m services.vision prepare --data .cache/patio-vision
python -m services.vision train --data .cache/patio-vision
python -m services.vision infer --data .cache/patio-vision
python -m pytest -q services/vision/test_tracking.py
```

[Vídeo anotado](artifacts/annotated.mp4) · [Quadro da passagem](artifacts/crossing-01.jpg) · [Relatório](artifacts/report.json) · [Métricas](artifacts/metrics.json) · [Cabeças treinadas](artifacts/bus-heads.npz)

## Processar uma gravação operacional

A partir da raiz, informe o vídeo de câmera fixa, o identificador da gravação e a posição da linha como fração da largura. Escolha um diretório novo por gravação. O comando usa as cabeças treinadas versionadas se o diretório de saída ainda não tem seus próprios pesos.

```bash
python -m services.vision infer --data .cache/patio-vision --output runtime-data/portaria-01 --video /caminho/gravacao.mp4 --source-label "Portaria 01" --line 0.61
```

Inicie o servidor local em `127.0.0.1` com `PATIO_VISION_DIR=runtime-data/portaria-01` e `PATIO_OPERATOR_CAMERA=1`. Abra **Câmera do portão** no painel. A API bloqueia esse material quando há uma origem pública configurada. Use somente em rede local controlada, com gravações cujo uso foi autorizado. O resultado traz instante relativo ao vídeo e sentido no enquadramento. A câmera requer calibração no local, e uma passagem visual deve ser conciliada com a portaria antes de associar o veículo a uma saída.
