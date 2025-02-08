// confirmation.js



document.addEventListener('DOMContentLoaded', () => {
    const screenshotImg = document.getElementById('screenshot');
    const confirmBtn = document.getElementById('confirm-btn');
    const cancelBtn = document.getElementById('cancel-btn');
  
    // Retrieve the screenshot from chrome.storage.local
    chrome.storage.local.get('screenshot', (data) => {
      if (data.screenshot) {
        screenshotImg.src = data.screenshot;
      } else {
        // Handle the case where there's no screenshot data
        document.getElementById('info').textContent = 'No screenshot available.';
        confirmBtn.disabled = true;
        cancelBtn.textContent = 'Close';
      }
    });

    confirmBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'processScreenshot' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error:', chrome.runtime.lastError);
        } else {
          console.log('Response from background:', response);
          // Optionally, display the ChatGPT result in the popup
        }
        window.close();
      });
    });
    
    // Handle the cancel button click: clear the stored screenshot and close the popup
    cancelBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'cancelScreenshot' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error:', chrome.runtime.lastError);
        } else {
          console.log('Cancel response:', response);
        }
        window.close();
      });
    });
  });
  
