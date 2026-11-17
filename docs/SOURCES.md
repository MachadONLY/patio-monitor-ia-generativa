# Fontes e repositórios oficiais — Pátio Monitor

> Pesquisa pública revisada em 5/11/2026. Estas referências fundamentam **escolhas técnicas**; não provam que credenciais privadas ou integrações estão disponíveis em produção.

## Dados e geografia
- SPTrans Olho Vivo, documentação oficial v2.1: https://www.sptrans.com.br/desenvolvedores/api-do-olho-vivo-guia-de-referencia/documentacao-api/
- SPTrans Developer GTFS estático e login: https://www.sptrans.com.br/desenvolvedores/
- GTFS Schedule/`shapes.txt` (local da rota, não estacionamento no pátio): https://gtfs.org/documentation/schedule/reference/
- GTFS Realtime Vehicle Position spec: https://gtfs.org/documentation/realtime/feed-entities/vehicle-positions/
- OpenStreetMap Overpass API: https://wiki.openstreetmap.org/wiki/Overpass_API
- OSM licença ODbL e atribuição: https://www.openstreetmap.org/copyright
- SPTrans áreas de operação com cores de identidade territorial: https://prefeitura.sp.gov.br/w/servico/estrutura

## Renderização e assets
- React Three Fiber v9 e React19: https://r3f.docs.pmnd.rs/
- R3F performance: https://r3f.docs.pmnd.rs/advanced/scaling-performance
- R3F `useFrame` e o que não fazer: https://r3f.docs.pmnd.rs/api/hooks
- GLTFLoader oficial (Draco/Meshopt/KTX2): https://threejs.org/docs/pages/GLTFLoader.html
- glTF Transform CLI optimize: https://gltf-transform.dev/
- Blender glTF 2.0 export: https://docs.blender.org/manual/en/dev/addons/scene_gltf2.html
- MapLibre JS e 3D: https://maplibre.org/projects/gl-js/
- MapLibre Examples (3D buildings/Three.js): https://maplibre.org/maplibre-gl-js/docs/examples/
- deck.gl com MapLibre: https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre
- deck.gl `ScenegraphLayer` 3D: https://deck.gl/docs/api-reference/mesh-layers/scenegraph-layer

## Código existente para estudar — NÃO copiar cegamente
- Mini Tokyo 3D demo: https://minitokyo3d.com/
- Mini Tokyo 3D GitHub, licença MIT: https://github.com/nagix/mini-tokyo-3d
- Mini Amsterdam 3D GitHub: https://github.com/AzyAli/mini-amsterdam-3d
- ETRA Electra / EMT Madrid: https://www.grupoetra.com/emt-madrid/
- Exemplo terminal 3D+MQTT HSL Helsinque: https://www.ifcvieweronline.eu/blog/bus-terminal-digital-twin-mqtt/

## Regras de utilização
- O MIT do Mini Tokyo cobre seu **código**, não autoriza automaticamente redistribuir dados GTFS privados, imagens, logos e tiles de terceiros.
- Screenshots em `references/` são do usuário e são referências para direção artística; **não são assets** para shipping.
- OSM necessita crédito; tiles possuem termos adicionais próprios.
- Não afirmar arquitetura proprietária interna da ETRA ou de outras soluções com base em screenshots.

### Terminal Alvorada

- [OpenStreetMap](https://api.openstreetmap.org/api/0.6/map?bbox=-43.377,-23.013,-43.344,-22.979), extração de 14/11/2026, © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). Base dos eixos viários, limites, plataformas, árvores mapeadas, pontos de ônibus e plantas de edifícios. Vias e passeios renderizados em UTM 23S. Larguras foram estimadas onde o mapa não informa largura ou faixas.
- [IPP / Prefeitura do Rio, Ortofotos 2019](https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Imagens/Mosaico_2019/ImageServer), [metadados e licença](https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Imagens/Mosaico_2019/ImageServer/info/iteminfo?f=json), CC BY 4.0. Recortes reamostrados de 3,2 km e 1,2 km, em EPSG:31983, comprimidos em WebP com bordas suavizadas. Servem de base visual da cena. Veículos e pessoas capturados na imagem aérea são parte do levantamento histórico.
- [IPP / Prefeitura do Rio, Edificações 2013](https://services5.arcgis.com/mgrvZxGU0bSJbVld/ArcGIS/rest/services/Quadras_Lotes_Edificacoes/FeatureServer/0). Alturas fotogramétricas foram associadas a 61 plantas do OSM com sobreposição alta. É também a fonte dos dois polígonos medidos das coberturas, FIDs 1496953 e 1496954. As demais alturas são estimativas. Fachadas, materiais, mobiliário, pessoas 3D e vegetação adicional são interpretados.
- Referências visuais do [projeto arquitetônico](https://www.galeriadaarquitetura.com.br/projeto/joze-candido-arquitetos-associados/terminal-alvorada/2614), [PMUS (fotos, p. 328)](https://www.rio.rj.gov.br/dlstatic/10112/9742526/4317997/PMUSRelatorioFinal.pdf), [Google Maps](https://www.google.com/maps/search/?api=1&query=Terminal+Alvorada%2C+Rio+de+Janeiro) e [localização confirmada pela SMTR](https://transportes.prefeitura.rio/noticias/terminal-alvorada-e-rebatizado-em-homenagem-ao-arquiteto-e-urbanista-jaime-lerner/). A cena usa dados cartográficos do OSM e do IPP.
- Posicionamento ao vivo pelo feed público [SMTR / MOBI-Rio GTFS-RT](https://dados.mobilidade.rio/gtfs/realtime), CC BY 4.0. A ficha mostra a coordenada original. A cena interpola visualmente entre leituras consecutivas e usa o eixo da via quando ambas as amostras estão próximas do mesmo trecho. A orientação é derivada do deslocamento. As alturas da pista e o tipo exato do veículo não são fornecidos. O modelo genérico mede aproximadamente 12 m.
- A direção da luz diurna usa uma aproximação solar pela data, hora UTC e coordenadas do Alvorada, com iluminação mínima mantida para legibilidade.
- Entradas e saídas se referem à travessia inferida do [perímetro do terminal no OSM](https://www.openstreetmap.org/relation/4571813), cujo contorno externo é a via 940033143. O horário é um intervalo entre observações e o registro requer confirmação por GPS em ambos os lados. Sensores físicos de portão e a ferramenta de reconciliação de portaria são fontes distintas.


### Ambientação animada do Alvorada

- As cenas de tráfego leve usam trechos direcionais mapeados pelo OSM nas avenidas das Américas e Ayrton Senna. Pedestres estilizados percorrem plataformas e caminhos selecionados na Cidade das Artes. Pessoas e automóveis são ambientação ilustrativa. Somente os ônibus do feed aparecem na frota observada ou alimentam o histórico e os registros do perímetro.
- A onda é um efeito visual sobre os polígonos de água do mapa, com duas camadas de textura e brilho especular. Iluminação e sombra do terminal usam a posição solar aproximada. As animações contínuas respeitam a preferência do navegador por movimento reduzido.
- Foram acrescentadas 273 projeções com alturas do cadastro IPP de 2013 no entorno imediato, sem sobrepor a implantação principal. Fachadas e acabamentos são interpretados. A ortofoto continua como camada geográfica do solo e contexto nos locais sem volumes disponíveis.

### Encaixe dos ônibus na pista

A visualização do Alvorada associa a leitura a um eixo viário mapeado em até 9 m. A área permitida deriva dos polígonos de pista do cenário. Ela exclui plataformas, passeios internos, água, projeções dos edifícios e os limites físicos das plataformas renderizadas. A cena testa uma projeção de 12,8 m × 3,4 m para representar a carroceria e os espelhos.

A animação exige continuidade no mesmo eixo ou entre trechos com extremidade comum. Cada quadro é validado contra a área permitida. Se o trajeto não puder ser demonstrado, a cena atualiza somente a posição da leitura que cabe na pista. Sem encaixe seguro, a ficha preserva o GPS bruto e o histórico. Os registros de entrada e saída continuam usando o GPS recebido.
