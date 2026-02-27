# NYAYA-SETU ⚖️

> **The Future of Digital Evidence Management.**
> A Blockchain-powered, Sci-Fi themed, tamper-proof system for the Indian Judiciary.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Deploy](https://img.shields.io/badge/deploy-on%20render-46E3B7?logo=render&logoColor=white)](https://nyaya-setu-kjga.onrender.com/)

---

## 🌌 OVERVIEW

Nyaya-Setu is a next-generation digital evidence management platform. It combines the immutability of **Blockchain** with the decentralized storage of **IPFS** to create an unalterable chain of custody for digital evidence.

Wrapped in a futuristic **Sci-Fi / Cyberpunk interface**, it simplifies complex cryptographic operations for Police Officers and Judges.

### Key Features

- **🛡️ Tamper-Proof**: Evidence hashes are stored on the Ethereum Blockchain.
- **💾 3-Layer Redundant Storage**: Files are secured across IPFS (via Pinata), AWS S3, and a local AES-256 encrypted vault — ensuring zero single point of failure.
- **🔍 Instant Verification**: Verify any file's integrity against its immutable blockchain record in milliseconds.
- **🪙 Golden Copy**: Automatically retrieve the original, authentic file from the best available storage layer.
- **🔐 AES-256 Encryption**: All locally stored evidence is encrypted at rest using military-grade AES-256-CBC encryption.
- **🕐 10-Year Retention**: AWS S3 Object Lock support for court-compliant evidence retention.
- **👽 Sci-Fi UI**: A visually stunning, dark-mode interface with glassmorphism and animations.
- **☁️ Vercel Ready**: Optimized for serverless deployment.

---

## 🛠️ PROJECT STRUCTURE

```
Nyaya-Setu/
├── init/               # Database Seeding Scripts
│   ├── seed.js         # Seeds Evidence & User records
│   └── data.js         # Sample Evidence data
├── models/             # Database Schemas (MongoDB)
│   ├── evidence.js     # Evidence Schema
│   └── user.js         # User Schema (Police / Judge)
├── public/             # Static Assets (CSS, JS, Images)
├── routes/             # Simple, Modular Logic
│   ├── home.js         # Landing Page & Dashboard
│   ├── evidence.js     # Upload, List, Retrieve & Encrypt Evidence
│   └── verify.js       # File Verification Logic
├── vault/              # Local AES-256 Encrypted Evidence Vault
├── uploads/            # Temporary Multer Upload Directory
├── views/              # Sci-Fi EJS Templates
├── middleware.js        # Auth Middleware (isloggedin)
├── server.js           # Main Server Entry Point
└── vercel.json         # Deployment Configuration
```

---

## 🚀 GETTING STARTED

### Prerequisites

- Node.js (v18+)
- MongoDB Account (Atlas or Local)
- Pinata Account (for IPFS)
- AWS Account with an S3 Bucket (for Layer 2 storage)
- MetaMask Browser Extension

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/rohanmalik352/Nyaya-Setu.git
   cd Nyaya-Setu
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file in the root directory:
   ```env
   MONGO_URI=your_mongodb_connection_string

   # IPFS (Layer 1)
   PINATA_API_KEY=your_pinata_api_key
   PINATA_API_SECRET=your_pinata_secret_key

   # AWS S3 (Layer 2)
   AWS_ACCESS_KEY_ID=your_aws_access_key_id
   AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
   AWS_REGION=your_aws_region
   AWS_BUCKET_NAME=your_s3_bucket_name

   # Encryption (Layer 3 - Local Vault)
   # Must be a 32-byte (256-bit) hex string
   MASTER_ENCRYPTION_KEY=your_32_byte_hex_encryption_key
   ```

4. **Create Required Directories**
   ```bash
   mkdir vault uploads
   ```

5. **Seed the Database** *(Optional — loads sample evidence & default users)*
   ```bash
   node init/seed.js
   ```
   This will create the following default accounts:

   | Username | Role   | Password   | ID      |
   |----------|--------|------------|---------|
   | police1  | Police | police123  | OFF-101 |
   | police2  | Police | police234  | OFF-102 |
   | judge1   | Judge  | judge123   | JDG-101 |
   | judge2   | Judge  | judge234   | JDG-102 |

   > ⚠️ Change these credentials immediately in any production deployment.

6. **Run Locally**
   ```bash
   npm start
   # Server runs on http://localhost:3000
   ```

---

## 🔒 3-LAYER STORAGE ARCHITECTURE

Every piece of evidence uploaded is automatically secured across three independent layers:

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Layer 1** | IPFS via Pinata | Decentralized, tamper-proof golden copy |
| **Layer 2** | AWS S3 | Scalable cloud backup with 10-year retention support |
| **Layer 3** | Local AES-256 Encrypted Vault | Air-gap fallback, encrypted at rest |

When retrieving evidence, the system automatically tries each layer in order and falls back to the next if unavailable — ensuring evidence is **always recoverable**.

---

## 🦊 METAMASK SETUP GUIDE

Nyaya-Setu uses **MetaMask** to sign transactions on the blockchain.

### Step 1: Install MetaMask
1. Go to [metamask.io](https://metamask.io/download/).
2. Install the extension for Chrome, Firefox, or Edge.

### Step 2: Create a Wallet
1. Click **"Create a new wallet"** and set a strong password.
2. **IMPORTANT**: Write down your **Secret Recovery Phrase** on paper and store it safely. Never share it with anyone.

### Step 3: Connect to Nyaya-Setu
1. Open Nyaya-Setu in your browser.
2. When you click **"+ Log New Evidence"**, MetaMask will pop up asking for permission.
3. Click **"Connect"** — you're now ready to secure evidence on the blockchain.

---

## 📖 USAGE GUIDE

### 1. Police Dashboard (Upload)
- Click **"+ Log New Evidence"**.
- Enter the `Case ID`, `Officer ID`, and select your file.
- Click **"Upload"** — the file is simultaneously stored across all 3 layers.
- **MetaMask** will pop up to sign the transaction. Confirm it to record the evidence hash permanently on the blockchain.

### 2. Evidence Repository
- View all logged evidence in a sleek, Sci-Fi grid.
- Click **"View Data"** to see the file on IPFS.
- Click **"Golden Copy"** to download the guaranteed original, retrieved from the best available storage layer.

### 3. Verification Portal
- Click **"Verify"** next to any evidence.
- Upload a suspect file.
- The system computes its SHA-256 hash and compares it against the Blockchain record.
- 🟢 **Green**: Evidence is Authentic.
- 🔴 **Red**: Evidence is Tampered. (You will be offered the "Golden Copy").

---

## ☁️ DEPLOYMENT (VERCEL)

1. Push your code to **GitHub**.
2. Import the repo in **Vercel**.
3. Add all Environment Variables from your `.env` file in the Vercel Dashboard.
4. Click **Deploy**.

> **Note**: The local encrypted vault (`/vault`) is not available in serverless environments like Vercel. For full 3-layer support in production, ensure AWS S3 is properly configured so Layer 2 serves as the reliable fallback.

---

## 👥 AUTHORS

- **Rohan Malik** — [@rohanmalik352](https://github.com/rohanmalik352)
- **Manvi** — [@Manvi100203](https://github.com/Manvi100203)
- **Harsh Panchal** — [@Harsh-Panchal-1](https://github.com/Harsh-Panchal-1)
- **Naman Chaudhary** — [@Naman1313](https://github.com/Naman1313)

---

## 📄 LICENSE

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

**Built for the Ministry of Law and Justice & Ministry of Home Affairs (MHA)**