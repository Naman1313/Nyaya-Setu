import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pinataSDK from '@pinata/sdk';
import AWS from 'aws-sdk'; 
import Evidence from '../models/evidence.js';
import { Readable } from 'stream';
import { isloggedin } from '../middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// 1. Setup Temporary Upload Storage
const upload = multer({ dest: path.join(__dirname, '../uploads') });

// 2. Configure IPFS (Layer 1)
const pinata = new pinataSDK(
  process.env.PINATA_API_KEY,
  process.env.PINATA_API_SECRET
);

// 3. Configure AWS S3 (Layer 2)
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// 4. Configure Encryption (Layer 3)
const ENCRYPTION_KEY = process.env.MASTER_ENCRYPTION_KEY; 
const IV_LENGTH = 16; // AES standard

// --- HELPER: Encrypt File for Vault ---
function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

// --- HELPER: Decrypt File from Vault ---
function decryptBuffer(encryptedBuffer) {
  const iv = encryptedBuffer.subarray(0, IV_LENGTH);
  const encryptedText = encryptedBuffer.subarray(IV_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return decrypted;
}

// --- HELPER: Process and store a single file across all 3 layers ---
async function processSingleFile(file, caseId, officerId) {
  const fileBuffer = fs.readFileSync(file.path);
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  // --- LAYER 1: IPFS Upload ---
  console.log(`  [${file.originalname}] Uploading to Layer 1 (IPFS)...`);
  const readableStream = fs.createReadStream(file.path);
  const pinataOptions = {
    pinataMetadata: {
      name: file.originalname,
      keyvalues: { caseId, officerId }
    },
    pinataOptions: { cidVersion: 1 }
  };
  const pinataResult = await pinata.pinFileToIPFS(readableStream, pinataOptions);
  const ipfsCID = pinataResult.IpfsHash;

  // --- LAYER 2: AWS S3 Upload ---
  console.log(`  [${file.originalname}] Uploading to Layer 2 (AWS S3)...`);
  const s3Key = `${caseId}/${Date.now()}_${file.originalname}`;

  const retentionDate = new Date();
  retentionDate.setFullYear(retentionDate.getFullYear() + 10);

  const s3Params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: file.mimetype,
    // ObjectLockMode: 'COMPLIANCE',
    // ObjectLockRetainUntilDate: retentionDate
  };

  try {
    await s3.upload(s3Params).promise();
  } catch (s3Err) {
    console.error(`  [${file.originalname}] AWS Upload Error:`, s3Err.message);
  }

  // --- LAYER 3: Local Encrypted Vault ---
  console.log(`  [${file.originalname}] Writing to Layer 3 (Local Encrypted Vault)...`);
  const encryptedData = encryptBuffer(fileBuffer);
  const vaultFilename = `${caseId}_${Date.now()}_${file.originalname}.enc`;
  const localPath = path.join(__dirname, '../vault', vaultFilename);
  fs.writeFileSync(localPath, encryptedData.toString('base64'));

  // --- SAVE TO DATABASE ---
  const newEvidence = await Evidence.create({
    caseId,
    officerId,
    fileName: file.originalname,
    fileHash,
    ipfsCID,
    awsKey: s3Key,
    localEncryptedPath: localPath,
    originalFileType: file.mimetype,
    blockchainTxHash: 'PENDING_SIGNATURE'
  });

  // Clean up temp file
  fs.unlinkSync(file.path);

  console.log(`  ✅ [${file.originalname}] Secured across 3 layers.`);

  return {
    dbId: newEvidence._id,
    fileName: file.originalname,
    fileHash,
  };
}

// --- ROUTE: Show Evidence Page ---
router.get('/evidence', isloggedin, async (req, res) => {
  try {
    const allEvidence = await Evidence.find({});

    res.render('show', { evidences: allEvidence });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Could not load evidence.");
  }
});

// --- ROUTE: The 3-Layer Multi-File Upload ---
// Accepts up to 20 files at once via the field name "files"
router.post('/evidence/upload-api', isloggedin, upload.array('files', 20), async (req, res) => {
  try {
    const { caseId, officerId } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files found' });
    }

    console.log(`🔒 Starting Multi-Layer Storage for Case: ${caseId} | Files: ${req.files.length}`);

    const results = [];
    const errors = [];

    // Process each file one by one
    for (const file of req.files) {
      try {
        console.log(`\n📄 Processing: ${file.originalname}`);
        const result = await processSingleFile(file, caseId, officerId);
        results.push(result);
      } catch (fileErr) {
        console.error(`❌ Failed to process ${file.originalname}:`, fileErr.message);
        errors.push({ fileName: file.originalname, error: fileErr.message });

        // Clean up temp file if it still exists
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    console.log(`\n✅ Done. ${results.length} succeeded, ${errors.length} failed.`);

    res.json({
      success: true,
      totalUploaded: results.length,
      totalFailed: errors.length,
      caseId,
      uploaded: results,
      ...(errors.length > 0 && { errors }),
    });

  } catch (error) {
    console.error("Upload failed:", error);
    res.status(500).json({ success: false, error: 'Upload Failed: ' + error.message });
  }
});

// --- ROUTE: Confirm Blockchain Transaction ---
// Accepts either a single dbId or an array of dbIds with their txHashes
router.post('/evidence/confirm-tx', isloggedin, async (req, res) => {
  try {
    const { transactions } = req.body;
    // transactions: [{ dbId, txHash }, ...]

    if (!Array.isArray(transactions) || transactions.length === 0) {
      // Fallback: support legacy single transaction format
      const { dbId, txHash } = req.body;
      await Evidence.findByIdAndUpdate(dbId, { blockchainTxHash: txHash });
      return res.json({ success: true });
    }

    const updates = transactions.map(({ dbId, txHash }) =>
      Evidence.findByIdAndUpdate(dbId, { blockchainTxHash: txHash })
    );
    await Promise.all(updates);

    res.json({ success: true, updated: transactions.length });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// --- ROUTE: Retrieve Evidence (The Safety Net) ---
router.get('/evidence/retrieve/:id', isloggedin, async (req, res) => {
  try {
    const evidence = await Evidence.findById(req.params.id);
    if (!evidence) return res.status(404).send("Not found.");

    let fileBuffer = null;
    console.log(`🔍 Retrieving Evidence for ${evidence.caseId}...`);

    // --- ATTEMPT 1: Try IPFS ---
    try {
      console.log("... Attempting Layer 1 (IPFS)");
      const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${evidence.ipfsCID}`;
      const response = await fetch(gatewayUrl);
      if (!response.ok) throw new Error("IPFS Gateway Error");
      const arrayBuffer = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      console.log("✔ Retrieved from IPFS");
    } catch (ipfsError) {
      console.warn("⚠ Layer 1 Failed. Moving to Layer 2...");
    }

    // --- ATTEMPT 2: Try AWS S3 ---
    if (!fileBuffer) {
      try {
        console.log("... Attempting Layer 2 (AWS S3)");
        const s3Params = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: evidence.awsKey
        };
        const data = await s3.getObject(s3Params).promise();
        fileBuffer = data.Body;
        console.log("✔ Retrieved from AWS S3");
      } catch (s3Error) {
        console.warn("⚠ Layer 2 Failed. Moving to Layer 3...");
      }
    }

    // --- ATTEMPT 3: Try Local Vault ---
    if (!fileBuffer) {
      try {
        console.log("... Attempting Layer 3 (Local Vault)");
        if (fs.existsSync(evidence.localEncryptedPath)) {
          const encryptedBase64 = fs.readFileSync(evidence.localEncryptedPath, 'utf8');
          const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
          fileBuffer = decryptBuffer(encryptedBuffer);
          console.log("✔ Retrieved & Decrypted from Local Vault");
        } else {
          throw new Error("Local file missing");
        }
      } catch (localError) {
        console.error("❌ ALL LAYERS FAILED.");
        return res.status(500).send("CRITICAL ERROR: Evidence cannot be retrieved from any layer.");
      }
    }

    if (fileBuffer) {
      res.setHeader("Content-Disposition", `attachment; filename="${evidence.fileName}"`);
      res.setHeader("Content-Type", evidence.originalFileType);
      res.send(fileBuffer);
    }

  } catch (error) {
    console.error("Retrieval Error:", error);
    res.status(500).send("Error retrieving file.");
  }
});

export default router;