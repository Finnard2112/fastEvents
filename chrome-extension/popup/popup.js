document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('startSelection').addEventListener('click', () => {
    // Query for the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        console.error('No active tab found.');
        return;
      }
      const tabId = tabs[0].id;

      // Inject the content script
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['lib/html2canvas.min.js', 'content.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error(`Failed to inject scripts: ${chrome.runtime.lastError.message}`);
          return;
        }
        console.log('Content script injected successfully.');

        // Send a message to the content script to start the selection process
        chrome.tabs.sendMessage(tabId, { action: 'startSelection' });
      });
    });
  });

  document.getElementById('openCalendar').addEventListener('click', () => {
    window.open('https://calendar.google.com/', '_blank');
  });
});
