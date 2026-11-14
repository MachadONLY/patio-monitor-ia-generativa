# Verificação da entrega

- **Build.** TypeScript e Vite concluídos.
- **API.** 29 testes aprovados, incluindo uma consulta ao GTFS Realtime público do BRT do Rio.
- **Navegador.** 35 dos 36 testes passaram na execução da suíte. O teste que excedeu o tempo durante uma captura de canvas passou em 13,5 s na execução isolada.
- **LIVE.** O navegador exibiu o recorte do Terminal Alvorada no Rio de Janeiro com observações GPS e horário de medição, entregues por WebSocket. Uma consulta HTTP independente observou seis veículos no recorte às 13h52 de 14/11/2026 (horário local). [Captura do LIVE](live-rio.png).
- **Visão.** A API serviu a gravação com suporte a solicitações por intervalo de bytes. No navegador, o botão de cruzamento avançou o vídeo para 7,44 s. [Captura](../qa/gs-visao-camera.png).
- **IA.** O navegador solicitou a explicação de uma divergência do cenário DEMO. O Qwen local devolveu orientação com citação à regra de conferência de troca. [Captura](genai/ocorrencia-com-fontes.png).
