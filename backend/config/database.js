const mongoose = require('mongoose');

/**
 * Connect to MongoDB database
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    console.error('Continuing without DB connection for local/debug testing.');
    // Do NOT exit process here to allow local testing of auth flows when Atlas is unreachable.
    // Return null so callers can detect missing connection if needed.
    return null;
  }
};

module.exports = connectDB;
