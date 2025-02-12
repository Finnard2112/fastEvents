document.addEventListener('DOMContentLoaded', () => {
    // Query for the active tab in the current window
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        console.error('No active tab found.');
        return;
      }
      const currentTab = tabs[0];
  
      document.getElementById('startSelection').addEventListener('click', () => {
        chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            files: ['lib/html2canvas.min.js','content.js']
          }, () => {
            if (chrome.runtime.lastError) {
              console.error(`Failed to inject scripts: ${chrome.runtime.lastError.message}`);
              return;
            }
            console.log('Scripts injected successfully.');
        
            // Send a message to content.js to start selection
            chrome.tabs.sendMessage(currentTab.id, { action: 'startSelection' });

            window.close();
        });
      });
    });
  });

document.getElementById('openCalendar').addEventListener('click', () => {
    window.open('https://calendar.google.com/', '_blank');
});