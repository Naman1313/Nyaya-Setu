import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema({
  caseId: { type: String, required: true, unique: true },
  officerId: { type: String, required: true },
  fileName: { type: String, required: true },
  fileHash: { type: String, required: true }, // SHA-256 local hash
  ipfsCID: { type: String, required: true },  // Hash from IPFS
  blockchainTxHash: { type: String, required: true },
  originalFileType: { type: String }, // Tx Hash from Chain
  uploadedAt: { type: Date, default: Date.now }
});

const Evidence = mongoose.model('Evidence', evidenceSchema);

export default Evidence;