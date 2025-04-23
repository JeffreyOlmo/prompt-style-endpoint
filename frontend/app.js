import { RUNPOD_ENDPOINT, RUNPOD_API_KEY } from './config.js';

const promptInput = document.getElementById("promptInput");
const styleInput  = document.getElementById("styleInput");
const generateBtn = document.getElementById("generateBtn");
const resultArea  = document.getElementById("resultArea");
const resultImg   = document.getElementById("resultImg");
const thumbsUp    = document.getElementById("thumbsUp");
const thumbsDown  = document.getElementById("thumbsDown");

let lastPrompt = "";
let lastStyleB64 = "";

async function pollJobStatus(jobId) {
  const statusEndpoint = `https://api.runpod.ai/v2/63k0wfq3i5dgce/status/${jobId}`;
  while (true) {
    const res = await fetch(statusEndpoint, {
      headers: { "Authorization": RUNPOD_API_KEY }
    });
    const data = await res.json();
    console.error("Status check:", data);

    if (data.status === "COMPLETED") {
      return data;
    } else if (data.status === "FAILED") {
      throw new Error(data.error || "Job failed");
    }
    
    // Wait 1 second before polling again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

generateBtn.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();
  const file   = styleInput.files[0];
  if (!prompt || !file) {
    return alert("Please enter a prompt and select a style image.");
  }

  // Disable UI
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating…";

  // Read image as base64
  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = reader.result;
    const base64  = dataUrl.split(",")[1];
    lastPrompt    = prompt;
    lastStyleB64  = base64;

    try {
      // Submit the job
      const res = await fetch(RUNPOD_ENDPOINT, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": RUNPOD_API_KEY
        },
        body: JSON.stringify({
          input: {
            prompt: prompt,
            style_img_b64: base64
          }
        })
      });

      const raw = await res.text();
      console.error("\n\n🌐 INITIAL RESPONSE FROM RUNPOD:");
      console.error(raw);

      let submitResponse;
      try {
        submitResponse = JSON.parse(raw);
      } catch (e) {
        console.error("❌ JSON Parse Error:", e);
        alert("Error submitting job:\n" + e.message);
        return;
      }

      if (!submitResponse.id) {
        throw new Error("No job ID returned");
      }

      console.error("📝 Job submitted, ID:", submitResponse.id);
      generateBtn.textContent = "Processing...";

      // Poll for results
      const result = await pollJobStatus(submitResponse.id);
      console.error("✅ Job completed:", result);

      // Show result
      const { image_b64 } = result.output;
      resultImg.src = "data:image/png;base64," + image_b64;
      resultArea.classList.remove("hidden");

    } catch (e) {
      console.error("❌ Error:", e);
      alert("Error generating image:\n" + e.message);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate Image";
    }
  };
  reader.readAsDataURL(file);
});

thumbsUp.addEventListener("click", () => sendFeedback("up"));
thumbsDown.addEventListener("click", () => sendFeedback("down"));

async function sendFeedback(vote) {
  try {
    await fetch(RUNPOD_ENDPOINT, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": RUNPOD_API_KEY
      },
      body: JSON.stringify({
        input: {
          prompt: lastPrompt,
          style_img_b64: lastStyleB64,
          feedback: vote
        }
      })
    });
    alert("Thanks for your feedback!");
  } catch (e) {
    console.error(e);
    alert("Failed to send feedback.");
  }
} 