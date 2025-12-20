# IntentVision A2A Gateway Dockerfile
#
# Beads Task: intentvision-9xh
#
# Multi-stage build for the A2A gateway service.
# Deployed to Cloud Run.

FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY ../../requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY . /app/service/a2a_gateway/
COPY ../../agents /app/agents/

# Set Python path
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8081/health || exit 1

# Run with uvicorn
CMD ["uvicorn", "service.a2a_gateway.main:app", "--host", "0.0.0.0", "--port", "8081"]
