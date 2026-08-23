FROM python:3.12-slim

WORKDIR /service

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

ENV PYTHONPATH=/service/app
ENV PORT=8080

# Drop privileges: a compromised dependency should not run as root inside
# the container. Cloud Run does not enforce this for us.
RUN useradd -m appuser && chown -R appuser /service
USER appuser

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
