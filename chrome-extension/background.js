// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'screenshotCaptured' && request.dataURL) {
    const screenshotData = request.dataURL;

    chrome.storage.local.set({ screenshot: request.dataURL }, () => {
      console.log('Screenshot data stored.');
    });
    
    (async () => {
      try {
        // Check if we should use QuickAdd mode
        const { useQuickAddForScreenshot } = await new Promise(resolve => {
          chrome.storage.local.get(['useQuickAddForScreenshot'], resolve);
        });
        
        if (useQuickAddForScreenshot) {
          // Process image with Gemini for QuickAdd
          const eventText = await processImageForQuickAdd(screenshotData);
          
          if (eventText) {
            // Use QuickAdd API
            const eventData = await addToCalendarWithQuickAdd(eventText);
            
            // Show a success notification
            chrome.notifications.create({
              type: 'basic',
              iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
              title: 'Event Added Successfully',
              message: `Added event: "${eventData.summary}" on ${new Date(eventData.start.dateTime).toLocaleString()}`
            });
          } else {
            throw new Error('Could not extract event text from image');
          }
        } else {
          // Regular flow - Process image with Gemini
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
        }
      } catch (error) {
        console.error('Error processing screenshot:', error);
        
        // Store the error for display regardless of mode
        chrome.storage.local.set({ 
          geminiError: error.message || 'Failed to process image with Gemini' 
        });
        
        // Only show the confirmation popup in regular mode
        const { useQuickAddForScreenshot } = await new Promise(resolve => {
          chrome.storage.local.get(['useQuickAddForScreenshot'], resolve);
        });
        
        if (!useQuickAddForScreenshot) {
          chrome.windows.create({
            url: chrome.runtime.getURL('popup/confirmation.html'),
            type: 'popup',
            width: 900,
            height: 900
          });
        } else {
          // Use Chrome notifications instead of alert
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
            title: 'Error',
            message: `Error: ${error.message || 'Failed to process image'}`
          });
        }
        
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

// In background.js, after processing calendar events
function notifyUserOfResults(results) {
  const successCount = results.successfulEvents || 0;
  const totalCount = results.totalEvents || 0;
  const failedCount = results.failedEvents || 0;
  
  console.log(`Calendar results: ${successCount}/${totalCount} events added successfully. ${failedCount} failed.`);
  
  // Store the detailed results for potential viewing later
  if (results.details) {
    chrome.storage.local.set({ 
      calendarResults: {
        timestamp: new Date().toISOString(),
        summary: results,
        details: results.details
      }
    });
  }
  
  let message;
  let title;
  
  if (successCount === totalCount) {
    title = 'Calendar Events Added';
    message = `All ${successCount} events were added successfully!`;
  } else if (successCount > 0) {
    title = 'Calendar Events';
    message = `${successCount} of ${totalCount} events added successfully. ${failedCount} failed.`;
  } else {
    title = 'Calendar Error';
    message = `Failed to add all ${totalCount} events to your calendar.`;
  }
  
  const buttons = failedCount > 0 ? [{ title: 'View Details' }] : [];
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title: title,
    message: message,
    buttons: buttons,
    priority: 2,
    requireInteraction: failedCount > 0 // Make the notification stay if there were errors
  });
}

// Handle the "View Details" button click
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) { // "View Details" button
    chrome.storage.local.get(['calendarResults'], (data) => {
      if (data.calendarResults && data.calendarResults.details && data.calendarResults.details.errors) {
        // Format error details for display
        const errors = data.calendarResults.details.errors;
        let errorMessage = "Errors encountered:\n\n";
        
        errors.forEach((error, index) => {
          errorMessage += `Event: ${error.event}\n`;
          errorMessage += `Error: ${error.error}\n\n`;
        });
        
        // Open a new tab or window to display detailed errors
        chrome.tabs.create({
          url: `data:text/html,<html><head><title>Calendar Error Details</title></head>
                <body style="font-family: sans-serif; padding: 20px;">
                <h2>Calendar Error Details</h2>
                <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px;">${errorMessage}</pre>
                </body></html>`
        });
      }
    });
  }
});


// In your event handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'eventsConfirmed') {
    console.log('Events confirmed by user, proceeding to add to calendar');
    
    // Show an initial notification that we're processing
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title: 'Processing Events',
      message: 'Adding events to your calendar...'
    });
    
    chrome.storage.local.get(['screenshot', 'gemEvents'], (data) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
          title: 'Error',
          message: 'Could not retrieve event data from storage'
        });
        return;
      }
      
      if (!data.gemEvents || data.gemEvents.length === 0) {
        console.log("No events found in storage");
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
          title: 'No Events',
          message: 'No events were found to add to calendar'
        });
        return;
      }
      
      (async () => {
        try {
          console.log(`Starting to add ${data.gemEvents.length} events to calendar`);
          const res = await addToGoogleCalendar(data.gemEvents);
          console.log('Calendar operation completed successfully:', res);
          notifyUserOfResults(res);
        } catch (error) {
          console.error('Error adding events to calendar:', error);
          // This notification is shown by addToGoogleCalendar on failure
          // but we'll add a backup notification here too
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
            title: 'Calendar Error',
            message: `Failed to add events: ${error.message}`
          });
        }
      })();
    });
    
    return true;
  }
});

// New function to process image for QuickAdd
async function processImageForQuickAdd(base64Image) {
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US');

  const GEMINI_API_KEY = await getGeminiApiKey();

  if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
    throw new Error('Missing or invalid Gemini API key');
  }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  const instructionText =  `Extract text from this image, identify any event details (event name, date, time, location), and format them as a single line text string optimized for Google Calendar's Quick Add feature. The output should be a single, concise line describing the event in a natural language format. For example: "Meeting with John Starbucks tomorrow 3pm" or "Dentist appointment March 15 10am". 
                            Today's date is ${formattedDate}. Follow these specific formatting rules:
                            1. Remove unnecessary prepositions like "at", "on", "in" when referring to locations, dates, or times
                            2. Keep the event name, location, date, and time in that order when possible
                            3. Use natural language date formats that Google Calendar understands (e.g., "tomorrow", "next Tuesday", "March 15")
                            4. If no event is found, respond with "No event found"
                            5. Keep the output as concise as possible while maintaining all key information`;
  try {
    const response = await fetch(`${url}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: instructionText },
            {
              inline_data: {
                mime_type: "image/png",
                data: base64Image.split(',')[1]
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
    
    const eventText = data.candidates[0].content.parts[0].text.trim();
    
    if (!eventText || eventText === 'No event found') {
      throw new Error('No event found in the image');
    }
    
    return eventText;
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw new Error('Failed to process image with Gemini: ' + error.message);
  }
}

// New function to use QuickAdd API
async function addToCalendarWithQuickAdd(eventText) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error('Failed to get auth token'));
        return;
      }
      
      try {
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/quickAdd?text=${encodeURIComponent(eventText)}`, 
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || `API error ${response.status}`);
        }
        
        const data = await response.json();
        // Use Chrome notifications instead of alert
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
          title: 'Event Added',
          message: `Event "${data.summary}" added successfully!`
        });
        resolve(data);
      } catch (error) {
        // Use Chrome notifications instead of alert
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
          title: 'Error',
          message: `Failed to add event: ${error.message}`
        });
        reject(error);
      }
    });
  });
}

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

// More robust date parsing example
function parseDateTime(dateStr, timeStr, timezone = null) {
  // Default timezone if not provided
  const userTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Parse date (MM/DD/YYYY format)
  let date;
  if (dateStr && dateStr.trim() !== '') {
    const [month, day, year] = dateStr.split('/').map(Number);
    if (isNaN(month) || isNaN(day) || isNaN(year)) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }
    // Validate month and day
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(`Invalid date values: ${dateStr}`);
    }
    date = new Date(year, month - 1, day);
  } else {
    const today = new Date();
    date = new Date(today);
    date.setDate(today.getDate() + 1); // Default to tomorrow
  }

  // Parse Time with more robust handling
  if (timeStr && timeStr.trim() !== '') {
    const cleanTime = timeStr.toLowerCase().trim();
    
    // Different time patterns
    const time24HourPattern = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    const time12HourPattern = /^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(am|pm)$/i;
    
    let hours = 9; // Default to 9 AM
    let minutes = 0;
    
    if (time24HourPattern.test(cleanTime)) {
      const [h, m] = cleanTime.split(':').map(Number);
      hours = h;
      minutes = m;
    } else if (time12HourPattern.test(cleanTime)) {
      const match = cleanTime.match(time12HourPattern);
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      const period = match[3].toLowerCase();
      
      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;
    } else {
      throw new Error(`Invalid time format: ${timeStr}`);
    }
    
    // Set time components
    date.setHours(hours, minutes, 0, 0);
  }
  
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

async function fetchWithRetry(url, options, maxRetries = 3) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      console.log(`Attempt ${retries + 1}/${maxRetries} to fetch ${url}`);
      
      // If we've been given an AbortController signal, need to handle it
      const response = await fetch(url, options);
      
      // Check if we hit rate limits
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
        console.log(`Rate limited. Waiting ${retryAfter} seconds before retry.`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        retries++;
        continue;
      }
      
      return response;
    } catch (error) {
      // Check if this is an abort error (timeout)
      if (error.name === 'AbortError') {
        console.error('Fetch operation timed out');
        throw new Error('Request timed out. Please try again.');
      }
      
      retries++;
      console.error(`Fetch attempt ${retries} failed: ${error.message}`);
      
      if (retries >= maxRetries) {
        console.error(`All ${maxRetries} retry attempts failed`);
        throw error;
      }
      
      // Wait longer between retries
      const waitTime = 1000 * retries;
      console.log(`Waiting ${waitTime/1000} seconds before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // This should not be reached due to the throw in the retry loop
  throw new Error(`Failed after ${maxRetries} attempts`);
}

async function addToGoogleCalendar(events) {
  return new Promise((resolve, reject) => {
    // Add a timeout to ensure the promise doesn't hang indefinitely
    const timeoutId = setTimeout(() => {
      console.error('Calendar API operation timed out after 30 seconds');
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
        title: 'Calendar Operation Timeout',
        message: 'The request to add events to your calendar timed out. Please try again.'
      });
      reject(new Error('Calendar API operation timed out'));
    }, 30000); // 30 second timeout
    
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError) {
        console.error('Auth error:', chrome.runtime.lastError);
        clearTimeout(timeoutId);
        
        // Show notification to user about auth error
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
          title: 'Authentication Error',
          message: 'Failed to authenticate with Google Calendar. Please try again.'
        });
        
        return reject(chrome.runtime.lastError);
      }
      
      if (!token) {
        clearTimeout(timeoutId);
        console.error('No authentication token received');
        
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
          title: 'Authentication Error',
          message: 'Failed to get authentication token. Please check your Google account settings.'
        });
        
        return reject(new Error('Failed to get authentication token'));
      }
      
      try {
        const results = [];
        const errors = [];
        
        for (const event of events) {
          try {
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

            // Attendees handling
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

            console.log(`Sending calendar request for event: ${summary}`);
            
            // Set individual request timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout per event
            
            const response = await fetchWithRetry(
              'https://www.googleapis.com/calendar/v3/calendars/primary/events',
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventBody),
                signal: controller.signal
              }
            );
            
            clearTimeout(timeoutId);

            console.log(`Received response for event: ${summary}`, response.status);

            const responseData = await response.json();
            
            if (!response.ok) {
              throw new Error(responseData.error?.message || `API error: ${response.status}`);
            }
            
            // Store successful result
            results.push({
              event: summary,
              success: true,
              data: responseData
            });
            
          } catch (eventError) {
            console.error('Error adding event:', event.Event, eventError);
            errors.push({
              event: event.Event || 'Unknown event',
              error: eventError.message
            });
          }
        }
        
        // Notify content script with results
        chrome.runtime.sendMessage({ 
          action: 'eventsAddedResults', 
          results: results,
          errors: errors
        });
        
        // Clear the timeout since we're done
        clearTimeout(timeoutId);
        
        // Resolve with summary of results
        resolve({
          totalEvents: events.length,
          successfulEvents: results.length,
          failedEvents: errors.length,
          details: {
            successful: results,
            errors: errors
          }
        });
        
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Overall calendar API error:', error);
        
        // Show notification about the error
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
          title: 'Calendar Error',
          message: `Error adding events to calendar: ${error.message}`
        });
        
        reject(error);
      }
    });
  });
}