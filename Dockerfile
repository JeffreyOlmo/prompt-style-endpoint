FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

# Basic tools and Python
RUN apt-get update && apt-get install -y \
    git wget curl python3 python3-pip ffmpeg libsm6 libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Python packages (minimal but complete)
RUN pip install --upgrade pip && \
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118 && \
    pip install transformers accelerate diffusers \
    pillow requests huggingface_hub safetensors

# DeepSeek-VL (install from GitHub if not using local clone)
RUN pip install git+https://github.com/deepseek-ai/DeepSeek-VL.git

# Create feedback directory (optional logging)
RUN mkdir -p /workspace/feedback

# Copy your handler and set up workspace
COPY handler.py /workspace/handler.py
WORKDIR /workspace
CMD ["python3", "-u", "handler.py"]
