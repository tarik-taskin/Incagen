FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1
WORKDIR /app
COPY requirements.runtime.lock /app/requirements.lock
RUN pip install --no-cache-dir --require-hashes -r /app/requirements.lock \
    && useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin worker
COPY src /app/src
ENV PYTHONPATH=/app/src
USER 10001
CMD ["python", "-m", "incagen_extract.server"]
