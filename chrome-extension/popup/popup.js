document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('gemini-api-key');
  const revealButton = document.getElementById('reveal-api-key');
  const getKeyButton = document.getElementById('get-api-key');
  let isKeyVisible = false;

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

  // Save button event handler for the API key
  document.getElementById('save-api-key').addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      alert('Please enter a valid API key.');
      return;
    }
    chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
      console.log('Gemini API key saved:', apiKey);
      // Ensure the key is still masked after saving
      apiKeyInput.type = 'password';
      isKeyVisible = false;
    });
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
          console.log('Event added:', data);
          alert('Event added successfully!');
          window.close()
        })
        .catch(error => {
          console.error('Error adding event:', error);
          alert('Failed to add event.');
        });
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

