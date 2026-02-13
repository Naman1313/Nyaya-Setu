import express from "express";
import axios from "axios";
import crypto from "crypto";
import multer from "multer";
import Evidence from "../models/evidence.js";

const router = express.Router();

// Multer for temporary file upload
const upload = multer({ storage: multer.memoryStorage() });

/* --------------------------------------------------------
   Helper: Compute SHA-256 Hash
-------------------------------------------------------- */
function computeHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/* --------------------------------------------------------
   ROUTE 1: VERIFY EVIDENCE (Check if tampered)
-------------------------------------------------------- */
router.post("/verify", upload.single("evidenceFile"), async (req, res) => {
  try {
    const { caseId } = req.body;

    if (!req.file) {
      return res.render("verify", {
        error: "No file uploaded.",
      });
    }

    const uploadedFileBuffer = req.file.buffer;
    const uploadedFileHash = computeHash(uploadedFileBuffer);

    const evidence = await Evidence.findOne({ caseId });

    if (!evidence) {
      return res.render("verify", {
        error: "Case not found.",
      });
    }

    // Compare with blockchain hash stored earlier
    const originalHash = evidence.blockchainHash;

    if (uploadedFileHash !== originalHash) {
      return res.render("verify", {
        tampered: true,
        caseId: evidence.caseId,
        expectedHash: originalHash,
        gotHash: uploadedFileHash,
      });
    }

    // If matched
    return res.render("verify", {
      tampered: false,
      message: "Evidence is Authentic",
    });

  } catch (error) {
    console.error(error);
    res.render("verify", {
      error: "Error verifying evidence",
    });
  }
});

/* --------------------------------------------------------
   ROUTE 2: FETCH ORIGINAL GOLDEN COPY FROM IPFS
-------------------------------------------------------- */
router.get("/fetch-original/:caseId", async (req, res) => {
  try {
    const { caseId } = req.params;

    const evidence = await Evidence.findOne({ caseId });

    if (!evidence) {
      return res.status(404).json({ error: "Case not found" });
    }

    const cid = evidence.ipfsCID;
    const blockchainHash = evidence.blockchainHash;

    const gatewayURL = `https://gateway.pinata.cloud/ipfs/${cid}`;

    // Fetch original file from IPFS
    const response = await axios.get(gatewayURL, {
      responseType: "arraybuffer",
    });

    const originalBuffer = Buffer.from(response.data);
    const goldenCopyHash = computeHash(originalBuffer);

    const isAuthentic = goldenCopyHash === blockchainHash;

    return res.json({
      message: "Golden Copy Retrieved",
      authentic: isAuthentic,
      blockchainHash,
      goldenCopyHash,
      cid,
      fileBase64: originalBuffer.toString("base64"),
    });

  } catch (error) {
    console.error("Error fetching Golden Copy:", error);
    res.status(500).json({
      error: "Error retrieving original file from IPFS",
    });
  }
});

export default router;