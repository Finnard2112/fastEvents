// content.js

(function() {
  let startX, startY, endX, endY;
  let selectionBox = null;

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      cancelSelection();
    }
  }

  // Cancel the selection process: remove listeners and overlay
  function cancelSelection() {
    // Remove the keydown listener
    document.removeEventListener('keydown', onKeyDown);
    
    const overlay = document.getElementById('screenshot-overlay');
    if (overlay) {
      // Remove any mouse event listeners
      overlay.removeEventListener('mousedown', startSelectionArea);
      overlay.removeEventListener('mousemove', resizeSelectionArea);
      overlay.removeEventListener('mouseup', finalizeSelectionArea);
      // Remove the overlay from the document
      document.body.removeChild(overlay);
      console.log('Selection cancelled via Escape.');
    }
  }

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startSelection') {
      initiateSelection();
    }
  });

  function initiateSelection() {
    // Prevent multiple overlays
    if (document.getElementById('screenshot-overlay')) return;

    // Create a semi-transparent overlay to capture mouse events
    const overlay = document.createElement('div');
    overlay.id = 'screenshot-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      zIndex: '9999',
      cursor: 'crosshair'
    });
    document.body.appendChild(overlay);

    // Create a selection box
    selectionBox = document.createElement('div');
    Object.assign(selectionBox.style, {
      position: 'absolute',
      border: '2px dashed #fff',
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      display: 'none',
      zIndex: '10000'
    });
    overlay.appendChild(selectionBox);

    // Listen for the Escape key to cancel selection
    document.addEventListener('keydown', onKeyDown);

    // Mouse events to handle selection
    overlay.addEventListener('mousedown', startSelectionArea);
  }

  function startSelectionArea(e) {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;

    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';

    // Listen to mousemove and mouseup on the overlay
    const overlay = document.getElementById('screenshot-overlay');
    overlay.addEventListener('mousemove', resizeSelectionArea);
    overlay.addEventListener('mouseup', finalizeSelectionArea);
  }

  function resizeSelectionArea(e) {
    endX = e.clientX;
    endY = e.clientY;

    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    const left = Math.min(endX, startX);
    const top = Math.min(endY, startY);

    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;

  }

  function finalizeSelectionArea(e) {

    const overlay = document.getElementById('screenshot-overlay');
    overlay.removeEventListener('mousemove', resizeSelectionArea);
    overlay.removeEventListener('mouseup', finalizeSelectionArea);
    
    const rect = selectionBox.getBoundingClientRect();
    console.log("finalize3", rect)
    
    // Now, remove the overlay
    document.body.removeChild(overlay);
    
    const options = {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height
    };

    console.log('Selected region options:', options);

    // Use html2canvas to capture the selected region
    html2canvas(document.body, {
        x: Math.round(options.x),
        y: Math.round(options.y),
        width: Math.round(options.width),
        height: Math.round(options.height),
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight
    }).then(canvas => {
        // Convert the canvas to a data URL
        const dataURL = canvas.toDataURL('image/png');


        // Send the screenshot data to the background script
        chrome.runtime.sendMessage({ action: 'screenshotCaptured', dataURL: dataURL });
    }).catch(err => {
        console.error('Error capturing screenshot:', err);
    });
}

})();
