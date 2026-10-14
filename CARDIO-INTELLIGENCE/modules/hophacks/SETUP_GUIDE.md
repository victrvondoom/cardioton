# MongoDB Setup Guide for MedRelay

## Option 1: Local MongoDB Installation (Recommended for Development)

### Windows:
1. Download MongoDB Community Server from https://www.mongodb.com/try/download/community
2. Install with default settings
3. MongoDB will run as a Windows service on `mongodb://localhost:27017`

### Alternative: MongoDB Atlas (Cloud, Free Tier)
1. Go to https://www.mongodb.com/atlas
2. Create a free account
3. Create a free cluster (M0)
4. Get your connection string and update `.env`:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/scribemd
   ```

## Installation Steps:

1. Install the new Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Make sure MongoDB is running (if using local installation)

3. Update your `.env` file with the appropriate MongoDB URI

4. Run the application:
   ```bash
   python app.py
   ```

## Features Added:

- **User Authentication**: Login/signup with password hashing
- **Session Management**: Secure cookie-based sessions
- **Database Storage**: Users, sessions, transcripts, and forms stored in MongoDB
- **Navigation**: Multi-page application with dashboard, forms, and history
- **Security**: Login required for all main functionality
- **Future-Ready**: Structure in place for additional forms and features

## Usage:

1. Visit http://localhost:5000 
2. You'll be redirected to login page
3. Create an account or login
4. Access the transcript generator and other features
5. All data is saved to your account

## Database Collections:

- `users`: User accounts with hashed passwords
- `sessions`: Active user sessions
- `transcripts`: Saved transcripts and generated data
- `forms`: Future forms storage (placeholder)

The skeleton framework is now complete and ready for extension!