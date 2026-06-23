FROM python:3.13-slim

WORKDIR /app

# Put the app dir on the path so flat intra-app imports (e.g. `from resilience
# import ...`) resolve, matching how the live-bridge service is configured.
ENV PYTHONPATH=/app/app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
