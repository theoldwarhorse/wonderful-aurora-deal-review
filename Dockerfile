# One image: the React frontend is built, then served by the Python API.

FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /srv
COPY backend/requirements.txt ./
# Installing as root is the norm inside an image; the flag stops pip warning about it.
RUN pip install --no-cache-dir --root-user-action=ignore -r requirements.txt
COPY backend/app ./app
# A stand-in for the system that receives approved deals. Kept outside the app: it is not part of the product.
COPY backend/mock_downstream.py ./
# The sample deals the service loads on first start. .dockerignore leaves out the LaTeX and the generator.
COPY sample-data ./seed
COPY --from=frontend /frontend/dist ./static
# Run as an ordinary user. /data holds the PDFs and is where the volume is mounted.
RUN useradd --create-home app && mkdir /data && chown app /data
USER app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# Adds the test tools. Used by `docker compose run --rm tests`.
FROM runtime AS test
USER root
COPY backend/requirements-dev.txt ./
RUN pip install --no-cache-dir --root-user-action=ignore -r requirements-dev.txt
COPY backend/tests ./tests
USER app
# `python -m` puts /srv on the import path so the tests can import `app`.
CMD ["python", "-m", "pytest", "-q", "-p", "no:cacheprovider"]
