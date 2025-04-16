class LLM:
    def __init__(self, *args, **kwargs):
        print("[mock] Loaded fake LLM")

    def generate(self, prompts, sampling_params=None):
        print(f"[mock] Reasoning on prompt: {prompts[0]}")
        return ["A revised prompt in the correct style."]

