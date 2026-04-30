import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import sharp from 'sharp';

dotenv.config();

const app = express();
const PORT = 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://helpstacconnect_db_user:TVS0hb66PtxWn5pU@stacmarine.u3qbxiu.mongodb.net/quiz?appName=stacmarine";

app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`[API Request] ${req.method} ${req.url}`);
  }
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
  host: process.env.SMTP_HOST || 'smtp.zoho.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('[Email] CRITICAL: Transporter verification failed!');
    console.error(`[Email] Error: ${error.message}`);
    // @ts-ignore
    if (error.code) console.error(`[Email] Code: ${error.code}`);
    console.warn('[Email] Please check if SMTP_USER and SMTP_PASS are correct. If using Zoho/Gmail, an App Password is required.');
  } else {
    console.log('[Email] SUCCESS: Transporter is ready to send emails via Zoho');
  }
});

const sendEmail = async (to: string, subject: string, text: string, attachments?: any[], replyTo?: string, fromName?: string) => {
  console.log(`[Email] Attempting to send email to: ${to}, Subject: ${subject}`);
  
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn(`[Email Mock] ENVIRONMENT VARIABLES MISSING (SMTP_HOST or SMTP_USER). LOGGING ONLY.`);
    console.log(`[Email Mock] To: ${to}`);
    console.log(`[Email Mock] Subject: ${subject}`);
    if (attachments) console.log(`[Email Mock] Attachments: ${attachments.length} files`);
    return { mock: true, success: true };
  }

  try {
    const defaultFromName = "STAC Marine";
    const name = fromName || defaultFromName;
    const fromAddress = `"${name}" <${process.env.SMTP_USER}>`;
    
    console.log(`[Email] Sending from: ${fromAddress}`);
    if (replyTo) console.log(`[Email] Reply-To: ${replyTo}`);
    
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text,
      attachments,
      replyTo: replyTo
    });
    console.log(`[Email] Message sent successfully!`);
    console.log(`[Email] Message ID: ${info.messageId}`);
    console.log(`[Email] Response: ${info.response}`);
    if (info.accepted?.length) console.log(`[Email] Accepted: ${info.accepted.join(', ')}`);
    if (info.rejected?.length) console.warn(`[Email] Rejected: ${info.rejected.join(', ')}`);
    return info;
  } catch (error) {
    console.error('[Email] CRITICAL FAILURE sending email:');
    if (error instanceof Error) {
      console.error(`- Name: ${error.name}`);
      console.error(`- Message: ${error.message}`);
      console.error(`- Stack: ${error.stack}`);
      // @ts-ignore
      if (error.code) console.error(`- Code: ${error.code}`);
      // @ts-ignore
      if (error.command) console.error(`- Command: ${error.command}`);
    } else {
      console.error(String(error));
    }
    throw error;
  }
};

app.get('/api/email/test', async (req, res) => {
  if (!process.env.SMTP_USER) {
    return res.status(500).json({ error: 'SMTP_USER not configured' });
  }

  try {
    console.log('[Email Test] Triggering test email...');
    const result = await sendEmail(
      'timoshimmo88@gmail.com',
      'STAC Marine - SMTP Test',
      'This is a test email from the STAC Marine Assessment system to verify SMTP configuration.'
    );
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

const generateCertificateBuffer = async (name: string, date: string): Promise<Buffer> => {
  const templateUrl = process.env.CERTIFICATE_TEMPLATE_URL || "https://res.cloudinary.com/stacconnect/image/upload/v177541729/certificate_new__2_ohxlvn.png";
  const certNo = `STAC/CYB/2026/${Math.floor(1000 + Math.random() * 9000)}`;
  
  try {
    const response = await fetch(templateUrl);
    const templateBuffer = Buffer.from(await response.arrayBuffer());

    // Portrait dimensions
    const width = 848;
    const height = 1200;
    
    // Positioning for the new template
    const nameY = height * 0.44; // Positioned above the name line
    const dateY = height * 0.815; // Positioned above Date Completed line
    const certNoY = height * 0.94; // Bottom left area
    const certNoX = width * 0.08;

    const svgOverlay = `
      <svg width="${width}" height="${height}">
        <style>
          .text { font-family: Arial, sans-serif; font-weight: bold; }
          .name { fill: #0f172a; font-size: 48px; text-transform: uppercase; }
          .date { fill: #1e293b; font-size: 24px; }
          .certNo { fill: #64748b; font-size: 14px; font-weight: normal; }
        </style>
        <text x="50%" y="${nameY}" text-anchor="middle" class="text name">${name.toUpperCase()}</text>
        <text x="50%" y="${dateY}" text-anchor="middle" class="text date">${date}</text>
        <text x="${certNoX}" y="${certNoY}" text-anchor="start" class="text certNo">CERT NO. ${certNo}</text>
      </svg>
    `;

    return await sharp(templateBuffer)
      .resize(width, height, { fit: 'cover' })
      .composite([{
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0
      }])
      .png()
      .toBuffer();
  } catch (err) {
    console.error("[Certificate Generator] Error:", err);
    throw err;
  }
};

let lastDbError: string | null = null;
let cachedDbPromise: Promise<void> | null = null;

async function connectDB(retries = 5) {
  if (cachedDbPromise) return cachedDbPromise;

  cachedDbPromise = (async () => {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`[DB] Mongoose connecting (Attempt ${i + 1}/${retries})...`);
        const conn = await mongoose.connect(MONGODB_URI, {
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 45000,
        });
        console.log("[DB] Mongoose connected successfully");
        lastDbError = null;
        return;
      } catch (err) {
        lastDbError = err instanceof Error ? err.message : String(err);
        console.error(`[DB] Mongoose attempt ${i + 1} failed:`, lastDbError);
        if (i === retries - 1) {
          cachedDbPromise = null; // Reset promise so next request can retry
          throw err;
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  })();

  return cachedDbPromise;
}

// Middleware to ensure DB connection for API routes
const dbMiddleware = async (req: any, res: any, next: any) => {
  if (req.url.startsWith('/api')) {
    try {
      await connectDB();
      next();
    } catch (err) {
      res.status(503).json({ error: 'Database connection failed', details: String(err) });
    }
  } else {
    next();
  }
};

app.use(dbMiddleware);

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
    
    if (isNewRegistration) {
      console.log(`[Registration] New registration detected. profile.email: "${profile.email}"`);
      if (profile.email) {

        console.log(`[Welcome Email] profile.email is found: "${profile.email}"`);

        const welcomeMessage = `Welcome to the STAC Marine Assessment!\n\nThank you for registering. You can now proceed to take your compliance assessment.\n\nCandidate Details:\nName: ${profile.name}\nEmail: ${profile.email}\nPhone: ${profile.phone}\n\nGood luck!`;
        
        // Sending welcome email to the user
        sendEmail(profile.email, 'Registration Successful - STAC Marine Assessment', welcomeMessage)
          .then(() => console.log(`[Registration] Welcome email sent to ${profile.email}`))
          .catch(err => console.error(`[Registration] Welcome email FAILED for ${profile.email}:`, err));
      }
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
        const passMessage = `Congratulations ${user.name}!\n\nYou have passed the STAC Marine Assessment with ${attempt.percentage}%.\n\nPlease find your official certificate attached to this email.\n\nBest regards,\nThe STAC Marine Team`;
        
        const dateStr = new Date(attempt.timestamp).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });

        generateCertificateBuffer(user.name, dateStr)
          .then(buffer => {
            return sendEmail(
              user.email, 
              'Congratulations! Your STAC Marine Certificate', 
              passMessage,
              [{
                filename: `Certificate_${user.name.replace(/\s+/g, '_')}.png`,
                content: buffer
              }],
              undefined,
              'STAC Marine Certificates'
            );
          })
          .then(() => console.log(`[Quiz] Pass email with certificate sent to ${user.email}`))
          .catch(err => console.error(`[Quiz] Pass email/cert FAILED for ${user.email}:`, err));
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

app.get('/api/info', (req, res) => {
  const routes = (app as any)._router?.stack
    .filter((r: any) => r.route)
    .map((r: any) => ({
      method: Object.keys(r.route.methods).join(', ').toUpperCase(),
      path: r.route.path
    }));
  res.json({ routes });
});

app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

async function startServer() {
  try {
    console.log('[Config] Environment variables check:');
    console.log(`- SMTP_HOST: ${process.env.SMTP_HOST ? 'Present' : 'Missing'}`);
    console.log(`- SMTP_PORT: ${process.env.SMTP_PORT || '465 (Default)'}`);
    console.log(`- SMTP_SECURE: ${process.env.SMTP_SECURE || 'true (Default)'}`);
    console.log(`- SMTP_USER: ${process.env.SMTP_USER ? 'Present' : 'Missing'}`);
    console.log(`- SMTP_PASS: ${process.env.SMTP_PASS ? 'Present (length: ' + process.env.SMTP_PASS.length + ')' : 'Missing'}`);
    console.log(`- SMTP_FROM: ${process.env.SMTP_FROM ? 'Present (' + process.env.SMTP_FROM + ')' : 'Missing (using default: "STAC Marine" <noreply@stacmarine.com>)'}`);

    await connectDB().catch(err => console.error("Initial DB connection failed", err.message));
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
export default app;



/*
import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import sharp from 'sharp';

dotenv.config();

const app = express();
const PORT = 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://helpstacconnect_db_user:TVS0hb66PtxWn5pU@stacmarine.u3qbxiu.mongodb.net/quiz?appName=stacmarine";

app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    console.log(`[API Request] ${req.method} ${req.url}`);
  }
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
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('[Email] Transporter verification failed:', error);
  } else {
    console.log('[Email] Server is ready to take our messages');
  }
});

const sendEmail = async (to: string, subject: string, text: string, attachments?: any[]) => {
  console.log(`[Email] Attempting to send email to: ${to}, Subject: ${subject}`);
  
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`[Email Mock] ENVIRONMENT VARIABLES MISSING (SMTP_HOST or SMTP_USER). LOGGING ONLY.`);
    console.log(`[Email Mock] To: ${to}, Subject: ${subject}`);
    if (attachments) console.log(`[Email Mock] Attachments: ${attachments.length} files`);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"STAC Marine" <noreply@stacmarine.com>',
      to,
      subject,
      text,
      attachments
    });
    console.log(`[Email] Message sent successfully: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('[Email] Error sending email:', error);
    throw error;
  }
};

const generateCertificateBuffer = async (name: string): Promise<Buffer> => {
  const templateUrl = process.env.CERTIFICATE_TEMPLATE_URL || "https://res.cloudinary.com/stacconnect/image/upload/v1777434190/Cybersecurity_certificate_wickx9.png";
  
  try {
    const response = await fetch(templateUrl);
    const templateBuffer = Buffer.from(await response.arrayBuffer());

    // Create SVG overlay for the name
    // Coordinates: Centered at ~48.5% height based on previous component logic
    // Template is ~1200x848
    const width = 848;
    const height = 1200;
    const nameY = height * 0.46; 

    const svgOverlay = `
      <svg width="${width}" height="${height}">
        <style>
          .name { 
            fill: #0f172a; 
            font-size: 56px; 
            font-family: Arial, sans-serif; 
            font-weight: bold;
            text-transform: uppercase;
          }
        </style>
        <text x="50%" y="${nameY}" text-anchor="middle" class="name">${name.toUpperCase()}</text>
      </svg>
    `;

    return await sharp(templateBuffer)
      .resize(width, height, { fit: 'cover' })
      .composite([{
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0
      }])
      .png()
      .toBuffer();
  } catch (err) {
    console.error("[Certificate Generator] Error:", err);
    throw err;
  }
};

let lastDbError: string | null = null;
let cachedDbPromise: Promise<void> | null = null;

async function connectDB(retries = 5) {
  if (cachedDbPromise) return cachedDbPromise;

  cachedDbPromise = (async () => {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`[DB] Mongoose connecting (Attempt ${i + 1}/${retries})...`);
        const conn = await mongoose.connect(MONGODB_URI, {
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 45000,
        });
        console.log("[DB] Mongoose connected successfully");
        lastDbError = null;
        return;
      } catch (err) {
        lastDbError = err instanceof Error ? err.message : String(err);
        console.error(`[DB] Mongoose attempt ${i + 1} failed:`, lastDbError);
        if (i === retries - 1) {
          cachedDbPromise = null; // Reset promise so next request can retry
          throw err;
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  })();

  return cachedDbPromise;
}

// Middleware to ensure DB connection for API routes
const dbMiddleware = async (req: any, res: any, next: any) => {
  if (req.url.startsWith('/api')) {
    try {
      await connectDB();
      next();
    } catch (err) {
      res.status(503).json({ error: 'Database connection failed', details: String(err) });
    }
  } else {
    next();
  }
};

app.use(dbMiddleware);

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
        .then(() => console.log(`[Registration] Welcome email sent to ${profile.email}`))
        .catch(err => console.error(`[Registration] Welcome email FAILED for ${profile.email}:`, err));
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
        const passMessage = `Congratulations ${user.name}!\n\nYou have passed the STAC Marine Assessment with ${attempt.percentage}%.\n\nPlease find your official certificate attached to this email.\n\nBest regards,\nThe STAC Marine Team`;
        
        generateCertificateBuffer(user.name)
          .then(buffer => {
            return sendEmail(
              user.email, 
              'Congratulations! Your STAC Marine Certificate', 
              passMessage,
              [{
                filename: `Certificate_${user.name.replace(/\s+/g, '_')}.png`,
                content: buffer
              }]
            );
          })
          .then(() => console.log(`[Quiz] Pass email with certificate sent to ${user.email}`))
          .catch(err => console.error(`[Quiz] Pass email/cert FAILED for ${user.email}:`, err));
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

app.get('/api/info', (req, res) => {
  const routes = (app as any)._router?.stack
    .filter((r: any) => r.route)
    .map((r: any) => ({
      method: Object.keys(r.route.methods).join(', ').toUpperCase(),
      path: r.route.path
    }));
  res.json({ routes });
});

app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

async function startServer() {
  try {
    console.log('[Config] Environment variables check:');
    console.log(`- SMTP_HOST: ${process.env.SMTP_HOST ? 'Present' : 'Missing'}`);
    console.log(`- SMTP_USER: ${process.env.SMTP_USER ? 'Present' : 'Missing'}`);
    console.log(`- SMTP_PASS: ${process.env.SMTP_PASS ? 'Present (length: ' + process.env.SMTP_PASS.length + ')' : 'Missing'}`);
    console.log(`- SMTP_FROM: ${process.env.SMTP_FROM ? 'Present (' + process.env.SMTP_FROM + ')' : 'Missing (using default: "STAC Marine" <noreply@stacmarine.com>)'}`);

    await connectDB().catch(err => console.error("Initial DB connection failed", err.message));
    
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      // Don't intercept API routes
      if (req.url.startsWith('/api')) return;
      res.sendFile(path.join(distPath, 'index.html'));
    });

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Serving static files from ${distPath}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
export default app;

*/