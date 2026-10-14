# MedRelay - Medical Billing Automation

Transform clinical conversations into CMS-1500 claim forms with AI-powered automation.

## Overview

MedRelay is a hackathon project that addresses the administrative burden of medical billing by automatically generating CMS-1500 claim forms from doctor-patient conversation transcripts. The system uses Google's Gemini AI to extract patient information, diagnoses, and procedures, then generates a properly formatted PDF claim form.

## Features

- **AI-Powered Extraction**: Automatically extracts patient details, diagnoses, and procedures from clinical transcripts
- **Medical Code Lookup**: Converts plain English medical terms to official ICD-10 and CPT codes
- **PDF Generation**: Creates properly formatted CMS-1500 claim forms
- **Simple Web Interface**: Easy-to-use frontend for transcript input and PDF download
- **Real-time Processing**: Fast AI processing with status indicators

## Technology Stack

- **Backend**: Python Flask
- **AI**: Google Gemini 2.0 Flash
- **PDF Generation**: fpdf2
- **Frontend**: HTML, JavaScript, Tailwind CSS
- **Medical Coding**: Custom lookup service

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd scribemd
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
# Create a .env file
echo "GEMINI_API_KEY=your_api_key_here" > .env
```

4. Run the application:
```bash
python app.py
```

5. Open your browser and navigate to `http://localhost:5000`

## Usage

1. **Input Transcript**: Paste your doctor-patient conversation into the text area
2. **Generate Form**: Click "Generate Claim Form" to process with AI
3. **Download PDF**: Once processing is complete, download your CMS-1500 form

## Example Transcript

```
Doctor: Good morning, Sarah. What brings you in today?
Patient: I've been having a sore throat and fever for the past few days.
Doctor: Let me examine you. I can see some redness in your throat. I'll do a rapid strep test to check for strep throat.
Patient: Okay, that sounds good.
Doctor: The test came back positive for strep throat. I'll prescribe you some antibiotics and recommend rest and fluids.
Patient: Thank you, doctor.
```

## API Endpoints

- `GET /` - Main web interface
- `POST /generate-claim` - Generate CMS-1500 form from transcript
- `GET /health` - Health check endpoint

## Project Structure

```
scribemd/
├── app.py                  # Main Flask application
├── pdf_generator.py        # PDF generation service
├── code_lookup.py          # Medical code lookup service
├── requirements.txt        # Python dependencies
├── templates/
│   └── index.html          # Frontend HTML page
└── static/                 # Static assets (if needed)
```

## Medical Code Support

The system currently supports lookup for common:
- **ICD-10 Diagnosis Codes**: Strep throat, fever, hypertension, diabetes, etc.
- **CPT Procedure Codes**: Office visits, rapid strep tests, injections, etc.

## Limitations

- This is a hackathon prototype and not intended for production use
- Medical code lookup is simplified and may not cover all cases
- PDF formatting is basic and may need refinement for specific requirements
- No validation of medical codes or claim accuracy

## Future Enhancements

- Integration with real medical coding APIs
- Support for additional claim form types
- Enhanced PDF formatting and validation
- Batch processing capabilities
- Integration with EHR systems

## License

This project is created for the HopHacks hackathon and is not intended for commercial use.