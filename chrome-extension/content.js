// Avoid re-injecting
if (window.hasAdphexCapture) {
  // If already injected, maybe just show the overlay again if it was hidden
  const existingOverlay = document.getElementById('adphex-overlay');
  if (existingOverlay) existingOverlay.style.display = 'flex';
} else {
  window.hasAdphexCapture = true;
  init();
}

function init() {
  createOverlay();
}

function createOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'adphex-overlay';
  overlay.innerHTML = `
    <div id="adphex-card">
      <h2 id="adphex-title">Adphex Capture</h2>
      <p id="adphex-description">
        We will scroll through the page to capture the entire bank statement.
        Please do not interact with the page while this happens.
      </p>
      
      <div id="adphex-progress" style="display: none;">
        <div id="adphex-progress-bar"></div>
      </div>
      <div id="adphex-status" style="display: none;">Starting...</div>

      <div id="adphex-preview-container" style="display: none;">
        <img id="adphex-preview-img" />
      </div>

      <div id="adphex-actions">
        <button id="adphex-cancel-btn" class="adphex-btn adphex-btn-secondary">Cancel</button>
        <button id="adphex-start-btn" class="adphex-btn adphex-btn-primary">Start Capture</button>
      </div>
      
      <div id="adphex-confirm-actions" style="display: none;">
        <button id="adphex-discard-btn" class="adphex-btn adphex-btn-secondary">Discard</button>
        <button id="adphex-upload-btn" class="adphex-btn adphex-btn-primary">Upload to Adphex</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('adphex-cancel-btn').addEventListener('click', closeOverlay);
  document.getElementById('adphex-start-btn').addEventListener('click', startCapture);
  document.getElementById('adphex-discard-btn').addEventListener('click', resetCapture);
  document.getElementById('adphex-upload-btn').addEventListener('click', uploadCapture);
}

function closeOverlay() {
  const overlay = document.getElementById('adphex-overlay');
  if (overlay) overlay.remove();
  window.hasAdphexCapture = false;
}

function resetCapture() {
  document.getElementById('adphex-description').style.display = 'block';
  document.getElementById('adphex-actions').style.display = 'block';
  document.getElementById('adphex-preview-container').style.display = 'none';
  document.getElementById('adphex-confirm-actions').style.display = 'none';
  document.getElementById('adphex-title').textContent = 'Adphex Capture';
  capturedDataUrl = null;
}

let capturedDataUrl = null;

async function startCapture() {
  const overlay = document.getElementById('adphex-overlay');
  const progressBar = document.getElementById('adphex-progress-bar');
  const progressContainer = document.getElementById('adphex-progress');
  const statusEl = document.getElementById('adphex-status');
  
  // Hide UI for capture
  overlay.style.display = 'none';
  
  // Wait a bit for UI to hide
  await sleep(200);

  try {
    const snapshots = [];
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    let currentScroll = 0;
    
    // Scroll to top first
    window.scrollTo(0, 0);
    await sleep(500); // Wait for potential sticky headers/lazy load

    while (true) {
      const realScrollY = window.scrollY;
      
      // Capture
      const dataUrl = await captureVisibleTab();
      snapshots.push({ y: realScrollY, dataUrl });

      // Check if we are at the bottom
      if (realScrollY + clientHeight >= scrollHeight) {
        break;
      }
      
      // Scroll down
      const nextScroll = realScrollY + clientHeight;
      window.scrollTo(0, nextScroll);
      await sleep(500); // Wait for render
      
      // If we didn't move (clamped), break
      if (window.scrollY === realScrollY) {
        break;
      }
    }

    // Stitch images
    statusEl.textContent = 'Stitching images...';
    statusEl.style.display = 'block';
    
    // Restore scroll
    window.scrollTo(0, 0);

    const finalImage = await stitchImages(snapshots, scrollHeight, clientHeight);
    capturedDataUrl = finalImage;

    // Show result
    overlay.style.display = 'flex';
    document.getElementById('adphex-description').style.display = 'none';
    document.getElementById('adphex-actions').style.display = 'none';
    document.getElementById('adphex-progress').style.display = 'none';
    document.getElementById('adphex-status').style.display = 'none';
    
    const previewImg = document.getElementById('adphex-preview-img');
    previewImg.src = finalImage;
    document.getElementById('adphex-preview-container').style.display = 'block';
    document.getElementById('adphex-confirm-actions').style.display = 'block';
    document.getElementById('adphex-title').textContent = 'Capture Complete';

  } catch (err) {
    console.error(err);
    alert('Capture failed: ' + err.message);
    overlay.style.display = 'flex';
  }
}

function captureVisibleTab() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'captureVisibleTab' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response && response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response.dataUrl);
      }
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function stitchImages(snapshots, totalHeight, viewportHeight) {
  const canvas = document.createElement('canvas');
  const scrollWidth = document.documentElement.scrollWidth;
  
  // Set canvas dimensions
  // We need to know the actual image dimensions. DataURL gives us an image, but it might be 2x for retina.
  // We'll load the first image to check dimensions.
  const firstImg = await loadImage(snapshots[0].dataUrl);
  const scaleFactor = firstImg.width / window.innerWidth; // Approximate scale factor

  canvas.width = firstImg.width;
  canvas.height = totalHeight * scaleFactor;

  const ctx = canvas.getContext('2d');

  for (const snap of snapshots) {
    const img = await loadImage(snap.dataUrl);
    // Draw at the correct Y position (scaled)
    ctx.drawImage(img, 0, snap.y * scaleFactor);
  }

  return canvas.toDataURL('image/png');
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function uploadCapture() {
  if (!capturedDataUrl) return;

  const btn = document.getElementById('adphex-upload-btn');
  const originalText = btn.textContent;
  btn.textContent = 'Uploading...';
  btn.disabled = true;

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'uploadScreenshot', dataUrl: capturedDataUrl },
        (res) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else if (!res.success) reject(new Error(res.error));
          else resolve(res.result);
        }
      );
    });

    alert('Upload successful! You can now view it in Adphex.');
    closeOverlay();
  } catch (err) {
    console.error(err);
    alert('Upload failed: ' + err.message);
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

