document.addEventListener('DOMContentLoaded', () => {
  const screenshotImg = document.getElementById('screenshot');
  const confirmBtn = document.getElementById('confirm-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  let events = null;
  
  // Retrieve both screenshot and gemEvents from storage.
  chrome.storage.local.get(['screenshot', 'gemEvents'], (data) => {
    if (data.screenshot) {
      screenshotImg.src = data.screenshot;
    } else {
      document.getElementById('info').textContent = 'No screenshot available.';
      confirmBtn.disabled = true;
      cancelBtn.textContent = 'Close';
    }
    
    if (data.gemEvents) {
      events = data.gemEvents;
      console.log("Events retrieved:", events);
      renderEvents(events);
    } else {
      console.log("No Events found");
    }
  });
  
  function renderEvents(eventsArray) {
    const container = document.getElementById('events-container');
    container.innerHTML = ''; // Clear previous content
  
    // Create a wrapper for the events list
    const eventsWrapper = document.createElement('div');
    eventsWrapper.className = 'events-wrapper';
  
    if (eventsArray.length == 0) {
      const noEvent = document.createElement('h1');
      noEvent.innerHTML = "No event found";
      noEvent.className = 'no-event-msg';
      container.appendChild(noEvent);

      // Exit button to close or exit the popup.
      const exitBtn = document.createElement('button');
      exitBtn.textContent = 'Exit';
      exitBtn.className = 'exit-btn';
      exitBtn.addEventListener('click', () => {
        window.close();
      });

      container.appendChild(exitBtn);
    } else {

      eventsArray.forEach((eventObj, index) => {
        // Create a horizontal box container for this event
        const eventEntry = document.createElement('div');
        eventEntry.className = 'event-entry';
        eventEntry.dataset.index = index;
    
        // Create the Event name field (text)
        const eventInput = document.createElement('input');
        eventInput.type = 'text';
        eventInput.value = eventObj.Event || '';
        eventInput.placeholder = 'Event name';
  
        // Create the Date field (text with pattern for MM/DD/YYYY)
        const dateInput = document.createElement('input');
        dateInput.type = 'text';
        dateInput.value = eventObj.Date || '';
        dateInput.placeholder = 'MM/DD/YYYY';
        dateInput.pattern = '(0[1-9]|1[0-2])\\/(0[1-9]|[12]\\d|3[01])\\/\\d{4}';
    
        // Create the Time input (text)
        const timeInput = document.createElement('input');
        timeInput.type = 'text';
        timeInput.value = eventObj.Time || '';
        timeInput.placeholder = 'HH:MM';

        // Create the delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'x';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', () => {
          // Remove the event from the eventsArray
          eventsArray.splice(index, 1);
          // Re-render the events list with the updated array
          renderEvents(eventsArray);
        });
    
        // Create an additional button on the right for this event
        const extraBtn = document.createElement('button');
        extraBtn.textContent = '+';
        extraBtn.className = 'extra-btn';
        extraBtn.addEventListener('click', () => {
          console.log(`Extra button clicked for event at index ${index}`);
          // Check if a dropdown already exists for this event.
          let dropdown = eventEntry.querySelector('.dropdown-container');
          if (dropdown) {
            dropdown.classList.toggle('hidden');
            return;
          }
          
          // Create the dropdown container
          dropdown = document.createElement('div');
          dropdown.className = 'dropdown-container';
          
          // --- Timezone Field ---
          const timezoneLabel = document.createElement('label');
          timezoneLabel.textContent = 'Timezone: ';
          timezoneLabel.className = 'dropdown-label';
          
          const timezoneInput = document.createElement('input');
          timezoneInput.type = 'text';
          timezoneInput.placeholder = 'Enter IANA timezone';
          // Attach a datalist to provide common options
          const timezoneDatalist = document.createElement('datalist');
          timezoneDatalist.id = `tz-list-${index}`;
          const commonTimezones = [
            "Etc/UTC",
            "America/New_York",
            "America/Chicago",
            "America/Denver",
            "America/Los_Angeles",
            "America/Anchorage",
            "Pacific/Honolulu",
            "America/Halifax",
            "Europe/London",
            "Europe/Berlin",
            "Europe/Athens",
            "Europe/Moscow",
            "Asia/Kolkata",
            "Asia/Shanghai",
            "Asia/Tokyo",
            "Asia/Seoul",
            "Australia/Sydney",
            "Australia/Adelaide",
            "Australia/Perth",
            "Pacific/Auckland",
            "America/Sao_Paulo",
            "America/Argentina/Buenos_Aires",
            "America/Santiago",
            "Africa/Abidjan",
            "Africa/Johannesburg",
            "Africa/Cairo"
          ];        
          commonTimezones.forEach(tz => {
            const option = document.createElement('option');
            option.value = tz;
            timezoneDatalist.appendChild(option);
          });
          timezoneInput.setAttribute('list', timezoneDatalist.id);
          
          // --- Attendees Emails Field ---
          const attendeesLabel = document.createElement('label');
          attendeesLabel.textContent = 'Attendees Emails (seperated by commas): ';
          attendeesLabel.className = 'dropdown-label';
          
          const attendeesInput = document.createElement('input');
          attendeesInput.type = 'text';
          attendeesInput.placeholder = 'Enter attendee emails';
          
          // --- Description Field ---
          const descriptionLabel = document.createElement('label');
          descriptionLabel.textContent = 'Description: ';
          descriptionLabel.className = 'dropdown-label';
          
          const descriptionInput = document.createElement('input');
          descriptionInput.type = 'text';
          descriptionInput.placeholder = 'Event description';
          
          // --- Location Field ---
          const locationLabel = document.createElement('label');
          locationLabel.textContent = 'Location: ';
          locationLabel.className = 'dropdown-label';
          
          const locationInput = document.createElement('input');
          locationInput.type = 'text';
          locationInput.placeholder = 'Event location';
          
          // --- Reminders Field ---
          const remindersLabel = document.createElement('label');
          remindersLabel.textContent = 'Reminders: ';
          remindersLabel.className = 'dropdown-label';
          
          // Reminder method: email or popup
          const reminderMethodSelect = document.createElement('select');
          const emailOption = document.createElement('option');
          emailOption.value = 'email';
          emailOption.textContent = 'Email';
          const popupOption = document.createElement('option');
          popupOption.value = 'popup';
          popupOption.textContent = 'Popup';
          reminderMethodSelect.appendChild(emailOption);
          reminderMethodSelect.appendChild(popupOption);
          
          // Minutes prior to event
          const reminderMinutesInput = document.createElement('input');
          reminderMinutesInput.type = 'number';
          reminderMinutesInput.placeholder = 'Minutes before event';
          reminderMinutesInput.min = '0';
          
          // Append fields to dropdown container
          dropdown.appendChild(timezoneLabel);
          dropdown.appendChild(timezoneInput);
          dropdown.appendChild(timezoneDatalist);
          
          dropdown.appendChild(attendeesLabel);
          dropdown.appendChild(attendeesInput);
          
          dropdown.appendChild(descriptionLabel);
          dropdown.appendChild(descriptionInput);
          
          dropdown.appendChild(locationLabel);
          dropdown.appendChild(locationInput);
          
          dropdown.appendChild(remindersLabel);
          dropdown.appendChild(reminderMethodSelect);
          dropdown.appendChild(reminderMinutesInput);
          
          eventEntry.appendChild(dropdown);
        });
    
        // Append the inputs and extra button to the event entry.
        eventEntry.appendChild(eventInput);
        eventEntry.appendChild(dateInput);
        eventEntry.appendChild(timeInput);
        eventEntry.appendChild(deleteBtn);
        eventEntry.appendChild(extraBtn);
    
        eventsWrapper.appendChild(eventEntry);
      });
      
      // Append the events wrapper to the container.
      container.appendChild(eventsWrapper);
    
      // Create a container for the overall Confirm and Exit buttons.
      const actionContainer = document.createElement('div');
      actionContainer.className = 'action-container';
    
      // One Confirm button for all events.
      const confirmAllBtn = document.createElement('button');
      confirmAllBtn.textContent = 'Confirm All';
      confirmAllBtn.className = 'confirm-btn';
      confirmAllBtn.addEventListener('click', () => {
        // Regexes for date (MM/DD/YYYY) and time (supports 12-hour and 24-hour formats)
        const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
        const timeRegex = /^((0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)|([01]\d|2[0-3]):([0-5]\d))$/i;
        let valid = true;
        const updatedEvents = [];
    
        // Validate every event entry.
        const entries = document.querySelectorAll('.event-entry');
        entries.forEach((entry) => {
          // Get the main inputs (assuming fixed order)
          const eventInput = entry.children[0];
          const dateInput = entry.children[1];
          const timeInput = entry.children[2];
    
          if (!dateRegex.test(dateInput.value)) {
            alert('One or more events have an invalid date format. Please use MM/DD/YYYY.');
            console.log("One or more events have an invalid date format. Please use MM/DD/YYYY.")
            valid = false;
            return;
          }
          if (!timeRegex.test(timeInput.value)) {
            alert('One or more events have an invalid time format. Please use HH:MM (24-hour) or 12-hour format with AM/PM.');
            console.log("One or more events have an invalid time format. Please use HH:MM (24-hour) or 12-hour format with AM/PM.")
            valid = false;
            return;
          }
    
          // Check for dropdown container
          const dropdown = entry.querySelector('.dropdown-container');
  
          let timezone = "None",
            attendees = [],
            description = "None",
            location = "None",
            reminderMethod = "None",
            reminderMinutes = "None";
    
          if (dropdown) {
            const timezoneInput = dropdown.querySelector('input[placeholder="Enter IANA timezone"]');
            const attendeesInput = dropdown.querySelector('input[placeholder^="Enter attendee emails"]');
            const descriptionInput = dropdown.querySelector('input[placeholder="Event description"]');
            const locationInput = dropdown.querySelector('input[placeholder="Event location"]');
            const reminderMethodSelect = dropdown.querySelector('select');
            const reminderMinutesInput = dropdown.querySelector('input[type="number"]');
    
            timezone = (timezoneInput && timezoneInput.value.trim() !== "") ? timezoneInput.value.trim() : "None";
            description = (descriptionInput && descriptionInput.value.trim() !== "") ? descriptionInput.value.trim() : "None";
            location = (locationInput && locationInput.value.trim() !== "") ? locationInput.value.trim() : "None";
            reminderMethod = (reminderMethodSelect && reminderMethodSelect.value.trim() !== "") ? reminderMethodSelect.value.trim() : "None";
            reminderMinutes = (reminderMinutesInput && reminderMinutesInput.value.trim() !== "") ? reminderMinutesInput.value.trim() : "None";
  
            // Process attendees field: Verify it contains comma-separated emails
            let attendeesStr = (attendeesInput && attendeesInput.value.trim() !== "") ? attendeesInput.value.trim() : "";
            console.log("this is attendee string" + attendeesStr);
            if (attendeesStr !== "") {
              // Split by commas and trim each email
              let emails = attendeesStr.split(",").map(email => email.trim()).filter(email => email !== "");
              // Basic email regex
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              for (let email of emails) {
                if (!emailRegex.test(email)) {
                  alert(`Invalid email detected: ${email}. Please enter valid emails separated by commas.`);
                  console.log(`Invalid email detected: ${email}. Please enter valid emails separated by commas.`)
                  valid = false;
                  return;
                }
              }
              // Map emails to the format required by Google Calendar API
              attendees = emails.map(email => ({ email }));
            } else {
              // If no attendees provided, default to an empty array or you can use a default value if needed.
              attendees = [];
            }
          }
  
          updatedEvents.push({
            Event: eventInput.value,
            Date: dateInput.value,
            Time: timeInput.value,
            Timezone: timezone, //
            Attendees: attendees,
            Description: description,
            Location: location,
            ReminderMethod: reminderMethod,
            ReminderMinutes: reminderMinutes
          });
        });

        console.log(updatedEvents)
    
        if (valid) {
          chrome.storage.local.set({ gemEvents: updatedEvents }, () => {
            console.log('All events updated:', updatedEvents);
            alert('Events saved successfully!'); // Blocks until user dismisses it.
            chrome.runtime.sendMessage({ action: 'eventsConfirmed' });
            window.close();
          });
        }
      });

          // Exit button to close or exit the popup.
          const exitBtn = document.createElement('button');
          exitBtn.textContent = 'Exit';
          exitBtn.className = 'exit-btn';
          exitBtn.addEventListener('click', () => {
            window.close();
          });
        
          // Append the buttons to the action container.
          actionContainer.appendChild(confirmAllBtn);
          actionContainer.appendChild(exitBtn);
        
          // Append the action container to the main container.
          container.appendChild(actionContainer);
    }
  }
});
