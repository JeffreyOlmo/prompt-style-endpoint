FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

# Basic tools and Python
RUN apt-get update && apt-get install -y \
    git wget curl python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install Python packages
RUN pip install --upgrade pip
RUN pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
RUN pip install transformers accelerate

# DeepSeek-VL repo
RUN git clone https://github.com/deepseek-ai/DeepSeek-VL.git /workspace/DeepSeek-VL
WORKDIR /workspace/DeepSeek-VL
RUN pip install -e .

# Your handler
COPY handler.py /workspace/handler.py

CMD ["python3", "-u", "handler.py"]
