# syntax=docker/dockerfile:1
FROM python:3.11-slim

WORKDIR /app

# Set production environment flags
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Install system dependencies including curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

EXPOSE 8000

# Health check probe for hosting platforms and container managers
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1

# Optional one-time production repair runs inside the deployed container before
# the API starts. Remove RUN_PAYMENT_REPAIR_REFERENCE after the first success.
CMD ["sh", "-c", "if [ -n \"${RUN_PAYMENT_REPAIR_REFERENCE:-}\" ]; then python scripts/resend_payment_and_create_bumpa_order.py --reference \"$RUN_PAYMENT_REPAIR_REFERENCE\"; fi; exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
