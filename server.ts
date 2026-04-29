import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://helpstacconnect_db_user:TVS0hb66PtxWn5pU@stacmarine.u3qbxiu.mongodb.net/quiz?appName=stacmarine";

app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[API Request] ${req.method} ${req.url}`);
  next();
});

// Mongoose Schemas
const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  name: String,
  email: { type: String, lowercase: true },
  phone: String,
  sector: String,
  location: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { strict: false });

const attemptSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  score: Number,
  total: Number,
  percentage: Number,
  timestamp: { type: Date, default: Date.now },
  answers: Array,
  comments: String
}, { strict: false });

const User = mongoose.model('User', userSchema);
const Attempt = mongoose.model('Attempt', attemptSchema);

// Email Configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to: string, subject: string, text: string) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`[Email Mock] To: ${to}, Subject: ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"STAC Marine" <noreply@stacmarine.com>',
      to,
      subject,
      text,
    });
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

let lastDbError: string | null = null;

async function connectDB(retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[DB] Mongoose connecting (Attempt ${i + 1}/${retries})...`);
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log("[DB] Mongoose connected successfully");
      lastDbError = null;
      return;
    } catch (err) {
      lastDbError = err instanceof Error ? err.message : String(err);
      console.error(`[DB] Mongoose attempt ${i + 1} failed:`, lastDbError);
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

// API Routes
app.get('/api/users/test', async (req, res) => {
  const readyState = mongoose.connection.readyState;
  const statusMap = ["disconnected", "connected", "connecting", "disconnecting"];
  
  const status = {
    ok: readyState === 1,
    connection: statusMap[readyState],
    dbInitialized: readyState === 1,
    lastError: lastDbError,
    timestamp: new Date().toISOString()
  };

  if (readyState !== 1) {
    return res.status(503).json({ ...status, error: 'Database not connected' });
  }

  try {
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      return res.json(status);
    }
    throw new Error("DB object missing");
  } catch (err) {
    return res.status(500).json({ ...status, error: String(err) });
  }
});

app.post(['/api/registration', '/api/registration/:userId'], async (req, res) => {
  const profile = req.body;
  const tempUid = req.params.userId || profile?.uid;
  
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    if (!profile || (!profile.email && !profile.phone)) {
      return res.status(400).json({ error: 'Email or Phone required' });
    }

    let query: any = { $or: [] };
    if (profile.email) query.$or.push({ email: profile.email.toLowerCase() });
    if (profile.phone) query.$or.push({ phone: profile.phone });
    
    let existingUser = await User.findOne(query);

    const isNewRegistration = !existingUser;
    // CRITICAL: Prioritize phone as stable UID if available, otherwise use existing or temp
    const stableUid = profile.phone || tempUid || `u_${Math.random().toString(36).substring(2, 11)}`;
    const finalUid = existingUser ? existingUser.uid : stableUid;
    
    const updateData = {
      ...profile,
      uid: finalUid,
      email: profile.email?.toLowerCase(),
      updatedAt: new Date()
    };
    delete updateData._id;

    const savedUser = await User.findOneAndUpdate(
      { uid: finalUid },
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    if (isNewRegistration && profile.email) {
      const welcomeMessage = `Welcome to the STAC Marine Assessment!\n\nThank you for registering. You can now proceed to take your compliance assessment.\n\nGood luck!`;
      sendEmail(profile.email, 'Registration Successful - STAC Marine Assessment', welcomeMessage)
        .catch(err => console.error("Welcome email failed", err));
    }

    res.json({ 
      success: true, 
      user: { ...savedUser.toObject(), isNewUser: isNewRegistration } 
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: 'Database error', details: String(error) });
  }
});

app.get('/api/users/find/identifier', async (req, res) => {
  const { identifier } = req.query;
  if (!identifier) return res.status(400).json({ error: 'Identifier required' });
  
  try {
    const id = (identifier as string).trim();
    const user = await User.findOne({
      $or: [
        { email: id.toLowerCase() },
        { phone: id }
      ]
    });
    
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: 'Profile not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/users/:userId', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.userId });
    if (user) res.json(user);
    else res.status(404).json({ error: 'User not found' });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/attempts', async (req, res) => {
  try {
    const attempt = new Attempt(req.body);
    await attempt.save();
    
    if (attempt.percentage >= 80) {
      const user = await User.findOne({ uid: attempt.userId });
      if (user?.email) {
        const passMessage = `Congratulations ${user.name}!\n\nYou have passed the STAC Marine Assessment with ${attempt.percentage}%.\n\nBest regards,\nThe STAC Marine Team`;
        sendEmail(user.email, 'Congratulations! You Passed', passMessage)
          .catch(err => console.error("Pass email failed", err));
      }
    }
    res.json({ success: true, id: attempt._id });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.patch('/api/attempts/:attemptId/comments', async (req, res) => {
  try {
    const result = await Attempt.findByIdAndUpdate(req.params.attemptId, { 
      $set: { comments: req.body.comments } 
    });
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/attempts/:userId', async (req, res) => {
  try {
    const attempts = await Attempt.find({ userId: req.params.userId }).sort({ timestamp: -1 });
    res.json(attempts);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.all('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

async function startServer() {
  try {
    await connectDB().catch(err => console.error("Initial DB connection failed", err.message));
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Standalone API Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
