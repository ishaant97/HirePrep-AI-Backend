# HirePrep AI Backend

Backend service for HirePrep AI, providing authentication, resume parsing, resume storage, and Gemini-powered AI responses.

## Tech Stack
- Node.js + Express
- MongoDB + Mongoose
- JWT auth via HTTP-only cookies
- Google Generative AI (Gemini)
- Multer + pdf-parse for resume uploads
- Cloudinary for resume PDF storage

## Project Structure
- connections/ — database connection
- controllers/ — request handlers
- middlewares/ — auth middleware
- models/ — Mongoose schemas
- routes/ — API routes
- utils/ — helpers (tokens, Gemini, resume parsing, Cloudinary)

## Setup

### 1) Install dependencies
```bash
npm install
```

### 2) Configure environment variables
Create a .env file in the backend root:

```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
PORT=3000
GEMINI_API_KEY=your_gemini_api_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

### 3) Run the server
```bash
npm run dev
```

Server starts at http://localhost:3000 (or PORT).

Frontend requests should send credentials (cookies) and originate from http://localhost:5173 by default (see CORS config in index.js).

## API Overview

Base URL: /api

### Auth
- POST /auth/register
  - body: { name, collegeName, email, password }
- POST /auth/login
  - body: { email, password }
- POST /auth/logout
- GET /auth/me (protected)

### Resume
- POST /resume/save (protected)
  - multipart/form-data with field: resume (PDF file)
  - body: either `resumeData` (JSON string) or form fields matching Resume schema
- POST /resume/parseResume (protected)
  - multipart/form-data with field: resume (PDF file)
  - returns structured JSON extracted by Gemini
- GET /resume/view/:id (protected)
  - streams the stored PDF for the authenticated user
- GET /resume/user/:userId (protected)
  - returns list of resumes for the user (id, original filename, PDF URL)

### Gemini
- POST /gemini/generate (protected)
  - body: { prompt }
- POST /gemini/geminiATSResponseForResume (protected)
  - body: { desiredRole, resumeData }
  - resumeData should be the resume text to evaluate

## Auth Details
- Authentication uses JWT stored in an HTTP-only cookie named token.
- Protected routes require the cookie to be sent by the client.

## Resume Schema (Summary)
Key fields include:
- name, email, phone
- linkedin, github
- cgpa, twelfth_percent, tenth_percent, backlogs
- desired_role, experience_years, experience_level, communication_rating
- skills[], project[], certifications[], internships[]
- resumePdfUrl, originalFileName, resumeExtractedText

See models/resume.model.js for full schema.

## Notes
- The server expects a MongoDB URI and Gemini API key in .env.
- Do not commit your .env file to version control.
