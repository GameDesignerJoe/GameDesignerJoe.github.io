Comic Scanner MVP - Design Specification
Project Overview
A single-page web application for scanning comic book barcodes and retrieving comic information from the Comic Vine API. Development will occur in two phases: manual barcode entry first, then camera scanning.

Phase 1: Manual Barcode Entry (Build This First)
Purpose
Prove the Comic Vine API integration works with comic barcodes before adding camera complexity.
Technical Requirements
File Structure:

Single HTML file: comic-scanner.html
All CSS and JavaScript inline
No external dependencies for Phase 1

API Configuration:

Comic Vine API Key: 6be7a1f7e4ebe66403aca6ff9e8174f6a8aa9717
Rate Limit: 200 requests/hour
Base URL: https://comicvine.gamespot.com/api/

UI Layout (Dark Mode)
Color Scheme:

Background: #1a1a1a
Card/container background: #2a2a2a
Text primary: #e0e0e0
Text secondary: #a0a0a0
Accent/button: #4a9eff
Button hover: #3a8eef

Page Structure:

Header Section (centered, top)

Title: "Comic Scanner"
Font: Sans-serif, thin weight, 32px
Color: #e0e0e0
Margin bottom: 40px


Input Section (centered, middle)

Text input field for barcode number
Placeholder text: "Enter barcode number"
Width: 300px max
Height: 48px
Border: 1px solid #4a4a4a
Border radius: 8px
Padding: 12px
Font size: 16px
Background: #333333
Text color: #e0e0e0


Search Button (below input)

Text: "Search"
Width: 300px max (matches input)
Height: 48px
Background: #4a9eff
Border: none
Border radius: 8px
Font size: 16px
Font weight: 500
Color: white
Margin top: 16px
Cursor: pointer
Hover state: background #3a8eef


Results Section (below button, initially hidden)

Container background: #2a2a2a
Border radius: 12px
Padding: 24px
Max width: 400px
Margin top: 32px
Box shadow: 0 4px 6px rgba(0,0,0,0.3)



Results Display Format:
[Cover Thumbnail - centered]
200px max width, maintain aspect ratio

Comic Name
Font size: 24px, font weight: 300, color: #e0e0e0

Issue #[Number]
Font size: 18px, color: #a0a0a0, margin top: 8px

New Search Button (below results)

Same styling as Search button
Text: "Search Another Comic"
Only appears after successful search



Functionality Requirements
On Page Load:

Display input field and Search button
Results section hidden
Focus on input field

On Search Button Click:

Get barcode value from input
Validate it's not empty
Show loading state (button text changes to "Searching...")
Call Comic Vine API
Parse response
Display results or error

API Call Details:
Endpoint: https://comicvine.gamespot.com/api/issues/
Query Parameters:

api_key: Your API key
format: json
filter: upc:[barcode_value]
field_list: name,issue_number,image,volume

The API returns JSONP by default. You'll need to handle this with either:

Adding &json_callback=? (if using jQuery)
Using CORS proxy if needed
Or requesting JSON format and handling CORS

Response Parsing:

Check results array
If empty: display "No comic found with this barcode"
If found: extract first result

Name: results[0].volume.name (series name)
Issue Number: results[0].issue_number
Cover Image: results[0].image.medium_url or image.small_url



Error Handling:

Empty barcode: "Please enter a barcode number"
API error: "Error searching. Please try again."
No results: "No comic found with this barcode"
Rate limit hit: "Too many requests. Please wait a moment."

Display errors in red text (#ff6b6b) below the search button
Responsive Design

Center all content vertically and horizontally
Add padding: 20px on all sides
Works on mobile (320px min width) to desktop

Testing Checklist

 Input accepts numeric barcodes
 Search button triggers API call
 Loading state displays during API call
 Results display correctly with all three fields
 Cover image loads and displays
 "Search Another Comic" button clears results and returns to input
 Error messages display appropriately
 Works on mobile browser
 Works on desktop browser


Phase 2: Camera Barcode Scanner (Build After Phase 1 Works)
Additional Requirements
New Dependencies:
Add to <head>:
html<script src="https://unpkg.com/html5-qrcode"></script>
UI Changes
Replace Input Section with:

Camera Container (hidden initially)

<div id="reader"> for camera feed
Width: 100%, max 500px
Height: 300px
Border radius: 8px
Margin bottom: 16px


Scan Button (replaces input + search)

Text: "Scan Comic"
Same styling as Phase 1 search button
When clicked: opens camera view
When scanning: changes to "Stop Scanning"



Functionality Updates
On "Scan Comic" Click:

Show camera container
Initialize Html5QrcodeScanner:

javascriptconst html5QrcodeScanner = new Html5QrcodeScanner(
  "reader",
  { 
    fps: 10, 
    qrbox: { width: 250, height: 100 },
    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
  }
);

On barcode detected:

Stop scanner
Hide camera container
Use barcode value to call Comic Vine API (same as Phase 1)
Display results



Camera Permissions:

Browser will automatically prompt for camera access
If denied: display message "Camera access required to scan barcodes"

Stop Scanning:

Button to cancel and return to initial state
Stops camera feed
Hides camera container

Updated Flow

Page loads → "Scan Comic" button visible
Click "Scan Comic" → Camera opens
Point camera at barcode → Auto-detects and searches
Display results (same as Phase 1)
"Scan Another Comic" button → returns to step 1


Development Notes for Cline
Phase 1 Priority:
Build and test Phase 1 completely before touching Phase 2. Phase 1 proves the API integration works.
Common Barcode Formats:
Comic books typically use:

UPC-A (12 digits)
EAN-13 (13 digits)

Testing Barcodes:
You'll need to test with real comic book barcodes. Have Joe scan/photograph a few barcodes from his collection to test with.
Comic Vine API Notes:

The API can be slow (2-3 seconds response time)
Some older comics may not have UPC codes in the database
The volume object contains the series name, not the issue name
Always check if results array has items before accessing

CORS Issues:
If you hit CORS errors with Comic Vine API, you may need to:

Use a CORS proxy like https://cors-anywhere.herokuapp.com/
Or deploy to Vercel which can handle API calls server-side

Mobile Testing:

Test on actual phone, not just browser DevTools
Camera permissions work differently on iOS vs Android
Some browsers don't support camera access on insecure origins (non-HTTPS)
Vercel automatically provides HTTPS


Success Criteria
Phase 1 Complete When:

Can manually enter a barcode
API successfully returns comic data
Displays name, issue number, and cover image
Works on Joe's phone via Vercel deployment

Phase 2 Complete When:

Camera opens and scans barcodes automatically
Scanning triggers the same successful API flow as Phase 1
Works reliably on Joe's phone


File Deliverable
Single file: comic-scanner.html containing:

HTML structure
Inline CSS (<style> in <head>)
Inline JavaScript (<script> before </body>)
Comments explaining each section

Total file size should be under 10KB for Phase 1, under 15KB for Phase 2 (excluding external library).