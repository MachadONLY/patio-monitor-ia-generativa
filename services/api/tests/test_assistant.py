import json

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import assistant


class ScriptedModel:
    def __init__(self, output):
        self.output = output
        self.calls = 0

    def create_chat_completion(self, **kwargs):
        self.calls += 1
        return {"choices": [{"message": {"content": json.dumps(self.output)}}]}


def test_out_of_scope_does_not_call_model():
    model = ScriptedModel({})
    result, trace = assistant.run_query(model, "Previsão de terremoto em Marte", "rag_agent")
    assert result.refused
    assert not result.citations
    assert model.calls == 0
    assert trace["guard"] == "below_threshold"


def test_driver_password_is_not_equated_with_provider_authentication():
    model = ScriptedModel({})
    result, trace = assistant.run_query(model, "Qual é a senha do motorista?", "rag_agent")
    assert result.refused
    assert trace["guard"] == "below_threshold"
    assert model.calls == 0


def test_agent_rejects_unknown_citation_and_unsupported_numbers():
    question = "Quais campos py e px registram no Olho Vivo?"
    model = ScriptedModel({"answer": "py é latitude", "citation_ids": ["xyz"], "refused": False})
    response, trace = assistant.run_query(model, question, "rag_agent")
    assert response.refused and trace["guard"] == "citation_not_retrieved"
    model.output.update(answer="O veículo tem 500 vagas", citation_ids=["s01"])
    response, trace = assistant.run_query(model, question, "rag_agent")
    assert response.refused and trace["guard"] == "unsupported_number"


def test_route_validates_context_and_fails_with_no_runtime(monkeypatch):
    monkeypatch.delenv("PATIO_LLM_MODEL_PATH", raising=False)
    assistant.load_model.cache_clear()
    app = FastAPI()
    app.include_router(assistant.router)
    client = TestClient(app)
    assert client.post("/api/gs/explain", json={"question": "Como autenticar o Olho Vivo?"}).status_code == 503
    assert client.post("/api/gs/explain", json={"question": "Como autenticar?", "context": {
        "tripId": "x", "status": "divergent", "reason": "vehicle_swap", "evidenceMode": "LIVE",
    }}).status_code == 422
