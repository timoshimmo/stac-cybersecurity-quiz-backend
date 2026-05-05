
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://helpstacconnect_db_user:TVS0hb66PtxWn5pU@stacmarine.u3qbxiu.mongodb.net/quiz?appName=stacmarine";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fontPath = path.join(__dirname, 'fonts', 'Inter-Regular.ttf');
const fontBase64 = fs.readFileSync(fontPath).toString('base64');

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

const reviewSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  comment: { type: String, required: true },
  rating: { type: Number, default: 5 },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Attempt = mongoose.model('Attempt', attemptSchema);
const Review = mongoose.model('Review', reviewSchema);

const templateUrl = process.env.CERTIFICATE_TEMPLATE_URL || "https://res.cloudinary.com/stacconnect/image/upload/v177541729/certificate_new__2_ohxlvn.png";

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

const sendEmail = async (to: string, subject: string, text: string, attachments?: any[], fromName?: string) => {
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
    
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text,
      attachments
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

/*
let fontBoldBase64 = '';
let fontRegularBase64 = '';

const fetchFonts = async () => {
  if (fontBoldBase64 && fontRegularBase64) return;
  try {
    console.log('[Fonts] Fetching Inter fonts for embedding...');
    const boldRes = await fetch('https://github.com/google/fonts/raw/main/ofl/inter/static/Inter-Bold.ttf');
    const regularRes = await fetch('https://github.com/google/fonts/raw/main/ofl/inter/static/Inter-Regular.ttf');
    
    if (boldRes.ok && regularRes.ok) {
      fontBoldBase64 = Buffer.from(await boldRes.arrayBuffer()).toString('base64');
      fontRegularBase64 = Buffer.from(await regularRes.arrayBuffer()).toString('base64');
      console.log('[Fonts] Inter fonts cached successfully');
    }
  } catch (err) {
    console.error('[Fonts] Error fetching fonts:', err);
  }
};
*/

const generateCertificateBuffer = async (name: string, date: string): Promise<Buffer> => {
  
  const certNo = `STAC/CYB/2026/${Math.floor(1000 + Math.random() * 9000)}`;
  
  try {

     // Ensure fonts are loaded
    //await fetchFonts();

    const response = await fetch(templateUrl);
    const templateBuffer = Buffer.from(await response.arrayBuffer());

    sharp.cache(false);

    // Portrait dimensions
    const width = 848;
    const height = 1200;
    
    // Positioning for the new template
    const nameY = height * 0.40; // Positioned significantly higher
    const dateY = height * 0.74; // Positioned higher in the date section
    const certNoY = height * 0.94; // Bottom left area
    const certNoX = width * 0.08;

    const svgOverlay = `
      <svg width="${width}" height="${height}">
        <defs>
          <style type="text/css">
             @font-face {
              font-family: 'Inter-Regular';
              src: url('data:font/truetype;base64,${fontBase64}') format('truetype');
              font-weight: normal;
              font-style: normal;
            }
            .text { font-family: 'Inter-Regular', sans-serif; font-weight: bold; }
            .name { fill: #0f172a; font-size: 34px; text-transform: uppercase; }
            .date { fill: #1e293b; font-size: 22px; }
            .certNo { fill: #191d2d; font-size: 14px; font-weight: normal; }
          </style>
        </defs>
        <text x="50%" y="${nameY}" text-anchor="middle" class="text name">${name.toUpperCase()}</text>
        <text x="50%" y="${dateY}" text-anchor="middle" class="text date">${date}</text>
        <text x="${certNoX}" y="${certNoY}" text-anchor="start" class="text certNo">CERT NO. ${certNo}</text>
      </svg>
    `;

    /*
    const svgOverlay = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <text 
          x="50%" 
          y="${nameY}" 
          font-family="sans-serif" 
          text-transform: uppercase;
          font-weight="bold" 
          font-size="34px" 
          fill="#0f172a" 
          text-anchor="middle"
          dominant-baseline="middle"
        >${name.toUpperCase()}</text> 
        <text 
          x="50%" 
          y="${dateY}" 
          font-family="sans-serif" 
          font-weight="bold" 
          font-size="22px" 
          fill="#1e293b" 
          text-anchor="middle"
          dominant-baseline="middle"
        >${date}</text>
        <text 
          x="${certNoX}" 
          y="${certNoY}" 
          font-family="sans-serif" 
          font-size="16px" 
          fill="#191d2d"
          dominant-baseline="middle"
        >CERT NO. ${certNo}</text>
      </svg>
    `;
    */

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
    console.log('[Registration] Incoming profile:', JSON.stringify(profile, null, 2));
    
    const tempUid = req.params.userId || profile?.uid;
    const cleanEmail = profile.email?.trim().toLowerCase();
    const cleanPhone = profile.phone?.trim();
    
    try {
      if (!profile || (!cleanEmail && !cleanPhone)) {
        console.warn('[Registration] Missing email or phone');
        return res.status(400).json({ error: 'Email or Phone required' });
      }

      let query: any = { $or: [] };
      if (cleanEmail) query.$or.push({ email: cleanEmail });
      if (cleanPhone) query.$or.push({ phone: cleanPhone });
      
      console.log(`[Registration] Search query for identity: ${JSON.stringify(query)}`);
      let existingUser = await User.findOne(query);

      const isNewRegistration = !existingUser;
      
      // CRITICAL: The user's UID must ALWAYS be their phone number if available
      // This ensures consistency across devices and sessions.
      const finalUid = cleanPhone || (existingUser ? (existingUser.phone || existingUser.uid) : (tempUid || `u_${Math.random().toString(36).substring(2, 11)}`));
      
      console.log(`[Registration] Identity resolved: phone=${cleanPhone}, existing=${existingUser?.uid}, final=${finalUid}`);
      
      // Determine role - default USER, but make certain emails ADMIN
      let role = 'USER';
      const adminEmails = [
        'tokmangwang@gmail.com',
        'moses.ibrahim@stac-marine.com'
      ];
      
      if (cleanEmail && adminEmails.includes(cleanEmail)) {
        role = 'ADMIN';
      }

      const updateData = {
        ...profile,
        uid: finalUid,
        email: cleanEmail,
        phone: cleanPhone,
        role: role,
        updatedAt: new Date()
      };
      delete updateData._id;

      // Update existing user or create new one with finalUid as key
      const savedUser = await User.findOneAndUpdate(
        { $or: [{ uid: finalUid }, { phone: cleanPhone }, { email: cleanEmail }] },
        { $set: updateData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      
      console.log(`[Registration] DB Record Saved: ${savedUser.uid} (ID: ${savedUser._id})`);
      
      if (isNewRegistration) {
        console.log(`[Registration] Attempting to send welcome email to: "${cleanEmail}"`);
        if (cleanEmail) {
          const welcomeMessage = `Welcome to the STAC Marine Assessment!\n\nThank you for registering. You can now proceed to take your compliance assessment.\n\nCandidate Details:\nName: ${profile.name}\nEmail: ${cleanEmail}\nPhone: ${cleanPhone}\n\nGood luck!`;
          
          // Sending welcome email to the user
          try {
            await sendEmail(cleanEmail, 'Registration Successful - STAC Marine Assessment', welcomeMessage, [], "stacconnect@zohomail.com");
            console.log(`[Registration] SUCCESS: Welcome email sent to ${cleanEmail}`);
          } catch (err) {
            console.error(`[Registration] ERROR: Welcome email FAILED for ${cleanEmail}:`, err);
          }
        } else {
          console.warn('[Registration] Skip email: cleanEmail is empty');
        }
      } else {
        console.log('[Registration] Welcome email skipped: Not a new registration');
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
    let user = await User.findOne({
      $or: [
        { email: id.toLowerCase() },
        { phone: id }
      ]
    });
    
    if (user) {
      // Ensure uid matches phone for returning users if phone exists
      if (user.phone && user.uid !== user.phone) {
        console.log(`[Login] Correcting UID from ${user.uid} to phone number ${user.phone}`);
        user = await User.findOneAndUpdate(
          { _id: user._id },
          { $set: { uid: user.phone } },
          { new: true }
        );
      }
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
    const attemptData = req.body;
    if (attemptData.userId) {
      attemptData.userId = attemptData.userId.trim();
    }
    console.log(`[Attempt] Saving new attempt for userId: ${attemptData.userId}, score: ${attemptData.score}/${attemptData.totalQuestions}`);
    const attempt = new Attempt(attemptData);
    await attempt.save();
    console.log(`[Attempt] Saved successfully, _id: ${attempt._id}`);
    
    if (attempt.percentage >= 80) {
      const user = await User.findOne({ uid: attempt.userId });
      if (user?.email) {
        const passMessage = `Congratulations ${user.name}!\n\nYou have passed the STAC Marine Assessment with ${Math.round(attempt.percentage)}%.\n\nPlease find your official certificate attached to this email.\n\nBest regards,\nThe STAC Marine Team`;
        
        const dateStr = new Date(attempt.timestamp).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });

        try {
          const buffer = await generateCertificateBuffer(user.name, dateStr);
          await sendEmail(
            user.email, 
            'Congratulations! Your STAC Marine Certificate', 
            passMessage,
            [{
              filename: `Certificate_${user.name.replace(/\s+/g, '_')}.png`,
              content: buffer
            }],
            'stacconnect@zohomail.com'
          );
          console.log(`[Quiz] Pass email with certificate sent to ${user.email}`);
        } catch (err) {
          console.error(`[Quiz] Pass email/cert FAILED for ${user.email}:`, err);
        }
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
  const userId = (req.params.userId || '').trim();
  console.log(`[Attempt] Fetching history for userId: "${userId}"`);
  try {
    const attempts = await Attempt.find({ userId }).sort({ timestamp: -1 });
    console.log(`[Attempt] Found ${attempts.length} attempts for "${userId}"`);
    res.json(attempts);
  } catch (error) {
    console.error(`[Attempt] ERROR fetching history for "${userId}":`, error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Reviews API
app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const { userId, userName, comment, rating } = req.body;
    const review = new Review({
      userId,
      userName,
      comment,
      rating: rating || 5
    });
    await review.save();
    res.json({ success: true, review });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin API: Fetch all users
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin API: Fetch all attempts with user details
app.get('/api/admin/attempts', async (req, res) => {
  try {
    const attempts = await Attempt.find().sort({ timestamp: -1 }).lean();
    const userIds = [...new Set(attempts.map(a => a.userId))];
    const users = await User.find({ uid: { $in: userIds } }).lean();
    
    const userMap = users.reduce((acc: any, user: any) => {
      acc[user.uid] = user;
      return acc;
    }, {});

    const enrichedAttempts = attempts.map((attempt: any) => ({
      ...attempt,
      userName: userMap[attempt.userId]?.name || 'Unknown',
      userEmail: userMap[attempt.userId]?.email || 'Unknown',
    }));

    res.json(enrichedAttempts);
  } catch (error) {
    console.error('[Admin Attempts] Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin API: Update user role
app.patch('/api/admin/users/:uid/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const user = await User.findOneAndUpdate(
      { uid: req.params.uid },
      { role, updatedAt: new Date() },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin API: Toggle user role (no changes needed to existing code, just adding new route below)

// API: Download certificate for a user
app.get('/api/certificate/:userId', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const attempt = await Attempt.findOne({ 
      userId: user.uid, 
      percentage: { $gte: 80 } 
    }).sort({ timestamp: -1 });

    if (!attempt) return res.status(404).json({ error: 'No successful assessment found for this user' });

    const dateStr = new Date(attempt.timestamp).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    const buffer = await generateCertificateBuffer(user.name || 'Candidate', dateStr);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="Certificate_${(user.name || 'Candidate').replace(/\s+/g, '_')}.png"`);
    res.send(buffer);
  } catch (error) {
    console.error('[Certificate Download] Error:', error);
    res.status(500).json({ error: 'Failed to generate certificate' });
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
const templateUrl = process.env.CERTIFICATE_TEMPLATE_URL || "https://res.cloudinary.com/stacconnect/image/upload/v177541729/certificate_new__2_ohxlvn.png";

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
    
    // CRITICAL: 553 error usually means the SMTP server is strict about the 'from' address.
    // We prioritize SMTP_FROM if defined, otherwise we use SMTP_USER.
    // We also make the display name optional to avoid formatting issues with some relays.
    const senderEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    const fromAddress = name ? `"${name}" <${senderEmail}>` : senderEmail;
    
    console.log(`[Email] Sending from: ${fromAddress}`);
    if (replyTo) console.log(`[Email] Reply-To: ${replyTo}`);
    
    const info = await transporter.sendMail({
      from: fromAddress || '"STAC Marine" <noreply@stacmarine.com>',
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
  const certNo = `STAC/CYB/2026/${Math.floor(1000 + Math.random() * 9000)}`;
  
  try {
    const response = await fetch(templateUrl);
    const templateBuffer = Buffer.from(await response.arrayBuffer());
    
    // Disable sharp cache to ensure fresh generation
    sharp.cache(false);

    // Portrait dimensions
    const width = 848;
    const height = 1200;
    
    // Positioning for the new template
    const nameY = height * 0.37; // Positioned at 35% as per UI manual edit
    const dateY = height * 0.74; // Positioned at 75% as per UI manual edit
    const certNoY = height * 0.94; // Bottom left area
    const certNoX = width * 0.08;

    console.log(`[Certificate Generator] Rendering "${name}" at Y=${nameY}, Date at Y=${dateY}`);

    const svgOverlay = `
      <svg width="${width}" height="${height}">
        <text 
          x="${width / 2}" 
          y="${nameY}" 
          font-family="Arial, Helvetica, sans-serif" 
          font-weight="bold" 
          font-size="64px" 
          fill="#000000" 
          text-anchor="middle"
        >${name.toUpperCase()}</text>
        <text 
          x="${width / 2}" 
          y="${dateY}" 
          font-family="Arial, Helvetica, sans-serif" 
          font-weight="bold" 
          font-size="32px" 
          fill="#1e293b" 
          text-anchor="middle"
        >${date}</text>
        <text 
          x="${certNoX}" 
          y="${certNoY}" 
          font-family="Arial, Helvetica, sans-serif" 
          font-size="16px" 
          fill="#64748b"
        >CERT NO. ${certNo}</text>
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

// Debug route for testing certificate positioning
app.get('/api/debug/certificate', async (req, res) => {
  const name = (req.query.name as string) || "GIDEON WANG";
  const dateStr = (req.query.date as string) || "30 April 2026";
  
  const customNameY = req.query.nameY ? parseFloat(req.query.nameY as string) : undefined;
  const customDateY = req.query.dateY ? parseFloat(req.query.dateY as string) : undefined;

  console.log(`[Debug Certificate] START generation for: "${name}"`);
  console.log(`[Debug Certificate] Params: nameY=${customNameY}, dateY=${customDateY}`);

  try {
    console.log(`[Debug Certificate] Fetching template from: ${templateUrl}`);
    const response = await fetch(templateUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
    }

    const templateBuffer = Buffer.from(await response.arrayBuffer());
    console.log(`[Debug Certificate] Template fetched successfully, size: ${templateBuffer.length} bytes`);
    
    sharp.cache(false);

    const width = 848;
    const height = 1200;
    
    const nameY = customNameY !== undefined ? height * customNameY : height * 0.35;
    const dateY = customDateY !== undefined ? height * customDateY : height * 0.75;
    const certNoY = height * 0.94;
    const certNoX = width * 0.08;

    console.log(`[Debug Certificate] Rendering SVG overlay with NameY=${nameY}, DateY=${dateY}`);

    const svgOverlay = `
      <svg width="${width}" height="${height}">
        <!-- Debug border -->
        <rect width="100%" height="100%" fill="none" stroke="#FF0000" stroke-width="4"/>
        <text 
          x="${width / 2}" 
          y="${nameY}" 
          font-family="Arial, Helvetica, sans-serif" 
          font-weight="bold" 
          font-size="72px" 
          fill="#FF0000" 
          text-anchor="middle"
        >${name}</text>
        <text 
          x="${width / 2}" 
          y="${dateY}" 
          font-family="Arial, Helvetica, sans-serif" 
          font-weight="bold" 
          font-size="36px" 
          fill="#FF0000" 
          text-anchor="middle"
        >${dateStr}</text>
        <text 
          x="${certNoX}" 
          y="${certNoY}" 
          font-family="Arial, Helvetica, sans-serif" 
          font-size="16px" 
          fill="#FF0000"
        >CERT NO. STAC/CYB/2026/DEBUG</text>
      </svg>
    `;

    console.log(`[Debug Certificate] Compositing with Sharp...`);
    const finalBuffer = await sharp(templateBuffer)
      .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
      .png()
      .toBuffer();

    console.log(`[Debug Certificate] DONE, sending PNG buffer (${finalBuffer.length} bytes)`);
    res.set('Content-Type', 'image/png');
    res.send(finalBuffer);
  } catch (error) {
    console.error('[Debug Certificate] ERROR:', error);
    res.status(500).json({ 
      error: 'Design tool failed', 
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

app.post(['/api/registration', '/api/registration/:userId'], async (req, res) => {
    const profile = req.body;
    console.log('[Registration] Incoming profile:', JSON.stringify(profile, null, 2));
    
    const tempUid = req.params.userId || profile?.uid;
    const cleanEmail = profile.email?.trim().toLowerCase();
    const cleanPhone = profile.phone?.trim();
    
    try {
      if (!profile || (!cleanEmail && !cleanPhone)) {
        console.warn('[Registration] Missing email or phone');
        return res.status(400).json({ error: 'Email or Phone required' });
      }

      let query: any = { $or: [] };
      if (cleanEmail) query.$or.push({ email: cleanEmail });
      if (cleanPhone) query.$or.push({ phone: cleanPhone });
      
      console.log(`[Registration] Search query for identity: ${JSON.stringify(query)}`);
      let existingUser = await User.findOne(query);

      const isNewRegistration = !existingUser;
      
      // CRITICAL: The user's UID must ALWAYS be their phone number if available
      // This ensures consistency across devices and sessions.
      const finalUid = cleanPhone || (existingUser ? (existingUser.phone || existingUser.uid) : (tempUid || `u_${Math.random().toString(36).substring(2, 11)}`));
      
      console.log(`[Registration] Identity resolved: phone=${cleanPhone}, existing=${existingUser?.uid}, final=${finalUid}`);
      
      const updateData = {
        ...profile,
        uid: finalUid,
        email: cleanEmail,
        phone: cleanPhone,
        updatedAt: new Date()
      };
      delete updateData._id;

      // Update existing user or create new one with finalUid as key
      const savedUser = await User.findOneAndUpdate(
        { $or: [{ uid: finalUid }, { phone: cleanPhone }, { email: cleanEmail }] },
        { $set: updateData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      
      console.log(`[Registration] DB Record Saved: ${savedUser.uid} (ID: ${savedUser._id})`);
      
      if (isNewRegistration) {
        console.log(`[Registration] Attempting to send welcome email to: "${cleanEmail}"`);
        if (cleanEmail) {
          const welcomeMessage = `Welcome to the STAC Marine Assessment!\n\nThank you for registering. You can now proceed to take your compliance assessment.\n\nCandidate Details:\nName: ${profile.name}\nEmail: ${cleanEmail}\nPhone: ${cleanPhone}\n\nGood luck!`;
          
          // Sending welcome email to the user
          try {
            await sendEmail(cleanEmail, 'Registration Successful - STAC Marine Assessment', welcomeMessage, [], "support@stacmarine.com", "STAC Marine Support");
            console.log(`[Registration] SUCCESS: Welcome email sent to ${cleanEmail}`);
          } catch (err) {
            console.error(`[Registration] ERROR: Welcome email FAILED for ${cleanEmail}:`, err);
          }
        } else {
          console.warn('[Registration] Skip email: cleanEmail is empty');
        }
      } else {
        console.log('[Registration] Welcome email skipped: Not a new registration');
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
    let user = await User.findOne({
      $or: [
        { email: id.toLowerCase() },
        { phone: id }
      ]
    });
    
    if (user) {
      // Ensure uid matches phone for returning users if phone exists
      if (user.phone && user.uid !== user.phone) {
        console.log(`[Login] Correcting UID from ${user.uid} to phone number ${user.phone}`);
        user = await User.findOneAndUpdate(
          { _id: user._id },
          { $set: { uid: user.phone } },
          { new: true }
        );
      }
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
    const attemptData = req.body;
    if (attemptData.userId) {
      attemptData.userId = attemptData.userId.trim();
    }
    console.log(`[Attempt] Saving new attempt for userId: ${attemptData.userId}, score: ${attemptData.score}/${attemptData.totalQuestions}`);
    const attempt = new Attempt(attemptData);
    await attempt.save();
    console.log(`[Attempt] Saved successfully, _id: ${attempt._id}`);
    
    if (attempt.percentage >= 80) {
      const user = await User.findOne({ uid: attempt.userId });
      if (user?.email) {
        const passMessage = `Congratulations ${user.name}!\n\nYou have passed the STAC Marine Assessment with ${attempt.percentage}%.\n\nPlease find your official certificate attached to this email.\n\nBest regards,\nThe STAC Marine Team`;
        
        const dateStr = new Date(attempt.timestamp).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });

        try {
          const buffer = await generateCertificateBuffer(user.name, dateStr);
          await sendEmail(
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
          console.log(`[Quiz] Pass email with certificate sent to ${user.email}`);
        } catch (err) {
          console.error(`[Quiz] Pass email/cert FAILED for ${user.email}:`, err);
        }
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
  const userId = (req.params.userId || '').trim();
  console.log(`[Attempt] Fetching history for userId: "${userId}"`);
  try {
    const attempts = await Attempt.find({ userId }).sort({ timestamp: -1 });
    console.log(`[Attempt] Found ${attempts.length} attempts for "${userId}"`);
    res.json(attempts);
  } catch (error) {
    console.error(`[Attempt] ERROR fetching history for "${userId}":`, error);
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



*/


