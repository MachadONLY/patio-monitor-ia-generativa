FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY services/api/requirements.txt services/api/requirements-ai.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt \
    && python -m pip install --no-cache-dir --only-binary=:all: \
        --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu \
        -r requirements-ai.txt
COPY services/api/app app
COPY services/vision/artifacts /app/vision-artifacts
RUN install -d -m 0750 -o 10001 -g 10001 /app/observations
USER 10001:10001
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-server-header", "--ws-max-size", "4096", "--ws-max-queue", "8"]
