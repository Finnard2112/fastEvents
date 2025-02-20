// background.js


// <script src="https://apis.google.com/js/api.js"></script>
// <script>
//   /**
//    * Sample JavaScript code for calendar.events.quickAdd
//    * See instructions for running APIs Explorer code samples locally:
//    * https://developers.google.com/explorer-help/code-samples#javascript
//    */

//   function authenticate() {
//     return gapi.auth2.getAuthInstance()
//         .signIn({scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.app.created https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.events.owned"})
//         .then(function() { console.log("Sign-in successful"); },
//               function(err) { console.error("Error signing in", err); });
//   }
//   function loadClient() {
//     gapi.client.setApiKey("YOUR_API_KEY");
//     return gapi.client.load("https://content.googleapis.com/discovery/v1/apis/calendar/v3/rest")
//         .then(function() { console.log("GAPI client loaded for API"); },
//               function(err) { console.error("Error loading GAPI client for API", err); });
//   }
//   // Make sure the client is loaded and sign-in is complete before calling this method.
//   function execute() {
//     return gapi.client.calendar.events.quickAdd({
//       "calendarId": "primary",
//       "text": "Lunch tomorrow at 10"
//     })
//         .then(function(response) {
//                 // Handle the results here (response.result has the parsed body).
//                 console.log("Response", response);
//               },
//               function(err) { console.error("Execute error", err); });
//   }
//   gapi.load("client:auth2", function() {
//     gapi.auth2.init({client_id: "YOUR_CLIENT_ID"});
//   });
// </script>
// <button onclick="authenticate().then(loadClient)">authorize and load</button>
// <button onclick="execute()">execute</button>



chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'screenshotCaptured' && request.dataURL) {
    const screenshotData = request.dataURL;

    chrome.storage.local.set({ screenshot: request.dataURL }, () => {
      console.log('Screenshot data stored.');
    });
    
    (async () => {
      try {
        // Process image with Gemini using the provided data URL
        const events = await processImageWithGemini(screenshotData);

        console.log(events)

        chrome.storage.local.set({ gemEvents: events }, () => {

          chrome.windows.create({
            url: chrome.runtime.getURL('popup/confirmation.html'),
            type: 'popup',
            width: 500,
            height: 600
          }, (window) => {
            console.log('Confirmation popup opened.');
          });
        });

      } catch (error) {
        console.error('Error processing screenshot:', error);
        sendResponse({
          status: 'error',
          message: error.message || 'Failed to process image'
        });
      }
    })();

    // Return true to indicate sendResponse will be called asynchronously
    return true;
  } else if (request.action === 'cancelScreenshot') {
    sendResponse({ status: 'cancelled' });
    return true;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'eventsConfirmed') {
    chrome.storage.local.get(['screenshot', 'gemEvents'], (data) => {
      (async () => {
        if (data.gemEvents) {
          let events = data.gemEvents;
          const res = await addToGoogleCalendar(events);
          console.log("Calendar response")
          console.log(res)
        } else {
          console.log("No Events found");
        }
      })();
    });

  }
});


function parseJsonSafely(responseText) {
  try {
    const parsed = JSON.parse(responseText);
    console.log("parsing JSON safely")
    console.log(parsed)
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
  const GEMINI_API_KEY = 'AIzaSyCyCNjipWqNJc3dTJs6ePr7rwwlZWiESYM'; // Replace with actual key
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  const instructionText = `Extract any event details from the provided text string that is extracted via OCR from an image of text messages; order them from soonest to latest in terms of date and time, then return them in the following JSON format: \`[{{ "Event": "...", "Time": "HH:MM AM/PM", "Date": "MM/DD/YYYY" }}]\`. Do not include any additional text, headers, explanations, or formatting; output only the JSON array. Identify events as any activity or occasion tied to a specific time and/or date, make sure the date is correct (for example, 'tomorrow' should give the date of tomorrow). Today's date is ${formattedDate}. Extract clear event descriptions —e.g., 'Meeting with Alex')— standardize time formats to 12-hour, and date formats to 'MM/DD/YYYY.' If time or date is missing, leave the field blank. Ignore unrelated or irrelevant text, and ensure multiple events are output as separate entries in the JSON array. If no events are found, return an empty array (\`[]\`). Maintain consistent formatting and provide complete details whenever possible.`;

  try {
    const response = await fetch(`${url}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: instructionText
            },
            {
              inline_data: {
                mime_type: "image/png",
                data: base64Image.split(',')[1] // Remove data URL prefiximageDataUrl
              }
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

// Usage in addToGoogleCalendar
async function addToGoogleCalendar(events) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      try {
        for (const event of events) {

          console.log(event)
          const startDate = parseDateTime(event.Date, event.Time);
          const endDate = new Date(startDate.getTime() + 3600000); // +1 hour

          const eventBody = {
            summary: event.Event,
            start: formatCalendarDateTime(startDate),
            end: formatCalendarDateTime(endDate),
            visibility: "public"
          };

          console.log(eventBody)

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
        console.log("Sent fetch")
        return response;
      } catch (error) {
        return error;
      }
    });
  });
}
