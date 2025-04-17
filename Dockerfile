FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y \
    git wget curl python3 python3-pip patch xauth \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY src /workspace
WORKDIR /workspace

ENV HF_TOKEN=<your-hf-token-if-needed>
CMD ["python", "-u", "handler.py"]
