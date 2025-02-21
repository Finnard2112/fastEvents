// confirmation.js

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

    console.log(eventsArray)
  
    // Create a wrapper for the events list
    const eventsWrapper = document.createElement('div');
    eventsWrapper.className = 'events-wrapper';
  
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
  
      // Create an additional button on the right for this event
      const extraBtn = document.createElement('button');
      extraBtn.textContent = '+';
      extraBtn.addEventListener('click', () => {
        console.log(`Extra button clicked for event at index ${index}`);
        // Check if a dropdown already exists for this event.
        let dropdown = eventEntry.querySelector('.dropdown-container');
        if (dropdown) {
          // Toggle visibility if already created.
          dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
          return;
        }
        
        // Create the dropdown container
        dropdown = document.createElement('div');
        dropdown.className = 'dropdown-container';
        dropdown.style.border = '1px solid #ccc';
        dropdown.style.padding = '10px';
        dropdown.style.marginTop = '10px';
        dropdown.style.backgroundColor = '#f9f9f9';
        
        // --- Timezone Field ---
        const timezoneLabel = document.createElement('label');
        timezoneLabel.textContent = 'Timezone: ';
        timezoneLabel.style.display = 'block';
        
        const timezoneInput = document.createElement('input');
        timezoneInput.type = 'text';
        timezoneInput.placeholder = 'Enter IANA timezone';
        // Attach a datalist to provide common options
        const timezoneDatalist = document.createElement('datalist');
        timezoneDatalist.id = `tz-list-${index}`;
        const commonTimezones = [
          'America/New_York',
          'Europe/London',
          'Asia/Tokyo',
          'America/Los_Angeles',
          'Europe/Paris'
        ];
        commonTimezones.forEach(tz => {
          const option = document.createElement('option');
          option.value = tz;
          timezoneDatalist.appendChild(option);
        });
        timezoneInput.setAttribute('list', timezoneDatalist.id);
        
        // --- Attendees Emails Field ---
        const attendeesLabel = document.createElement('label');
        attendeesLabel.textContent = 'Attendees Emails: ';
        attendeesLabel.style.display = 'block';
        
        const attendeesInput = document.createElement('input');
        attendeesInput.type = 'email';
        attendeesInput.placeholder = 'Enter attendee email';
        // If you need multiple emails, you might accept a comma-separated string:
        // Alternatively, you can allow adding multiple inputs.
        
        // --- Description Field ---
        const descriptionLabel = document.createElement('label');
        descriptionLabel.textContent = 'Description: ';
        descriptionLabel.style.display = 'block';
        
        const descriptionInput = document.createElement('input');
        descriptionInput.type = 'text';
        descriptionInput.placeholder = 'Event description';
        
        // --- Location Field ---
        const locationLabel = document.createElement('label');
        locationLabel.textContent = 'Location: ';
        locationLabel.style.display = 'block';
        
        const locationInput = document.createElement('input');
        locationInput.type = 'text';
        locationInput.placeholder = 'Event location';
        
        // --- Reminders Field ---
        const remindersLabel = document.createElement('label');
        remindersLabel.textContent = 'Reminders: ';
        remindersLabel.style.display = 'block';
        
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
    confirmAllBtn.addEventListener('click', () => {
      // Regexes for date (MM/DD/YYYY) and time (24-hour HH:MM)
      const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
      const timeRegex = /^((0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)|([01]\d|2[0-3]):([0-5]\d))$/i;
      let valid = true;
      const updatedEvents = [];
  
      // Validate every event entry.
      const entries = document.querySelectorAll('.event-entry');
      entries.forEach((entry) => {
        const [eventInput, dateInput, timeInput] = entry.children;
        if (!dateRegex.test(dateInput.value)) {
          alert('One or more events have an invalid date format. Please use MM/DD/YYYY.');
          valid = false;
          return;
        }
        if (!timeRegex.test(timeInput.value)) {
          alert('One or more events have an invalid time format. Please use HH:MM in 24-hour format.');
          valid = false;
          return;
        }
        updatedEvents.push({
          Event: eventInput.value,
          Date: dateInput.value,
          Time: timeInput.value,
        });
      });
  
      if (valid) {
        // Update storage with the updated events array.
        chrome.storage.local.set({ gemEvents: updatedEvents }, () => {
          console.log('All events updated:', updatedEvents);
          alert('Events saved successfully!');
        });

        chrome.runtime.sendMessage({ action: 'eventsConfirmed'});
        // window.close()
      }
    });
  
    // Exit button to close or exit the popup.
    const exitBtn = document.createElement('button');
    exitBtn.textContent = 'Exit';
    exitBtn.addEventListener('click', () => {
      window.close();
    });
  
    // Append the buttons to the action container.
    actionContainer.appendChild(confirmAllBtn);
    actionContainer.appendChild(exitBtn);
  
    // Append the action container to the main container.
    container.appendChild(actionContainer);
  }

});
