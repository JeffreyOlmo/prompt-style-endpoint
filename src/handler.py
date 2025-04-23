import json
import requests
from PIL import Image
from io import BytesIO
import base64
import torch
from transformers import AutoModelForCausalLM
from deepseek_vl.models import VLChatProcessor
from deepseek_vl.utils.io import load_pil_images

print("🐍 handler.py has started running")

# --- Initialize DeepSeek-VL
model_path = "deepseek-ai/deepseek-vl-7b-chat"
processor = VLChatProcessor.from_pretrained(model_path)
tokenizer = processor.tokenizer
model = AutoModelForCausalLM.from_pretrained(model_path, trust_remote_code=True)
model = model.to(torch.bfloat16).cuda().eval()

def download_image(url):
    response = requests.get(url)
    return Image.open(BytesIO(response.content)).convert("RGB")

def reflect_prompt(prompt, style_img_url):
    image = download_image(style_img_url)

    conversation = [
        {
            "role": "User",
            "content": f"Rewrite this prompt to match the style of the image: {prompt}",
            "images": [image]
        },
        {
            "role": "Assistant",
            "content": ""
        }
    ]

    inputs = processor(conversation, images=[image], force_batchify=True).to(model.device)
    inputs_embeds = model.prepare_inputs_embeds(**inputs)

    outputs = model.language_model.generate(
        inputs_embeds=inputs_embeds,
        attention_mask=inputs.attention_mask,
        pad_token_id=tokenizer.eos_token_id,
        bos_token_id=tokenizer.bos_token_id,
        eos_token_id=tokenizer.eos_token_id,
        max_new_tokens=150,
        do_sample=False
    )

    decoded = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return decoded

def handler(event):
    inp = event.get("input", {})
    prompt = inp.get("prompt", "")
    style_url = inp.get("style_img_url", "")

    if not prompt or not style_url:
        return {"error": "prompt and style_img_url are required"}

    revised_prompt = reflect_prompt(prompt, style_url)

    return {
        "prompt_final": revised_prompt,
        "image_b64": None  # No image gen yet
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

if __name__ == "__main__":
    example_event = {
        "input": {
            "prompt": "A wizard in the forest",
            "style_img_url": "https://i.imgur.com/ZcLLrkY.jpg"
        }
    }
    result = handler(example_event)
    print(json.dumps(result, indent=2))
