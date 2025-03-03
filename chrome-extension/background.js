// background.js

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


        chrome.storage.local.set({ gemEvents: events }, () => {

          chrome.windows.create({
            url: chrome.runtime.getURL('popup/confirmation.html'),
            type: 'popup',
            width: 900,
            height: 900
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
        } else {
          console.log("No Events found");
        }
      })();
    });

  }
});


function parseJsonSafely(responseText) {
  try {
    return JSON.parse(responseText);
  } catch (error) {
    console.error("JSON parsing error:", error.message);
    
    // Try to extract JSON array from text (handles cases with explanatory text around the JSON)
    const arrayMatch = responseText.match(/\[.*\]/s);
    if (arrayMatch && arrayMatch[0]) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch (nestedError) {
        console.error("Failed to parse extracted array:", nestedError.message);
      }
    }
    
    // Try to handle common formatting issues
    const cleanedText = responseText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .replace(/\n/g, ' ')
      .trim();
      
    try {
      return JSON.parse(cleanedText);
    } catch (finalError) {
      console.error("All parsing attempts failed");
      // Return empty array as fallback
      return [];
    }
  }
}

function getGeminiApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['geminiApiKey'], (data) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(data.geminiApiKey);
    });
  });
}


// Gemini image processing function
async function processImageWithGemini(base64Image) {
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US');

  const GEMINI_API_KEY = await getGeminiApiKey();


  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  const instructionText = `Extract any event details from the provided text string that is extracted via OCR from an image of text messages; order them from soonest to latest in terms of date and time, then return them in the following JSON format: \`[{{ "Event": "...", "Time": "HH:MM AM/PM", "Date": "MM/DD/YYYY" }}]\`. Do not include any additional text, headers, explanations, or formatting; output only the JSON array. Identify events as any activity or occasion tied to a specific time and/or date, make sure the date is correct (for example, 'tomorrow' should give the date of tomorrow). Today's date is ${formattedDate}. Extract clear event descriptions —e.g., 'Meeting with Alex')— standardize time formats to 12-hour, and date formats to 'MM/DD/YYYY.' If time or date is missing, leave the field blank. Ignore unrelated or irrelevant text, and ensure multiple events are output as separate entries in the JSON array. If no events are found, return an empty array (\`[]\`). Maintain consistent formatting and provide complete details whenever possible.`;

  try {

    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
      throw new Error('Missing or invalid Gemini API key');
    }

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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error (${response.status}): ${errorData.error?.message || response.statusText}`);
    }
    
    
    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
      throw new Error('Unexpected response format from Gemini API');
    }
    
    const jsonString = data.candidates[0].content.parts[0].text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    if (!jsonString || jsonString.trim() === '') {
      return []; // Return empty array if no events found
    }
    
    const parsedEvents = parseJsonSafely(jsonString);
    if (!Array.isArray(parsedEvents)) {
      console.warn('Parsed events is not an array, returning empty array');
      return [];
    }
    
      
    return parsedEvents;
  } catch (error) {
    console.error('Gemini API Error:', error);
    
    // Store the error in local storage for the confirmation popup to display
    chrome.storage.local.set({ 
      geminiError: error.message || 'Failed to process image with Gemini' 
    });
    
    // Still open the confirmation popup to show the error
    chrome.windows.create({
      url: chrome.runtime.getURL('popup/confirmation.html'),
      type: 'popup',
      width: 900,
      height: 900
    });
    
    throw new Error('Failed to process image with Gemini: ' + error.message);
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
function formatCalendarDateTime(date, timezone) {
  const pad = n => n.toString().padStart(2, '0');
  if (timezone === "None") {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  }
  return {
    dateTime: `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T` +
              `${pad(date.getHours())}:${pad(date.getMinutes())}:00`,
    timeZone: timezone
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

          // Summary
          const summary = event.Event && event.Event.trim() !== "" 
          ? event.Event 
          : "No Name Event";

          const eventBody = {
            summary: summary,
            start: formatCalendarDateTime(startDate, event.Timezone),
            end: formatCalendarDateTime(endDate, event.Timezone),
            visibility: "public",
          };

          // Assumes event.Attendees is already an array of objects in the format: [{email: "example@example.com"}, ...]
          if (event.Attendees && Array.isArray(event.Attendees) && event.Attendees.length > 0) {
            eventBody.attendees = event.Attendees;
          }

          // Add description if it's not "None"
          if (event.Description && event.Description !== "None") {
            eventBody.description = event.Description;
          }

          // Add location if it's not "None"
          if (event.Location && event.Location !== "None") {
            eventBody.location = event.Location;
          }

          // Add reminders if both fields are provided and not "None"
          if (event.ReminderMethod && event.ReminderMethod !== "None" &&
              event.ReminderMinutes && event.ReminderMinutes !== "None") {
            eventBody.reminders = {
              useDefault: false,
              overrides: [
                {
                  method: event.ReminderMethod,
                  minutes: parseInt(event.ReminderMinutes, 10)
                }
              ]
            };
          }



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
