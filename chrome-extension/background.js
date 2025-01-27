// background.js

// Listener for extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Inject content scripts into the active tab
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['lib/html2canvas.min.js', 'content.js']
  }, () => {
    if (chrome.runtime.lastError) {
      console.error(`Script injection failed: ${chrome.runtime.lastError.message}`);
    } else {
      console.log('Content scripts injected successfully.');
      // Send a message to content script to start selection
      chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
    }
  });
});

// Listener for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'screenshotCaptured' && request.dataURL) {
    // Open the confirmation popup window with the screenshot data
    chrome.windows.create({
      url: chrome.runtime.getURL('popup/confirmation.html'),
      type: 'popup',
      width: 400,
      height: 600
    }, (window) => {
      // Optionally, pass the screenshot data to the confirmation popup
      // This can be done via chrome.storage or other methods
      // Here, we'll use chrome.storage
      chrome.storage.local.set({ screenshot: request.dataURL }, () => {
        console.log('Screenshot data stored for confirmation popup.');
      });
    });
  }
});
