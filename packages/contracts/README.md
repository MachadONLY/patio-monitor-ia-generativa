# Contrato de observações

A API serve `GET /api/vehicles/snapshot?mode=LIVE|REPLAY`. O envelope v1 informa modo, estado, fonte, perímetro, observações e, para REPLAY, intervalo e cursor. Cada observação preserva prefixo, código e letreiros de origem e destino da linha quando disponíveis, coordenadas WGS84, horário original de GPS e horário de recepção.

DEMO é cenário local e nunca é retornado no endpoint de observações. LIVE consome o feed público do BRT do Rio ou o adaptador autenticado da SPTrans. O REPLAY aceita uma captura SPTrans assinada ou posições coletadas pelo servidor. O HMAC verifica que os bytes vieram do detentor da chave e não sofreram alterações. A origem histórica deve ser validada por esse operador antes da assinatura.

`GET /api/vehicles/{vehicle_id}/history?at=<ISO-8601 com fuso>` retorna até 20 observações únicas do prefixo até o cursor, em ordem decrescente, a partir do arquivo assinado ou do histórico persistido.

Com `PATIO_ARCHIVE_FILE`, o servidor persiste leituras recentes dentro do recorte. `REPLAY` usa esse histórico quando não há uma captura assinada com observações. Ambos os modos podem referenciar `rio_mobi_gtfs_rt` ou `sptrans_olhovivo`. O endpoint de histórico aceita `mode=LIVE` ou `mode=REPLAY` e devolve até 20 observações do veículo até `at`.
