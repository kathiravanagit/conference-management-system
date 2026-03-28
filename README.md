# 🎓 ConferenceHub

A modern, full-stack Academic Conference Management System built on the MERN stack (MongoDB, Express.js, React.js, Node.js). Designed for colleges and universities to seamlessly manage events, registrations, and student participation.

## ✨ Features

- **Role-Based Access Control**: Secure dashboards for Students, Staff, and Admins.
- **Dynamic Theming**: Fully responsive UI with a seamless Light/Dark mode toggle.
- **Enhanced Security**: Built-in 2-Factor Authentication (2FA) for all users.
- **Smart Registrations & Attendance**: Register for events and mark attendance instantly via auto-generated QR Codes.
- **Automated Certification**: Instantly generate and download PDF certificates for completed events.
- **Gamification**: Built-in Leaderboard system rewarding active student participation.
- **Real-time Interaction**: Live Q&A sessions powered by Socket.io.
- **Email Notifications**: Integrated with Brevo for transactional emails and welcome alerts.

## 🚀 Tech Stack

- **Frontend**: React.js 18, React Router v6, CSS Variables (Vanilla CSS)
- **Backend**: Node.js, Express.js, Socket.io
- **Database**: MongoDB & Mongoose
- **Security**: JWT Authentication, bcryptjs, Speakeasy (2FA)
- **Utilities**: PDFKit (Certificates), QRCode (Attendance), Date-fns

## 🛠️ Quick Start

### 1. Prerequisites

- Node.js (v16+)
- MongoDB (Local or Atlas)
- Git

### 2. Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd mini-project

# Install Backend Dependencies
cd backend
npm install

# Install Frontend Dependencies
cd ../frontend
npm install
```

### 3. Environment Variables

Create a `.env` file in both the `backend/` and `frontend/` directories.

**Backend (`backend/.env`)**

```env
MONGO_URI=mongodb://localhost:27017/conferencehub
JWT_SECRET=your_jwt_secret_key
PORT=5000
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=noreply@mvit.edu.in
CLIENT_URL=http://localhost:3000
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openrouter/auto
```

**Frontend (`frontend/.env`)**

```env
REACT_APP_API_URL=http://localhost:5000
```

### 4. Run the Application

Start both servers in separate terminal windows:

```bash
# Terminal 1: Backend
cd backend
npm start

# Terminal 2: Frontend
cd frontend
npm start
```

The app will be running at `http://localhost:3000`.

---
*Made for MVIT.*
