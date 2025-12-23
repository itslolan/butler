const APP_URL = 'https://adphex.com';
const AUTH_CHECK_URL = `${APP_URL}/api/user/me`;

document.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('loading');
  const loginSection = document.getElementById('login-section');
  const captureSection = document.getElementById('capture-section');
  const loginBtn = document.getElementById('login-btn');
  const captureBtn = document.getElementById('capture-btn');
  const statusMsg = document.getElementById('status-msg');

  async function checkAuth() {
    try {
      const response = await fetch(AUTH_CHECK_URL);
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          showCapture();
        } else {
          showLogin();
        }
      } else {
        showLogin();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      showLogin();
    }
  }

  function showLogin() {
    loadingEl.classList.add('hidden');
    loginSection.classList.remove('hidden');
    captureSection.classList.add('hidden');
  }

  function showCapture() {
    loadingEl.classList.add('hidden');
    loginSection.classList.add('hidden');
    captureSection.classList.remove('hidden');
  }

  loginBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: `${APP_URL}/login` });
  });

  captureBtn.addEventListener('click', async () => {
    captureBtn.disabled = true;
    captureBtn.textContent = 'Initializing...';
    
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      statusMsg.textContent = 'No active tab found.';
      statusMsg.className = 'status error';
      statusMsg.classList.remove('hidden');
      captureBtn.disabled = false;
      captureBtn.textContent = 'Take Full Page Screenshot';
      return;
    }

    // Inject content script
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['styles.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      // Close popup so the content script overlay can take over
      window.close();
    } catch (err) {
      console.error('Failed to inject script:', err);
      statusMsg.textContent = 'Failed to start capture. Please refresh the page and try again.';
      statusMsg.className = 'status error';
      statusMsg.classList.remove('hidden');
      captureBtn.disabled = false;
      captureBtn.textContent = 'Take Full Page Screenshot';
    }
  });

  // Initial check
  checkAuth();
});

