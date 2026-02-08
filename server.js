import express from 'express';
import bodyParser from 'body-parser';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import pinataSDK from '@pinata/sdk';
import mongoose from 'mongoose';
import Evidence from './models/evidence.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const upload = multer({ dest: path.join(__dirname, 'uploads') });

// ----- Pinata Setup -----
const pinata = new pinataSDK(
  process.env.PINATA_API_KEY,
  process.env.PINATA_API_SECRET
);

// ----- Express Setup -----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ----- Database Connection Logic -----
const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/nyaya-setu");
    console.log("✅ Connected to MongoDB: nyaya-setu");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
};

// ----- Routes -----

app.get('/', (req, res) => {
  res.render('index');
});

// 1. Repository: Fetching by DB ID automatically happens in the background
app.get('/evidence', async (req, res) => {
  try {
    const allEvidences = await Evidence.find({});
    res.render('show', { evidences: allEvidences });
  } catch (err) {
    res.status(500).send("Error fetching repository.");
  }
});

// 2. Log Evidence
app.post('/evidence', upload.single('file'), async (req, res) => {
  try {
    const { caseId, officerId } = req.body;
    if (!req.file) return res.status(400).send('File not uploaded');

    const fileBuffer = fs.readFileSync(req.file.path);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const readableStreamForFile = fs.createReadStream(req.file.path);
    const options = {
      pinataMetadata: { name: req.file.originalname, keyvalues: { caseId, officerId } },
      pinataOptions: { cidVersion: 1 }
    };

    const result = await pinata.pinFileToIPFS(readableStreamForFile, options);
    
    // SAVE TO DB: MongoDB generates a unique _id automatically
    await Evidence.create({
      caseId,
      officerId,
      fileName: req.file.originalname,
      fileHash,
      ipfsCID: result.IpfsHash,
      blockchainTxHash: '0x' + crypto.randomBytes(20).toString('hex'),
    });

    fs.unlinkSync(req.file.path);
    res.redirect('/evidence');
  } catch (err) {
    console.error(err);
    res.status(500).send('Upload Error');
  }
});

// 3. Verify Page (GET) - Accept an optional ID from the query string
app.get('/verify', async (req, res) => {
  const { id } = req.query;
  let evidence = null;
  
  // If an ID is passed (e.g., from the 'Show' page), pre-fetch the case info
  if (id && mongoose.Types.ObjectId.isValid(id)) {
    evidence = await Evidence.findById(id);
  }
  
  res.render('verify', { result: null, preFetched: evidence });
});

// 4. Verify Integrity (POST) - Verify using the MongoDB _id
// This route handles both POST /verify AND POST /verify/:id
app.post(['/verify', '/verify/:id'], upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { caseId } = req.body;

    if (!req.file) return res.status(400).send('No file provided.');

    // 1. Generate hash of the uploaded file
    const fileBuffer = fs.readFileSync(req.file.path);
    const currentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 2. Lookup logic: Try ID first, then CaseID
    let originalRecord;
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      originalRecord = await Evidence.findById(id);
    } else {
      originalRecord = await Evidence.findOne({ caseId: caseId });
    }

    // 3. Compare
    const isValid = (originalRecord && originalRecord.fileHash === currentHash);
    
    // Clean up
    fs.unlinkSync(req.file.path);

    // 4. Render back to the same page with results
    res.render('verify', { 
      result: { 
        valid: isValid, 
        currentHash: currentHash,
        originalHash: originalRecord ? originalRecord.fileHash : null
      },
      preFetched: originalRecord || { caseId } // Keep the caseId in the input field
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Verification Error");
  }
});

// 5. Delete Evidence (Using ID)
app.post('/evidence/delete/:id', async (req, res) => {
  try {
    await Evidence.findByIdAndDelete(req.params.id);
    res.redirect('/evidence');
  } catch (err) {
    res.status(500).send("Delete Error");
  }
});

// ----- Start -----
const start = async () => {
  await connectDB();
  app.listen(3000, () => console.log(`🚀 Server on http://localhost:3000`));
};

start();