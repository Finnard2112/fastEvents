// background.js

import Tesseract from './lib/tesseract.esm.min.js';

// Listener for extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['lib/html2canvas.min.js','content.js']
  }, () => {
    if (chrome.runtime.lastError) {
      console.error(`Failed to inject scripts: ${chrome.runtime.lastError.message}`);
      return;
    }
    console.log('Scripts injected successfully.');

    // Send a message to content.js to start selection
    chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processScreenshot') {
    // Retrieve the screenshot from chrome.storage.local
    chrome.storage.local.get('screenshot', async (data) => {
      const screenshotData = data.screenshot;
      console.log('Data URL generated:', screenshotData); // Debug log
      if (!screenshotData) {
        sendResponse({ status: 'error', message: 'No screenshot found' });
        return;
      }

      try {
        // Process image with Gemini
        const events = await processImageWithGemini(screenshotData);

        res = await addToGoogleCalendar(events);

        // Send success response
        sendResponse({ 
          status: 'success', 
          data: {
            message: 'Events created successfully',
            events: events
          }
        });
      } catch (error) {
        console.error('Error processing screenshot:', error);
        sendResponse({ 
          status: 'error', 
          message: error.message || 'Failed to process image'
        });
      }
    });
    
    // Return true to indicate async response
    return true;
  } else if (request.action === 'cancelScreenshot') {
    // Clear the stored screenshot
    chrome.storage.local.remove('screenshot', () => {
      sendResponse({ status: 'cancelled' });
    });
    return true;
  }
});

// Gemini image processing function
async function processImageWithGemini(base64Image) {
  const GEMINI_API_KEY = ''; // Replace with actual key
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-preview-02-05:generateContent';

  try {
    const response = await fetch(`${url}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: "image/png",
                data: base64Image.split(',')[1] // Remove data URL prefiximageDataUrl
              }
            },
            {
              text: "Extract event details from image. Return JSON format: [{ 'Event': '...', 'Date': 'MM/DD/YYYY', 'Time': 'HH:MM AM/PM' }]"
            }
          ]
        }]
      })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    const jsonString = data.candidates[0].content.parts[0].text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw new Error('Failed to process image with Gemini');
  }
}

// Usage in addToGoogleCalendar
async function addToGoogleCalendar(events) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      try {
        for (const event of events) {
          const startDate = parseDateTime(event.Date, event.Time);
          const endDate = new Date(startDate.getTime() + 3600000); // +1 hour

          const eventBody = {
            summary: event.Event,
            start: formatCalendarDateTime(startDate),
            end: formatCalendarDateTime(endDate),
            visibility: "public"
          };

          const response = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(eventBody)
            }
          );

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error.message);
          }
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}


function parseDateTime(dateStr, timeStr) {
  let date;

  // Parse Date (MM/DD/YYYY format or default to tomorrow)
  if (dateStr && dateStr.trim() !== '') {
    const [month, day, year] = dateStr.split('/').map(Number);
    date = new Date(year, month - 1, day); // Months are 0-based in JS
  } else {
    const today = new Date();
    date = new Date(today);
    date.setDate(today.getDate() + 1); // Default to tomorrow
  }

  // Parse Time (HH:MM AM/PM or HH:MM format)
  let hours = 9; // Default to 9 AM
  let minutes = 0;
  if (timeStr && timeStr.trim() !== '') {
    const cleanTime = timeStr.toLowerCase().trim();
    const [timePart, period] = cleanTime.split(/(am|pm)/);
    const [h, m] = timePart.split(':').map(Number);

    hours = h || 0;
    minutes = m || 0;

    // Convert to 24-hour format
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
  }

  // Set time components
  date.setHours(hours, minutes, 0, 0);
  
  return date;
}

// Helper to format date for Google Calendar API
function formatCalendarDateTime(date) {
  const pad = n => n.toString().padStart(2, '0');
  return {
    dateTime: `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T` +
              `${pad(date.getHours())}:${pad(date.getMinutes())}:00`,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

// Usage in addToGoogleCalendar
async function addToGoogleCalendar(events) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      try {
        for (const event of events) {
          const startDate = parseDateTime(event.Date, event.Time);
          const endDate = new Date(startDate.getTime() + 3600000); // +1 hour

          const eventBody = {
            summary: event.Event,
            start: formatCalendarDateTime(startDate),
            end: formatCalendarDateTime(endDate),
            visibility: "public"
          };

          const response = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(eventBody)
            }
          );

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error.message);
          }
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

/* // Main workflow
document.getElementById('processBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('imageInput');
  const file = fileInput.files[0];
  
  // Convert image to base64
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64Image = e.target.result;
    const events = await processImageWithGemini(base64Image);
    await addToGoogleCalendar(events);
    alert('Events added to Google Calendar!');
  };
  reader.readAsDataURL(file);
});  */