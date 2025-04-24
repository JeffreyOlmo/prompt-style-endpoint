# Style-Based Image Generation with RunPod

A powerful API endpoint for generating high-quality images based on text prompts and optional style reference images, deployed on RunPod.

![Banner Image](docs/banner.png)

## Overview

This project implements a RunPod serverless endpoint that combines the power of two AI models:

1. **DeepSeek-VL 7B**: Analyzes reference images and enhances prompts with style details
2. **FLUX.1**: Generates high-quality images based on the enhanced prompts


## Features

- **Text-to-Image Generation**: Create images from text prompts
- **Style-Based Generation**: Use reference images to influence the style of generated images
- **High-Quality Output**: Generate detailed 1024x1024 images
- **Serverless Deployment**: Scale automatically with demand
- **Simple API**: Easy integration with any application

## Getting Started

### Prerequisites

- A RunPod account with API access
- Docker installed (for local development or custom builds)
- Python 3.8+ (for local testing)

### Quick Start

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/style-image-generator.git
   cd style-image-generator
   ```

2. Review the handler implementation:
   ```bash
   cat src/handler.py
   ```

3. Follow the [Setup Guide](docs/SETUP_GUIDE.md) to deploy your endpoint

### Using the API

#### Basic Request (Text-to-Image)

```json
{
  "input": {
    "prompt": "A scenic mountain landscape with a lake",
    "guidance_scale": 7.5,
    "num_inference_steps": 50
  }
}
```

#### Style-Based Request (with Reference Image)

```json
{
  "input": {
    "prompt": "A scenic mountain landscape with a lake",
    "style_image_url": "https://example.com/reference_image.jpg",
    "guidance_scale": 7.5,
    "num_inference_steps": 50
  }
}
```

For detailed API documentation, see [API Documentation](docs/API_DOCUMENTATION.md).

## Folder Structure

```
style-image-generator/
├── src/
│   └── handler.py      # RunPod serverless handler implementation
├── docs/
│   ├── API_DOCUMENTATION.md  # API usage documentation
│   ├── SETUP_GUIDE.md        # Deployment instructions
│   └── MODEL_DETAILS.md      # Technical details about the models
├── examples/
│   ├── client_example.py     # Python client example
│   └── sample_images/        # Sample input/output images
├── Dockerfile          # Docker configuration for deployment
└── README.md           # This file
```

## Technical Details

### How It Works

1. **Initialization**: When the server starts, it loads both AI models into memory
2. **Request Processing**: 
   - The handler receives a request with a text prompt and optional reference image
   - If a reference image is provided, DeepSeek-VL analyzes it and enhances the prompt
   - FLUX.1 generates an image based on the prompt (enhanced or original)
   - The generated image is returned as base64-encoded data

### Models

- **DeepSeek-VL 7B**: A vision-language model that understands images and text
- **FLUX.1**: A text-to-image model that generates high-quality images

For detailed information about the models, see [Model Details](docs/MODEL_DETAILS.md).

## Performance and Resources

- **GPU Requirements**: At least 16GB VRAM (24GB+ recommended)
- **Processing Time**: 10-20 seconds per image (depending on configuration)
- **Memory Usage**: ~30GB VRAM during peak usage
- **Cost Considerations**: See deployment guide for RunPod pricing details

## Examples

### Input and Output Examples

| Prompt | Style Reference | Generated Image |
|--------|-----------------|-----------------|
| "A castle on a hill at sunset" | [Impressionist Painting] | [Generated Castle Image] |
| "A futuristic city skyline" | [Cyberpunk Style] | [Generated City Image] |
| "A peaceful forest scene" | [Studio Ghibli Style] | [Generated Forest Image] |

For more examples, see the [examples/](examples/) directory.

## Integration Examples

### Python Client

```python
import requests
import base64
from PIL import Image
from io import BytesIO

# API configuration
API_URL = "https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/run"
API_KEY = "YOUR_RUNPOD_API_KEY"

# Prepare request
payload = {
    "input": {
        "prompt": "A scenic mountain landscape with a lake"
    }
}

# Make request
response = requests.post(
    API_URL,
    headers={"Authorization": f"Bearer {API_KEY}"},
    json=payload
)

# Get job ID
job_id = response.json()["id"]

# Poll for results
status_url = f"https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/status/{job_id}"
while True:
    status_response = requests.get(
        status_url,
        headers={"Authorization": f"Bearer {API_KEY}"}
    )
    status_data = status_response.json()
    
    if status_data["status"] == "COMPLETED":
        # Save the generated image
        image_data = base64.b64decode(status_data["output"]["image"])
        image = Image.open(BytesIO(image_data))
        image.save("generated_image.png")
        break
    elif status_data["status"] == "FAILED":
        print("Error:", status_data["error"])
        break
```


## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [RunPod](https://www.runpod.io/) for the serverless GPU infrastructure
- [DeepSeek AI](https://github.com/deepseek-ai) for the DeepSeek-VL model
- [OpenAI](https://openai.com/) for the FLUX.1 model
- [Hugging Face](https://huggingface.co/) for the Transformers and Diffusers libraries 
