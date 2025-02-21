document.addEventListener('DOMContentLoaded', () => {
  // Retrieve and display the stored Gemini API key (if any)
  chrome.storage.local.get(['geminiApiKey'], (data) => {
    const apiKeyInput = document.getElementById('gemini-api-key');
    if (data.geminiApiKey) {
      apiKeyInput.value = data.geminiApiKey;
    }
  });

  // Save button event handler for the API key
  document.getElementById('save-api-key').addEventListener('click', () => {
    const apiKey = document.getElementById('gemini-api-key').value.trim();
    chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
      console.log('Gemini API key saved:', apiKey);
    });
  });

  // Start Selection button event handler
  document.getElementById('startSelection').addEventListener('click', () => {
    // Retrieve the API key before proceeding.
    chrome.storage.local.get(['geminiApiKey'], (data) => {
      const apiKey = data.geminiApiKey && data.geminiApiKey.trim();
      if (!apiKey) {
        alert('Please set your Gemini API key before starting the selection.');
        return;
      }
      
      // Proceed if API key is set
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) {
          console.error('No active tab found.');
          return;
        }
        const currentTab = tabs[0];
    
        console.log(currentTab);
    
        chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ['lib/html2canvas.min.js', 'content.js']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error(`Failed to inject scripts: ${chrome.runtime.lastError.message}`);
            return;
          }
    
          console.log('Scripts injected successfully.');
          chrome.tabs.sendMessage(currentTab.id, { action: 'startSelection' });
          // window.close()
        });
      });
    });
  });
  
  document.getElementById('openCalendar').addEventListener('click', () => {
    window.open('https://calendar.google.com/', '_blank');
  });
});
