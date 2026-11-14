# Contrato de observações

A API serve `GET /api/vehicles/snapshot?mode=LIVE|REPLAY`. O envelope v1 informa modo, estado, fonte, perímetro, observações e, para REPLAY, intervalo e cursor. Cada observação preserva prefixo, código e letreiros de origem e destino da linha quando disponíveis, coordenadas WGS84, horário original de GPS e horário de recepção.

DEMO é cenário local e nunca é retornado no endpoint de observações. LIVE consome apenas a resposta do adaptador autenticado. REPLAY consome somente arquivo histórico assinado. O HMAC verifica que os bytes vieram do detentor da chave e não sofreram alterações. A origem histórica deve ser validada por esse operador antes da assinatura.

`GET /api/vehicles/{vehicle_id}/history?at=<ISO-8601 com fuso>` retorna até 20 observações únicas do prefixo até o cursor, em ordem decrescente, a partir do REPLAY assinado.
