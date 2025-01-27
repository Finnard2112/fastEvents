// confirmation.js

document.addEventListener('DOMContentLoaded', () => {
    const screenshotImg = document.getElementById('screenshot');
    const saveBtn = document.getElementById('save-btn');
    const cancelBtn = document.getElementById('cancel-btn');
  
    // Retrieve the screenshot from chrome.storage.local
    chrome.storage.local.get('screenshot', (data) => {
      if (data.screenshot) {
        screenshotImg.src = data.screenshot;
      } else {
        // Handle the case where there's no screenshot data
        document.getElementById('info').textContent = 'No screenshot available.';
        saveBtn.disabled = true;
        cancelBtn.textContent = 'Close';
      }
    });
  
    // Handle the save button click
    saveBtn.addEventListener('click', () => {
      chrome.storage.local.get('screenshot', (data) => {
        if (data.screenshot) {
          // Create a link to download the image
          const link = document.createElement('a');
          link.href = data.screenshot;
          link.download = 'screenshot.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
  
          // Clear the stored screenshot and close the popup
          chrome.storage.local.remove('screenshot', () => {
            window.close();
          });
        }
      });
    });
  
    // Handle the cancel button click
    cancelBtn.addEventListener('click', () => {
      // Optionally, clear the stored screenshot
      chrome.storage.local.remove('screenshot', () => {
        window.close();
      });
    });
  });
  