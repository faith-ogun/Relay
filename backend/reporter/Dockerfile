FROM python:3.13-slim

WORKDIR /app

# Put the app dir on the path so flat intra-app imports (e.g. `from resilience
# import ...`) resolve, matching the other Ohmlet services.
ENV PYTHONPATH=/app/app
ENV PORT=8080

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

# Drop privileges: a compromised dependency should not run as root inside
# the container. Cloud Run does not enforce this for us.
RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
