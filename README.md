# MRAlo Backend API

Doctor-MR Scheduling Platform - Backend API Server

## Features

- 🔐 JWT Authentication
- 👨‍⚕️ Doctor Management
- 💼 MR (Medical Representative) Management
- 📅 Smart Appointment Scheduling
- 💬 Real-time Chat (Socket.io)
- 📧 Email Notifications
- 📊 Analytics Dashboard
- 🏥 Hospital/Clinic Management
- 📝 Leave Management
- 📦 Product Catalog

## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- Socket.io
- JWT Authentication
- Nodemailer

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- MongoDB (local or Atlas)
- Gmail account (for emails)

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# Then start the server
npm run dev
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/mralo |
| JWT_SECRET | Secret key for JWT | your-secret-key |
| JWT_EXPIRE | Token expiration | 7d |
| EMAIL_HOST | SMTP host | smtp.gmail.com |
| EMAIL_PORT | SMTP port | 587 |
| EMAIL_USER | Email address | your@gmail.com |
| EMAIL_PASS | App password | xxxx-xxxx-xxxx |
| CLIENT_URL | Frontend URL | http://localhost:3000 |

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

#### Doctors
- `GET /api/doctors` - Get all doctors
- `GET /api/doctors/:id` - Get doctor by ID
- `PUT /api/doctors/profile` - Update profile

#### Appointments
- `POST /api/appointments` - Book appointment
- `GET /api/appointments` - Get appointments
- `PUT /api/appointments/:id` - Update appointment

#### Availability
- `POST /api/availability` - Add availability
- `GET /api/availability` - Get availability
- `DELETE /api/availability/:id` - Delete availability

See full API documentation in `API_DOCUMENTATION.md`

## Folder Structure

```
backend/
├── controllers/     # Route handlers
├── middleware/      # Auth & validation
├── models/          # Mongoose schemas
├── routes/          # API routes
├── socket/          # Socket.io handlers
├── utils/           # Helper functions
├── uploads/         # File uploads
└── server.js        # Entry point
```

## Deployment

### Render / Railway

1. Connect your GitHub repository
2. Set environment variables
3. Deploy

### Docker

```bash
docker build -t mralo-backend .
docker run -p 5000:5000 --env-file .env mralo-backend
```

## License

ISC
