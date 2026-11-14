# Pátio Monitor | Applied Computer Vision

Global Solution 2026.2 · CitizenTech · Engenharia de Software, 4º ano

O componente de visão testa o uso de imagens de uma câmera para detectar ônibus e extrair passagens por uma linha virtual. A gravação e a origem dos resultados acompanham as inferências. Uma passagem visual é uma evidência complementar e não confirma, por si só, o vínculo com um prefixo, uma escala ou uma observação do Olho Vivo.

## Entrega

O enunciado oficial detalha a disciplina nas páginas 43–44. O prazo geral é **19 de novembro de 2026, às 23h55**, no Teams da disciplina (p. 24).

| Item | Critério |
| --- | --- |
| Repositório | Link do GitHub, com código completo e documentação |
| Relatório em PDF | Título, integrantes, resumo de 250 palavras, introdução, objetivo de 50 palavras, ferramentas, metodologia passo a passo, exemplos de resultados e conclusão |
| Vídeo | Mostrar a solução em funcionamento |

Código completo em [MachadONLY/patio-monitor-computer-vision](https://github.com/MachadONLY/patio-monitor-computer-vision).

- [Relatório técnico em PDF](Patio-Monitor-Applied-Computer-Vision.pdf)
- [Demonstração do aplicativo em MP4](Patio-Monitor-Demonstracao-Visao.mp4)
- [Implementação, dados anotados e reprodução](../../../services/vision/)
- [Métricas da avaliação](../../../services/vision/artifacts/metrics.json) e [relatório de cruzamentos](../../../services/vision/artifacts/report.json)

Para analisar uma gravação própria, use o [fluxo de inferência operacional](../../../services/vision/README.md#processar-uma-gravação-operacional).

## Roteiro de demonstração

1. Abra a área de câmera no Pátio Monitor e mostre a origem da gravação e o modelo treinado.
2. Reproduza um trecho em que a inferência marque os ônibus. Mostre o cruzamento da linha e o sentido da passagem.
3. Selecione o cruzamento para levar o player a 7,44 s e confira a evidência na própria gravação.
4. Consulte a avaliação no PDF, com um acerto de teste, um falso positivo de validação e os limites da amostra.

O cruzamento exibido vem da gravação pública de ŠJů na saída do aeroporto de Praga, publicada no Wikimedia Commons sob CC BY 4.0. O vídeo demonstra a navegação da gravação anotada. O relatório registra a velocidade do processamento offline em CPU.

Para regenerar o PDF com seu texto e imagens versionados, instale ReportLab e as fontes DejaVu Sans, e rode na raiz do projeto:

```sh
python docs/gs/cv/montar_relatorio.py docs/gs/cv/relatorio-conteudo.json docs/gs/cv/Patio-Monitor-Applied-Computer-Vision.pdf
```
