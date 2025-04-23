FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

# --- Basic tools and Python
RUN apt-get update && apt-get install -y \
    git wget curl python3 python3-pip ffmpeg libsm6 libxext6 \
    && rm -rf /var/lib/apt/lists/*

# --- Python packages
RUN pip install --upgrade pip && \
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118 && \
    pip install transformers accelerate diffusers \
    pillow requests huggingface_hub safetensors

# --- DeepSeek-VL
RUN pip install git+https://github.com/deepseek-ai/DeepSeek-VL.git

# --- Set up model cache directory
ENV HF_HOME=/workspace/.cache/huggingface
RUN mkdir -p $TRANSFORMERS_CACHE

# --- Pre-download DeepSeek model weights
RUN python3 -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='deepseek-ai/deepseek-vl-7b-chat', local_dir='$TRANSFORMERS_CACHE/models--deepseek-ai--deepseek-vl-7b-chat', local_dir_use_symlinks=False)"

# --- Optional: create a logging folder
RUN mkdir -p /workspace/feedback

# --- Copy handler
COPY handler.py /workspace/handler.py
WORKDIR /workspace
CMD ["python3", "-u", "handler.py"]
