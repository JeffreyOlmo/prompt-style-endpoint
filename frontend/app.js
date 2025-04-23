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
    
    try {
      const res = await fetch(statusEndpoint, {
        headers: { "Authorization": RUNPOD_API_KEY }
      });
      
      if (!res.ok) {
        console.error("Non-OK response from status endpoint:", res.status, res.statusText);
        throw new Error(`Failed to check job status: ${res.status} ${res.statusText}`);
      }
      
      const raw = await res.text();
      console.error("Raw status response:", raw);
      
      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        console.error("Failed to parse status response:", e);
        throw new Error("Invalid JSON in status response");
      }
      
      console.error("Status check:", data);

      if (data.status === "COMPLETED") {
        return data;
      } else if (data.status === "FAILED") {
        throw new Error(data.error || "Job failed");
      }
    } catch (e) {
      console.error("Error polling status:", e);
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
      
      console.error("Submitting job with prompt:", prompt);
      console.error("Base64 image length:", base64.length);
      
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

      if (!res.ok) {
        console.error("Non-OK response from endpoint:", res.status, res.statusText);
        throw new Error(`Failed to submit job: ${res.status} ${res.statusText}`);
      }
      
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
        console.error("No job ID in response:", submitResponse);
        throw new Error("No job ID returned");
      }

      console.error("📝 Job submitted, ID:", submitResponse.id);
      generateBtn.innerHTML = `${loadingSpinner} Processing...`;

      // Poll for results
      const result = await pollJobStatus(submitResponse.id);
      console.error("✅ Job completed full result:", JSON.stringify(result, null, 2));

      // Deeply inspect the structure
      for (const key in result) {
        console.error(`Top-level key: ${key}, Type: ${typeof result[key]}`);
        if (typeof result[key] === 'object' && result[key] !== null) {
          for (const subKey in result[key]) {
            console.error(`  Subkey: ${subKey}, Type: ${typeof result[key][subKey]}`);
            if (subKey === 'image_b64' || subKey === 'prompt_final') {
              const value = result[key][subKey];
              console.error(`  ${subKey} is ${value ? (typeof value === 'string' ? `string of length ${value.length}` : typeof value) : 'undefined'}`);
            }
          }
        }
      }
      
      // Try multiple ways to access the data
      let prompt_final = '';
      let image_b64 = '';
      
      // Method 1: Direct access through output (now checking for double-nested output)
      if (result.output && typeof result.output === 'object') {
        console.error("Trying method 1: Direct access through output");
        
        // Check for double-nested output structure
        if (result.output.output && typeof result.output.output === 'object') {
          console.error("Found double-nested output structure");
          prompt_final = result.output.output.prompt_final || '';
          image_b64 = result.output.output.image_b64 || '';
        } else {
          // Original structure
          prompt_final = result.output.prompt_final || '';
          image_b64 = result.output.image_b64 || '';
        }
        console.error(`Method 1 results - prompt_final: ${prompt_final ? 'found' : 'not found'}, image_b64: ${image_b64 ? 'found' : 'not found'}`);
      }
      
      // Method 2: Try to parse output if it's a string
      if (!image_b64 && result.output && typeof result.output === 'string') {
        console.error("Trying method 2: Parse output string");
        try {
          const parsedOutput = JSON.parse(result.output);
          prompt_final = parsedOutput.prompt_final || prompt_final;
          image_b64 = parsedOutput.image_b64 || image_b64;
          console.error(`Method 2 results - prompt_final: ${prompt_final ? 'found' : 'not found'}, image_b64: ${image_b64 ? 'found' : 'not found'}`);
        } catch (e) {
          console.error("Failed to parse output string:", e);
        }
      }
      
      // Method 3: Look for data in any property
      if (!image_b64) {
        console.error("Trying method 3: Search in all properties");
        for (const key in result) {
          if (typeof result[key] === 'object' && result[key]) {
            if (result[key].image_b64) {
              console.error(`Found image_b64 in result.${key}`);
              image_b64 = result[key].image_b64;
            }
            if (result[key].prompt_final) {
              console.error(`Found prompt_final in result.${key}`);
              prompt_final = result[key].prompt_final;
            }
          }
        }
        console.error(`Method 3 results - prompt_final: ${prompt_final ? 'found' : 'not found'}, image_b64: ${image_b64 ? 'found' : 'not found'}`);
      }
      
      if (!image_b64) {
        console.error("No image data found in response after all attempts.");
        throw new Error("No image data returned from the server");
      }
      
      // Set the prompt value even if missing
      if (!prompt_final) {
        prompt_final = "Style-adjusted prompt not available";
      }
      
      // Preload image
      const img = new Image();
      img.onerror = (e) => {
        console.error("Image load error:", e);
        console.error("First 100 chars of image_b64:", image_b64.substring(0, 100));
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