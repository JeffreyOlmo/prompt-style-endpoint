import json
import requests
from PIL import Image
from io import BytesIO
import base64
import torch
from transformers import CLIPProcessor, CLIPModel
from vllm import LLM, SamplingParams
from diffusers import DiffusionPipeline

print("🐍 handler.py has started running")

# --- Initialize CLIP for style embedding
clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to("cuda")
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

# --- Initialize Mistral with vLLM
llm = LLM(model="mistralai/Mistral-7B-Instruct-v0.2", dtype="float16")
params = SamplingParams(temperature=0.7, max_tokens=150)

# --- Initialize FLUX for image generation
pipe = DiffusionPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-dev",
    torch_dtype=torch.float16
).to("cuda")

def embed_style(style_img_url):
    image = Image.open(requests.get(style_img_url, stream=True).raw).convert("RGB")
    inputs = clip_processor(images=image, return_tensors="pt").to("cuda")
    with torch.no_grad():
        embedding = clip_model.get_image_features(**inputs)
    return embedding

def rewrite_prompt(prompt, style_emb):
    formatted = (
        f"User prompt: {prompt}\n"
        f"Style: Described via CLIP embedding\n"
        "Rewrite the prompt to match the style. Return only the new prompt."
    )
    return llm.generate([formatted], sampling_params=params)[0].outputs[0].text.strip()

def generate_image(prompt):
    image = pipe(prompt=prompt, num_inference_steps=30).images[0]
    return image

# --- RunPod handler entry point
def handler(event):
    inp = event.get("input", {})
    prompt = inp.get("prompt", "")
    style_url = inp.get("style_img_url", "")

    if not prompt or not style_url:
        return {"error": "prompt and style_img_url are required"}

    # Style embedding
    style_emb = embed_style(style_url)

    # Prompt reflection
    revised_prompt = rewrite_prompt(prompt, style_emb)

    # Generate image
    image = generate_image(revised_prompt)

    # Convert to base64
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

    return {
        "prompt_final": revised_prompt,
        "image_b64": img_b64
    }

def log_feedback(prompt, style_img_url, revised, vote):
    data = {
        "prompt": prompt,
        "style_img_url": style_img_url,
        "revised": revised,
        "vote": vote
    }
    with open("/workspace/feedback/feedback.jsonl", "a") as f:
        f.write(json.dumps(data) + "\n")

# Optional local test runner
if __name__ == "__main__":
    example_event = {
        "input": {
            "prompt": "A wizard in the forest",
            "style_img_url": "https://example.com/style.jpg"
        }
    }
    result = handler(example_event)
    print(json.dumps(result, indent=2))

