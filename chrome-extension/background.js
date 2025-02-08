// background.js

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
        console.log(events)

        res = await addToGoogleCalendar(events);
        console.log(res)

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


function parseJsonSafely(responseText) {
  try {
    const parsed = JSON.parse(responseText);
    return parsed;
  } catch (error) {
      // Check if the error is a SyntaxError and if the error message contains "Unexpected token 'H'"
      if (error instanceof SyntaxError && error.message.includes("Unexpected token 'H'")) {
        const match = responseText.match(/\[.*\]/s);
        if (match && match[0]) {
          return JSON.parse(match[0]);
      } else {
        // If it's a different error, rethrow it or handle it as needed
        throw error;
      }
    }
  }
}


// Gemini image processing function
async function processImageWithGemini(base64Image) {
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US');
  console.log(formattedDate);
  const GEMINI_API_KEY = 'AIzaSyBJRlvSHktMRk85Vu6vHk56xYrevA8ZX4M'; // Replace with actual key
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-preview-02-05:generateContent';
  const instructionText = `Extract any event details from the provided text string that is extracted via OCR from an image of text messages; order them from soonest to latest in terms of date and time, then return them in the following JSON format: \`[{{ "Event": "...", "Time": "HH:MM AM/PM", "Date": "MM/DD/YYYY" }}]\`. Do not include any additional text, headers, explanations, or formatting; output only the JSON array. Identify events as any activity or occasion tied to a specific time and/or date, make sure the date is correct (for example, 'tomorrow' should give the date of tomorrow). Today's date is ${formattedDate}. Extract clear event descriptions —e.g., 'Meeting with Alex')— standardize time formats to 12-hour, and date formats to 'MM/DD/YYYY.' If time or date is missing, leave the field blank. Ignore unrelated or irrelevant text, and ensure multiple events are output as separate entries in the JSON array. If no events are found, return an empty array (\`[]\`). Maintain consistent formatting and provide complete details whenever possible.`;
  console.log(instructionText)

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
              text: instructionText
            }
          ]
        }]
      })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    console.log(data)
    const jsonString = data.candidates[0].content.parts[0].text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    
      
    return parseJsonSafely(jsonString);
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw new Error('Failed to process image with Gemini');
  }
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


// chrome.identity.getAuthToken({interactive: true}, function(token) {
//   let init = {
//     method: 'GET',
//     async: true,
//     headers: {
//       Authorization: 'Bearer ' + token,
//       'Content-Type': 'application/json'
//     },
//     'contentType': 'json'
//   };
//   fetch(
//       'https://people.googleapis.com/v1/contactGroups/all?maxMembers=20&key=API_KEY',
//       init)
//       .then((response) => response.json())
//       .then(function(data) {
//         console.log(data)
//       });
// });

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
        return response;
      } catch (error) {
        return error;
      }
    });
  });
}
