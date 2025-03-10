document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('gemini-api-key');
  const revealButton = document.getElementById('reveal-api-key');
  const getKeyButton = document.getElementById('get-api-key');
  const quickAddToggle = document.getElementById('quickAddToggle');
  let isKeyVisible = false;

  // Load the saved toggle state
  chrome.storage.local.get(['useQuickAddForScreenshot'], (data) => {
    if (data.useQuickAddForScreenshot) {
      quickAddToggle.checked = data.useQuickAddForScreenshot;
    }
  });

  // Save toggle state when changed
  quickAddToggle.addEventListener('change', () => {
    chrome.storage.local.set({ useQuickAddForScreenshot: quickAddToggle.checked });
  });

  getKeyButton.addEventListener('click', () => {
    window.open('https://aistudio.google.com/apikey', '_blank');
  });

  // Retrieve and display the stored Gemini API key (if any)
  chrome.storage.local.get(['geminiApiKey'], (data) => {
    if (data.geminiApiKey) {
      apiKeyInput.value = data.geminiApiKey;  // Store the actual key
      apiKeyInput.type = 'password';          // Mask it visually
    }
  });

  async function validateGeminiApiKey(apiKey) {
    try {
      // Simple validation request to Gemini API
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const response = await fetch(url);
      
      if (response.status === 200) {
        return { valid: true };
      } else {
        const errorData = await response.json();
        return { 
          valid: false, 
          error: errorData.error?.message || `API returned status ${response.status}`
        };
      }
    } catch (error) {
      return { 
        valid: false, 
        error: error.message || "Network error validating API key"
      };
    }
  }

  // Then replace the save-api-key click handler in popup.js
  document.getElementById('save-api-key').addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      alert('Please enter a valid API key.');
      return;
    }
    
    // Show loading state
    const saveButton = document.getElementById('save-api-key');
    const originalText = saveButton.textContent;
    saveButton.textContent = 'Validating...';
    saveButton.disabled = true;
    
    try {
      // Validate the API key directly
      const validation = await validateGeminiApiKey(apiKey);
      
      if (validation.valid) {
        chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
          // Success feedback
          saveButton.textContent = 'Saved!';
          setTimeout(() => {
            saveButton.textContent = originalText;
            saveButton.disabled = false;
            
            // Ensure the key is still masked after saving
            apiKeyInput.type = 'password';
            isKeyVisible = false;
          }, 1500);
        });
      } else {
        alert(`API key validation failed: ${validation.error}`);
        saveButton.textContent = originalText;
        saveButton.disabled = false;
      }
    } catch (error) {
      alert(`Error validating API key: ${error.message}`);
      saveButton.textContent = originalText;
      saveButton.disabled = false;
    }
  });

  // Reveal button event handler
  revealButton.addEventListener('click', () => {
    // Toggle between showing and hiding the API key
    isKeyVisible = !isKeyVisible;
    apiKeyInput.type = isKeyVisible ? 'text' : 'password';
  });

  // Quick Add Event button event handler using OAuth only
  document.getElementById('quick-add-btn').addEventListener('click', () => {
    const eventText = document.getElementById('quick-add-event').value.trim();
    if (!eventText) {
      alert('Please enter an event description.');
      return;
    }

    // Use chrome.identity.getAuthToken to retrieve an OAuth token
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        console.error(chrome.runtime.lastError);
        alert('Failed to get auth token.');
        return;
      }
      // Send the quickAdd request to Google Calendar
      fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/quickAdd?text=${encodeURIComponent(eventText)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          alert('Event added successfully!');
          window.close()
        })
        .catch(error => {
          alert('Failed to add event.');
        });
    });
  });

  // Start Selection button event handler
  document.getElementById('startSelection').addEventListener('click', () => {
    // Retrieve the API key before proceeding.
    chrome.storage.local.get(['geminiApiKey', 'useQuickAddForScreenshot'], (data) => {
      const apiKey = data.geminiApiKey && data.geminiApiKey.trim();
      const useQuickAdd = data.useQuickAddForScreenshot || false;
      
      if (!apiKey) {
        alert('Please set your Gemini API key before starting the selection.');
        return;
      }
      
      // Store the QuickAdd preference for background.js to use
      chrome.storage.local.set({ useQuickAddForScreenshot: useQuickAdd }, () => {
        // Proceed if API key is set
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs || tabs.length === 0) {
            console.error('No active tab found.');
            return;
          }
          const currentTab = tabs[0];
      
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
            window.close()
          });
        });
      });
    });
  });
  
  document.getElementById('openCalendar').addEventListener('click', () => {
    window.open('https://calendar.google.com/', '_blank');
  });
});