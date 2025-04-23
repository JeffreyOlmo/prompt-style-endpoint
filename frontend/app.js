import { RUNPOD_ENDPOINT, RUNPOD_API_KEY } from './config.js';

const promptInput = document.getElementById("promptInput");
const styleInput  = document.getElementById("styleInput");
const generateBtn = document.getElementById("generateBtn");
const resultArea  = document.getElementById("resultArea");
const resultImg   = document.getElementById("resultImg");
const thumbsUp    = document.getElementById("thumbsUp");
const thumbsDown  = document.getElementById("thumbsDown");
const originalPromptEl = document.getElementById("originalPrompt");
const adjustedPromptEl = document.getElementById("adjustedPrompt");

let lastPrompt = "";
let lastStyleB64 = "";

// Loading animation HTML for the button
const loadingSpinner = `
  <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
`;

async function pollJobStatus(jobId) {
  const statusEndpoint = `https://api.runpod.ai/v2/63k0wfq3i5dgce/status/${jobId}`;
  
  let dots = "";
  let pollCounter = 0;
  
  while (true) {
    // Update loading animation
    pollCounter++;
    dots = ".".repeat(pollCounter % 4);
    generateBtn.innerHTML = `${loadingSpinner} Processing${dots}`;
    
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
    showNotification("Please enter a prompt and select a style image.", "error");
    return;
  }

  // Disable UI and show loading state
  generateBtn.disabled = true;
  generateBtn.innerHTML = `${loadingSpinner} Starting job...`;
  resultArea.classList.add("hidden");

  // Read image as base64
  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = reader.result;
    const base64  = dataUrl.split(",")[1];
    lastPrompt    = prompt;
    lastStyleB64  = base64;

    try {
      // Submit the job
      generateBtn.innerHTML = `${loadingSpinner} Uploading...`;
      
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
        showNotification("Error parsing response from server. Check console for details.", "error");
        return;
      }

      if (!submitResponse.id) {
        throw new Error("No job ID returned");
      }

      console.error("📝 Job submitted, ID:", submitResponse.id);
      generateBtn.innerHTML = `${loadingSpinner} Processing...`;

      // Poll for results
      const result = await pollJobStatus(submitResponse.id);
      console.error("✅ Job completed:", result);

      // The data structure from RunPod includes a nested output object
      if (!result || !result.output) {
        console.error("Invalid response structure:", result);
        throw new Error("Invalid response from server: missing output data");
      }
      
      console.error("Output data:", result.output);
      
      const prompt_final = result.output.prompt_final || "No adjusted prompt returned";
      const image_b64 = result.output.image_b64;
      
      if (!image_b64) {
        console.error("No image data in response:", result.output);
        throw new Error("No image data returned from the server");
      }
      
      // Preload image
      const img = new Image();
      img.onerror = (e) => {
        console.error("Image load error:", e);
        showNotification("Error loading generated image", "error");
      };
      img.onload = () => {
        resultImg.src = img.src;
        originalPromptEl.textContent = prompt;
        adjustedPromptEl.textContent = prompt_final;
        resultArea.classList.remove("hidden");
        
        // Scroll to results on mobile
        if (window.innerWidth < 768) {
          resultArea.scrollIntoView({ behavior: 'smooth' });
        }
      };
      img.src = "data:image/png;base64," + image_b64;
      
      showNotification("Image generated successfully!", "success");

    } catch (e) {
      console.error("❌ Error:", e);
      showNotification("Error generating image: " + e.message, "error");
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
  const button = vote === "up" ? thumbsUp : thumbsDown;
  const originalText = button.innerHTML;
  
  try {
    button.innerHTML = loadingSpinner + (vote === "up" ? "Sending..." : "Sending...");
    button.disabled = true;
    
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
    
    showNotification("Thanks for your feedback!", "success");
  } catch (e) {
    console.error(e);
    showNotification("Failed to send feedback.", "error");
  } finally {
    button.innerHTML = originalText;
    button.disabled = false;
  }
}

// Simple notification system
function showNotification(message, type = "info") {
  // Remove any existing notifications
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(note => note.remove());
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transition-all duration-300 transform translate-x-full`;
  
  // Set colors based on type
  if (type === "error") {
    notification.classList.add('bg-red-600', 'text-white');
  } else if (type === "success") {
    notification.classList.add('bg-green-600', 'text-white');
  } else {
    notification.classList.add('bg-ui-purple-500', 'text-white');
  }
  
  // Add content
  notification.innerHTML = message;
  
  // Add to document
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.classList.remove('translate-x-full');
  }, 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
} 