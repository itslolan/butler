const APP_URL = 'https://adphex.com';
const UPLOAD_URL = `${APP_URL}/api/upload`;
const AUTH_CHECK_URL = `${APP_URL}/api/user/me`;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureVisibleTab') {
    chrome.tabs.captureVisibleTab(
      sender.tab.windowId,
      { format: 'png' },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ dataUrl });
        }
      }
    );
    return true; // Indicates we will respond asynchronously
  }

  if (request.action === 'uploadScreenshot') {
    uploadScreenshot(request.dataUrl)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  }
});

async function uploadScreenshot(dataUrl) {
  // Convert Data URL to Blob
  const res = await fetch(dataUrl);
  const blob = await res.blob();

  // Create FormData
  const formData = new FormData();
  formData.append('file', blob, `screenshot-${new Date().toISOString()}.png`);
  
  // We first need to get the user ID to pass it in the form data, 
  // although the cookie handles authentication, the upload endpoint might expect userId in body 
  // based on the codebase search (userId = formData.get('userId')).
  // We can fetch it from the auth check endpoint.

  try {
    const authRes = await fetch(AUTH_CHECK_URL);
    if (!authRes.ok) throw new Error('Not authenticated');
    const authData = await authRes.json();
    if (!authData.authenticated) throw new Error('Not authenticated');
    
    formData.append('userId', authData.userId);
    formData.append('sourceType', 'extension_capture');

    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      body: formData,
      // specific headers are not needed for FormData, browser sets them (including boundary)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

