FROM python:3.13-slim

# arduino-cli + the AVR core (avr-gcc, avr-libc, Arduino core) baked into the
# image so a compile needs no network and the core is shared, read-only, by the
# non-root runtime user.
ENV ARDUINO_DIRECTORIES_DATA=/opt/arduino \
    ARDUINO_DIRECTORIES_DOWNLOADS=/opt/arduino/staging \
    ARDUINO_DIRECTORIES_USER=/opt/arduino/user

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL -o /tmp/acli.tgz https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Linux_64bit.tar.gz \
 && tar xzf /tmp/acli.tgz -C /usr/local/bin arduino-cli \
 && rm /tmp/acli.tgz \
 && arduino-cli core update-index \
 && arduino-cli core install arduino:avr \
 && chmod -R a+rX /opt/arduino

WORKDIR /app
ENV PYTHONPATH=/app/app
ENV PORT=8080

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

# Drop privileges: compiling untrusted source runs as a non-root user.
RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
