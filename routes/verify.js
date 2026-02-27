import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import mongoose from 'mongoose';
import Evidence from '../models/evidence.js';
import { isJudge, isloggedin } from "../middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Changed: upload.array to accept multiple files (up to 20)
const upload = multer({ dest: path.join(__dirname, '../uploads') });

// GET: unchanged — still uses ?id= query param for pre-fill
router.get('/verify', isloggedin, isJudge, async (req, res) => {
  const { id } = req.query;
  let preFetchedData = null;

  if (id && mongoose.Types.ObjectId.isValid(id)) {
    preFetchedData = await Evidence.findById(id);
  }

  res.render('verify', { result: null, results: null, preFetched: preFetchedData });
});

// POST: now handles multiple files, returns results array
router.post(['/verify', '/verify/:id'], isloggedin, isJudge, upload.array('files', 20), async (req, res) => {
  try {
    const { id } = req.params;
    const { caseId } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).send('Please upload at least one file to verify.');
    }

    const results = [];

    for (const file of req.files) {
      try {
        const fileBuffer = fs.readFileSync(file.path);
        const currentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Same lookup logic as your original — by id if available, else by caseId + fileName
        let originalRecord;
        if (id && mongoose.Types.ObjectId.isValid(id)) {
          originalRecord = await Evidence.findById(id);
        } else {
          originalRecord = await Evidence.findOne({
            caseId: caseId,
            fileName: file.originalname
          });
        }

        const isValid = originalRecord && originalRecord.fileHash === currentHash;

        fs.unlinkSync(file.path);

        results.push({
          fileName: file.originalname,
          valid: isValid,
          currentHash,
          originalHash: originalRecord ? originalRecord.fileHash : null,
          evidenceId: originalRecord ? originalRecord._id.toString() : null,
          error: !originalRecord ? 'No DB record found for this file.' : null
        });

      } catch (fileErr) {
        // Clean up temp file if still around
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

        results.push({
          fileName: file.originalname,
          valid: false,
          currentHash: '',
          originalHash: null,
          evidenceId: null,
          error: fileErr.message
        });
      }
    }

    // preFetched: use the DB record from first matched result, or fall back to { caseId }
    const firstMatch = results.find(r => r.evidenceId);
    const preFetched = firstMatch
      ? await Evidence.findById(firstMatch.evidenceId)
      : { caseId };

    res.render('verify', {
      result: null,     // kept so existing ejs fallback block doesn't crash
      results,
      preFetched
    });

  } catch (error) {
    console.error("Verification Error:", error);
    res.status(500).send("Verification failed.");
  }
});

export default router;