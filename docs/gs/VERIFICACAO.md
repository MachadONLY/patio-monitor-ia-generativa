# Verificação da entrega

- **Build.** TypeScript e Vite concluídos.
- **API.** 29 testes aprovados, incluindo uma consulta ao GTFS Realtime público do BRT do Rio.
- **Navegador.** 35 dos 36 testes passaram na execução da suíte. O teste que excedeu o tempo durante uma captura de canvas passou em 13,5 s na execução isolada.
- **LIVE.** O navegador exibiu o recorte do Terminal Alvorada no Rio de Janeiro com observações GPS e horário de medição, entregues por WebSocket. Uma consulta HTTP independente observou seis veículos no recorte às 13h52 de 14/11/2026 (horário local). [Captura do LIVE](live-rio.png).
- **Visão.** A API serviu a gravação com suporte a solicitações por intervalo de bytes. No navegador, o botão de cruzamento avançou o vídeo para 7,44 s. [Captura](../qa/gs-visao-camera.png).
- **IA.** O navegador solicitou a explicação de uma divergência do cenário DEMO. O Qwen local devolveu orientação com citação à regra de conferência de troca. [Captura](genai/ocorrencia-com-fontes.png).

## Revalidação de 14/11/2026

- **Frontend.** Build de produção concluído. Os 36 testes do Playwright passaram em Chromium headless, incluindo cena WebGL, celular, importação e reabertura de CSV, transporte LIVE e interface dos módulos acadêmicos. Os testes de UI com respostas controladas são complementares aos testes da API real.
- **API e rastreamento.** 32 testes aprovados com a consulta externa do BRT habilitada. O adaptador rejeita posições fora da região do serviço antes de deduplicar por veículo.
- **Visão.** O treino e a inferência foram reexecutados a partir das fontes com SHA-256 verificado. A avaliação e o evento de 7,44 s no quadro 186 foram reproduzidos, com direção esquerda para direita e escore 0,9871.
- **IA.** A avaliação foi reexecutada com a versão e o peso do manifesto. Os totais se repetiram para o modelo sem contexto (4/17), RAG (8/17) e RAG com agente (10/17), assim como o Recall@1 e o Recall@3 das perguntas com fonte.
- **Escopo de avaliação.** O navegador reproduz a saída offline da visão. O LIVE do Rio usa posições públicas e o REPLAY requer captura assinada. A entrega permite revisar saídas a partir de registros de portaria e escala. A passagem detectada em Praga e a posição observada no Rio são demonstrações independentes.
