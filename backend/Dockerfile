FROM python:3.13-slim

# System deps for bcrypt/cryptography compilation + pg_isready for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make entrypoint executable
RUN chmod +x start.sh

EXPOSE 8000

ENTRYPOINT ["./start.sh"]
