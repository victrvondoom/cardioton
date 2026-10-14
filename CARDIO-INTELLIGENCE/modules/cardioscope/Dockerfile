# Same pinned runtime and original v1 artifacts; never trains or evaluates holdout.
FROM node:25.3.0-bookworm-slim AS node
FROM ghcr.io/astral-sh/uv:0.12.1 AS uv
FROM ubuntu:24.04 AS build
ENV DEBIAN_FRONTEND=noninteractive UV_PYTHON=/opt/python/bin/python3.12
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl xz-utils build-essential libssl-dev zlib1g-dev libbz2-dev liblzma-dev libffi-dev libsqlite3-dev libreadline-dev libgomp1 libstdc++6 libatomic1 && rm -rf /var/lib/apt/lists/*
COPY scripts/install_python_linux.sh /tmp/install_python_linux.sh
RUN sh /tmp/install_python_linux.sh /opt/python
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
COPY . .
RUN make install prepare lint test build && .venv/bin/python -m scripts.smoke_frozen

FROM ubuntu:24.04 AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libgomp1 libstdc++6 libssl3t64 zlib1g libbz2-1.0 liblzma5 libffi8 libsqlite3-0 libreadline8t64 && rm -rf /var/lib/apt/lists/* && useradd --uid 10001 --create-home cardioscope
ENV PYTHONDONTWRITEBYTECODE=1 MPLCONFIGDIR=/tmp/matplotlib
WORKDIR /app
COPY --from=build /opt/python /opt/python
COPY --from=build /app/.venv /app/.venv
COPY --from=build /app/backend /app/backend
COPY --from=build /app/ml /app/ml
COPY --from=build /app/config /app/config
COPY --from=build /app/artifacts /app/artifacts
COPY --from=build /app/assets /app/assets
COPY --from=build /app/data /app/data
COPY --from=build /app/uv.lock /app/uv.lock
COPY --from=build /app/frontend/dist /app/frontend/dist
USER 10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD ["/app/.venv/bin/python", "-c", "import json,urllib.request; assert json.load(urllib.request.urlopen('http://127.0.0.1:8000/api/health'))['models_loaded']"]
CMD ["/app/.venv/bin/python", "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
