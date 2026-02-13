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
import { Readable } from 'stream';

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
// Test Pinata Connection
pinata.testAuthentication().then((result) => {
  console.log("✅ Pinata connected successfully!");
  console.log(result);
}).catch((err) => {
  console.log("❌ Pinata Error: Check your .env keys!");
  console.log(err);
});

// ----- Express Setup -----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ----- Database Connection Logic -----
const connectDB = async () => {
  try {
    const dbURI = process.env.MONGO_URI;
    if (!dbURI) {
      console.error("❌ Error: MONGO_URI is missing in .env file!");
      process.exit(1);
    } else if (dbURI) {
      await mongoose.connect(dbURI);
      console.log("✅ Connected to MongoDB: nyaya-setu");
    }
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
};

// ----- Routes -----

app.get('/', (req, res) => {
  res.render('index.ejs');
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
// --- MODIFIED ROUTE 1: Upload to Pinata but DON'T redirect yet ---
// Returns JSON so the Frontend can start the MetaMask process
app.post('/evidence/upload-api', upload.single('file'), async (req, res) => {
  try {
    const { caseId, officerId } = req.body;
    if (!req.file) return res.status(400).json({ success: false, error: 'No file' });

    // 1. Hash locally
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 2. Upload to Pinata
    const readableStreamForFile = fs.createReadStream(req.file.path);
    const options = {
      pinataMetadata: { name: req.file.originalname, keyvalues: { caseId, officerId } },
      pinataOptions: { cidVersion: 1 }
    };
    const result = await pinata.pinFileToIPFS(readableStreamForFile, options);

    // 3. Create "Pending" Record in DB
    // We leave blockchainTxHash empty for now (or put 'PENDING')
    const mimeType = req.file.mimetype;
    const newEvidence = await Evidence.create({
      caseId,
      officerId,
      fileName: req.file.originalname,
      fileHash,
      ipfsCID: result.IpfsHash,
      blockchainTxHash: 'PENDING_SIGNATURE', // Wait for MetaMask
      originalFileType: mimeType,
    });

    // 4. Cleanup & Respond
    fs.unlinkSync(req.file.path);

    // Send critical data back to Frontend
    res.json({
      success: true,
      dbId: newEvidence._id,
      fileHash: fileHash,
      caseId: caseId
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Upload Failed' });
  }
});

// --- NEW ROUTE 2: Confirm Blockchain Transaction ---
// The frontend calls this AFTER the user signs with MetaMask
app.use(express.json()); // Ensure you can parse JSON bodies

app.post('/evidence/confirm-tx', async (req, res) => {
  try {
    const { dbId, txHash } = req.body;

    // Update the record with the REAL Transaction Hash
    await Evidence.findByIdAndUpdate(dbId, { blockchainTxHash: txHash });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
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

// 6. Retrieve Golden Copy from IPFS
app.get('/evidence/retrieve/:id', async (req, res) => {
  try {
    const evidence = await Evidence.findById(req.params.id);
    if (!evidence) return res.status(404).send("Evidence record not found.");

    const ipfsCID = evidence.ipfsCID;
    const fileName = evidence.fileName;

    // Create Pinata gateway URL (fast & reliable)
    const fileURL = `https://gateway.pinata.cloud/ipfs/${ipfsCID}`;

    // Fetch the file from the gateway
    const response = await fetch(fileURL);

    if (!response.ok) {
      return res.status(500).send("Failed to fetch file from IPFS");
    }

    // Set download headers
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/octet-stream");

    // Fix: Convert Web Stream (fetch) to Node Stream (Express)
    // Node.js 18+ fetch returns a Web ReadableStream, which doesn't have .pipe()
    // We must convert it using Readable.fromWeb()
    Readable.fromWeb(response.body).pipe(res);

  } catch (err) {
    console.error(err);
    return res.status(500).send("Cannot retrieve Golden Copy");
  }
});

// ----- Start -----
const start = async () => {
  await connectDB();
  app.listen(3000, () => console.log(`🚀 Server on http://localhost:3000`));
};

start();