# FastEvents

Simplify your schedule with FastEvents! This Chrome extension makes adding events to Google Calendar a breeze. Use the built-in screenshot tool or paste event details, confirm, and there pops your event on your GOogle Calendar. Stay organized effortlessly!

## Setup (very quick)

After Installation, Click "Need an API key," which will take you to Google Gemini's website. Here, click "Get API Key" and/or "Create API Key."

<img width="841" alt="Gemini Page" src="https://github.com/user-attachments/assets/8cb7cf2a-788f-4065-af0f-7a423f0f853c" />


Select "Gemini API" as your "project." Then copy and paste it into the extention and click "Save Key". 

<img width="451" alt="Get Gemini Key" src="https://github.com/user-attachments/assets/e0497825-5f30-4864-ac3b-38e200cb5198" />

That's all! You are done. Your key will be stored locally.

## Usage

<img width="272" alt="Extension window" src="https://github.com/user-attachments/assets/2e58e6d4-bb89-4f42-b23a-2f229fd359d2" />

### Screen Shot

There are two ways to create events from screenshots:

#### 1. Standard Mode (Default)
Select "Create from Screenshot" on the extension while being on the tab with your message(s). In the screenshot, include all texts containing details of the event. After processing, you'll be taken to the confirmation page where you can edit the event details before adding to your calendar.

#### 2. QuickAdd Mode (Toggle On)
Enable the "Use QuickAdd for screenshots" toggle under the screenshot button. This mode:
- Takes a screenshot of your message(s)
- Directly extracts event details and creates an event in your calendar without the confirmation page
- Shows a notification when your event is added
- Generally provides more reliable event creation as it uses Google Calendar's native QuickAdd feature

**When to use QuickAdd Mode:** 
- For simple events where you don't need to add attendees, descriptions, or reminders
- When you want the fastest way to add events to your calendar
- For better reliability with Google Calendar's API

The screenshot might take a few seconds to process. Click ESCAPE to exit screenshot mode.

### Quick Add

Instead of screenshotting the message, paste it here, and you will be taken to the confirmation page.

### Confirmation Page

Here, you can edit your event(s). Adjust timings, date, ect. 

**Fill in any empty Date/Time fields. Customizable event durations coming soon**. 

(You may also invite others and it will show up in the calendar for confirmation too!)

## Youtube Demo

[![FastEvent setup guide](https://img.youtube.com/vi/yZX1OLRJInc/0.jpg)](https://www.youtube.com/watch?v=yZX1OLRJInc)

## Errors

This extension won't run on "default tabs" such as settings, new tab, and urls that start with chrome://
It should work on all normal webpages.

If the confirmation goes through, but the event doesn't appear, it might be from the sometimes unreliable calendar API. 

Fixes try any/a combination of: 

1. Try again in a few minutes
   
2. Redownload the extension

3. Reload your API key. 


## Shortcuts

Windows: Open Extension Window: Ctrl + Shift + E

Mac: Open Extension Window: Cmd + Shift + E
Enter screenshot: Coming Soon!
