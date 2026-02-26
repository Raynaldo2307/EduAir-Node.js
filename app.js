 
 // to load environment varibles from .env file
 require('dotenv').config();
 
 
// load the express library
const express = require('express');
const cors = require('cors');

const db = require("./config/db");
const authRoutes = require('./routes/authRoutes');
const schoolRoutes = require('./routes/schoolRoutes');
const studentRoutes = require('./routes/studentRoutes');

// app22 create the express application server
const app = express();

// Middleware to parse JSON bodies in requests
// translate to json format using express.json()
app.use(express.json());

// Middleware to enable CORS(Cross-Origin-Resourc-Sharing)
//Which apps/websites are allowed to talk to my server
app.use(cors());

// Route: test of server is alive
app.get('/', (req, res) => {
    console.log('EduAir API is running');
    res.send('EduAir API is running');
});

// Auth routes
app.use('/api/auth', authRoutes);

// School routes
app.use('/api/schools', schoolRoutes);

// Student routes
app.use('/api/students', studentRoutes);


// Global error handler — must be LAST, after all routes
// Catches every next(error) call in the entire app
app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;

  // Operational errors (AppError) — send the real message to client
  // Unexpected crashes — send a generic message, log the real error server-side
  if (!err.isOperational) {
    console.error('❌ Unexpected error:', err);
  }

  res.status(statusCode).json({
    status: 'error',
    message: err.isOperational ? err.message : 'Something went wrong. Please try again.',
  });
});

// Start the server  and listening are running
const PORT = process.env.PORT || 3500;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
