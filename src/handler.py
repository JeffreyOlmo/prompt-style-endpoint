import json
import requests
from PIL import Image
from io import BytesIO
from pathlib import Path

# Use mock LLM if vllm isn't available (for local dev)
try:
    from vllm import LLM
except ImportError:
    from fake_vllm import LLM

print("🐍 handler.py has started running")


# --- Initialize LLM (just once)
llm = LLM()

# --- Style image encoder (mock for now)
def get_style_description(img_url):
    print(f"[mock] Would download and embed: {img_url}")
    return "soft pastel brushstrokes with watercolor bloom effects"

# --- Prompt rewriting
def rewrite_prompt(prompt, style_description):
    template = (
        f"User prompt: {prompt}\n"
        f"Style: {style_description}\n\n"
        "Rewrite the prompt to match the style. Return only the new prompt."
    )
    new_prompt = llm.generate([template])[0]
    return new_prompt

# --- Image generation (mock for now)
def generate_image(prompt):
    print(f"[mock] Would generate image from prompt: {prompt}")
    return "base64-encoded-image-data"

# --- RunPod handler entry point
def handler(event):
    inp = event.get("input", {})
    prompt = inp.get("prompt", "")
    style_url = inp.get("style_img_url", "")

    if not prompt or not style_url:
        return {"error": "prompt and style_img_url are required"}

    # Style embedding
    style_desc = get_style_description(style_url)

    # Prompt reflection
    new_prompt = rewrite_prompt(prompt, style_desc)

    # Generate image
    image_b64 = generate_image(new_prompt)

    return {
        "prompt_final": new_prompt,
        "image_b64": image_b64
    }

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

