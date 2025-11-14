# Dockerfile for Babylon RL Training Pipeline
# Supports both training and inference

FROM nvidia/cuda:12.1.0-devel-ubuntu22.04

# Set environment
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV CUDA_HOME=/usr/local/cuda

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    git \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3.11 as default
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1

# Upgrade pip
RUN python3 -m pip install --upgrade pip

# Create app directory
WORKDIR /app

# Copy requirements first (for better caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install PyTorch with CUDA support
RUN pip install --no-cache-dir \
    torch==2.1.0 \
    torchvision==0.16.0 \
    torchaudio==2.1.0 \
    --index-url https://download.pytorch.org/whl/cu121

# Install training dependencies
RUN pip install --no-cache-dir \
    transformers==4.36.0 \
    trl==0.7.10 \
    datasets==2.16.0 \
    accelerate==0.25.0 \
    peft==0.7.1 \
    bitsandbytes==0.41.3 \
    wandb==0.16.2 \
    httpx==0.26.0 \
    asyncpg==0.29.0 \
    pyyaml==6.0.1

# Install vLLM for inference
RUN pip install --no-cache-dir vllm==0.2.7

# Copy application code
COPY . .

# Create directories
RUN mkdir -p checkpoints logs metrics

# Set permissions
RUN chmod +x scripts/*.sh scripts/*.py

# Healthcheck
HEALTHCHECK --interval=60s --timeout=10s --start-period=120s --retries=3 \
    CMD pgrep -f "run_continuous_training.py" || exit 1

# Default command (can be overridden)
CMD ["python3", "scripts/run_continuous_training.py"]



