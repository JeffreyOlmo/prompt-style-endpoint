import json
import requests
from PIL import Image
from io import BytesIO
import base64
import torch
from transformers import AutoModelForCausalLM
from deepseek_vl.models import VLChatProcessor, MultiModalityCausalLM
from deepseek_vl.utils.io import load_pil_images
from diffusers import DiffusionPipeline
import os
import runpod
import sys
import traceback

os.environ["HF_HOME"] = "/workspace/.cache"
os.environ["TRANSFORMERS_CACHE"] = "/workspace/.cache"

print("🐍 handler.py has started running")

# --- Initialize DeepSeek Multimodal Model
model_path = "/workspace/.cache/huggingface/models--deepseek-ai--deepseek-vl-7b-chat"
vl_chat_processor = VLChatProcessor.from_pretrained(model_path)
tokenizer = vl_chat_processor.tokenizer
vl_gpt = AutoModelForCausalLM.from_pretrained(model_path, trust_remote_code=True)
vl_gpt = vl_gpt.to(torch.bfloat16).cuda().eval()

# --- Initialize FLUX for image generation
pipe = DiffusionPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-dev",
    torch_dtype=torch.float16
).to("cuda")

def get_image_from_url_or_base64(url_or_base64):
    try:
        # First try to decode as base64
        if isinstance(url_or_base64, str) and ',' in url_or_base64:
            # Handle data URL format
            base64_data = url_or_base64.split(',')[1]
        else:
            base64_data = url_or_base64
            
        try:
            image_data = base64.b64decode(base64_data)
            return Image.open(BytesIO(image_data)).convert("RGB")
        except:
            # If base64 decode fails, treat as URL
            headers = {"User-Agent": "Mozilla/5.0"}
            response = requests.get(url_or_base64, headers=headers)
            
            if response.status_code != 200 or "image" not in response.headers.get("Content-Type", ""):
                raise ValueError(f"Failed to fetch valid image. Status: {response.status_code}")
            
            return Image.open(BytesIO(response.content)).convert("RGB")
    except Exception as e:
        raise ValueError(f"Failed to load image: {str(e)}")

def reflect_prompt(prompt, style_img):
    print(f"Reflecting prompt: '{prompt}'")
    # Convert input to PIL Image if needed
    if isinstance(style_img, str):
        image = get_image_from_url_or_base64(style_img)
    else:
        image = style_img

    # Save the image temporarily
    local_image_path = "/tmp/style_image.jpg"
    image.save(local_image_path)
    print(f"Saved reference image to {local_image_path}")

    conversation = [
        {
            "role": "User",
            "content": f"Rewrite the prompt to match the style, colors, and theme of this reference image: <image_placeholder>; be verbose and detailed while maintaining fidelity to the original prompt",
            "images": [local_image_path],
        },
        {
            "role": "User",
            "content": prompt,
        },
        {
            "role": "Assistant",
            "content": "",
        },
    ]

    pil_images = load_pil_images(conversation)
    prepare_inputs = vl_chat_processor(
        conversations=conversation,
        images=pil_images,
        force_batchify=True
    ).to(vl_gpt.device)

    inputs_embeds = vl_gpt.prepare_inputs_embeds(**prepare_inputs)
    print("Generating revised prompt...")
    outputs = vl_gpt.language_model.generate(
        inputs_embeds=inputs_embeds,
        attention_mask=prepare_inputs.attention_mask,
        pad_token_id=tokenizer.eos_token_id,
        bos_token_id=tokenizer.bos_token_id,
        eos_token_id=tokenizer.eos_token_id,
        max_new_tokens=150,
        do_sample=False,
        use_cache=True
    )
    revised = tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
    print(f"Generated revised prompt: '{revised}'")
    return revised


def generate_image(prompt):
    print(f"Generating image with prompt: '{prompt}'")
    image = pipe(prompt=prompt, num_inference_steps=30).images[0]
    print(f"Image generated successfully, size: {image.size}")
    return image

def handler(event):
    try:
        print("Handler called with event:", event)
        inp = event.get("input", {})
        prompt = inp.get("prompt", "")
        style_img = inp.get("style_img_b64") or inp.get("style_img_url")

        if not prompt or not style_img:
            return {"error": "prompt and either style_img_url or style_img_b64 are required"}

        revised_prompt = reflect_prompt(prompt, style_img)
        image = generate_image(revised_prompt)

        print("Encoding image...")
        buffered = BytesIO()
        image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        print(f"Image encoded as base64, length: {len(img_str)} characters")
        
        result = {
            "prompt_final": revised_prompt,
            "image_b64": img_str
        }
        
        print(f"Returning result with keys: {list(result.keys())}")
        # Ensure the result is properly formatted for RunPod
        return {
            "output": result
        }
        
    except Exception as e:
        print(f"Error in handler: {str(e)}")
        print("Exception details:", traceback.format_exc())
        return {
            "output": None,
            "error": str(e)
        }

# Start the serverless handler
print("Starting RunPod Serverless handler...")
runpod.serverless.start({
    "handler": handler
})
