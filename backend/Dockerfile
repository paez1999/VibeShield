FROM node:20-slim
WORKDIR /app

# Install Python + Semgrep via isolated venv (avoids PEP 668 conflicts)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-venv && \
    python3 -m venv /opt/semgrep && \
    /opt/semgrep/bin/pip install semgrep && \
    ln -s /opt/semgrep/bin/semgrep /usr/local/bin/semgrep && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
