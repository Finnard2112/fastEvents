// background.js

let isContentScriptInjected = {};

// Listener for extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (isContentScriptInjected[tab.id]) {
    console.log('Content script already injected in this tab.');
    return;
  }

  // Inject html2canvas.min.js first, then content.js
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['lib/html2canvas.min.js']
  }, () => {
    if (chrome.runtime.lastError) {
      console.error(`Failed to inject html2canvas.min.js: ${chrome.runtime.lastError.message}`);
      return;
    }
    console.log('html2canvas.min.js injected successfully.');

    // Now inject content.js
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error(`Failed to inject content.js: ${chrome.runtime.lastError.message}`);
      } else {
        console.log('content.js injected successfully.');
        isContentScriptInjected[tab.id] = true;

        // Send a message to content.js to start selection
        chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
      }
    });
  });
});

// Listener for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'screenshotCaptured' && request.dataURL) {
    // Store the screenshot data
    chrome.storage.local.set({ screenshot: request.dataURL }, () => {
      console.log('Screenshot data stored.');
    });

    // Open the confirmation popup window with the screenshot data
    chrome.windows.create({
      url: chrome.runtime.getURL('popup/confirmation.html'),
      type: 'popup',
      width: 400,
      height: 600
    }, (window) => {
      console.log('Confirmation popup opened.');
    });
  }
});

// Reset the injection flag when the tab is removed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  delete isContentScriptInjected[tabId];
});

// Reset the injection flag when the tab is updated (e.g., reloaded)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    delete isContentScriptInjected[tabId];
  }
});
