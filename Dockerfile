FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

# Basic deps
RUN apt-get update && apt-get install -y git wget curl && rm -rf /var/lib/apt/lists/*

# Python & pip
RUN apt-get install -y python3 python3-pip
RUN ln -s /usr/bin/python3 /usr/bin/python

# Upgrade pip
RUN pip install --upgrade pip

# Install Python deps
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Copy your code
COPY src /workspace
WORKDIR /workspace

# RunPod expects a file that defines a `handler(event)` function
ENV HF_HUB_DISABLE_SYMLINKS_WARNING=1
CMD ["python", "-u", "handler.py"]

