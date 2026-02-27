import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Evidence from "../models/evidence.js";
import evidencedata from "./data.js";
import User from "../models/user.js";

// 1. Get the current directory of this script (Nyaya-Setu/init/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Point to the .env file in the PARENT directory (Nyaya-Setu/)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function seedAll() {
  const DB_URI = process.env.MONGO_URI;

  if (!DB_URI) {
    console.error("❌ MONGO_URI is not defined in your .env file!");
    process.exit(1); // exit immediately if URI missing
  }

  try {
    // ---------------- Connect to MongoDB ----------------
    await mongoose.connect(DB_URI); // ✅ Remove deprecated options
    console.log("✅ Connected to MongoDB");

    // ---------------- Seed Evidence ----------------
    await Evidence.deleteMany({});
    const docs = await Evidence.insertMany(evidencedata);
    console.log(`✅ ${docs.length} Evidence records inserted.`);

    // ---------------- Seed Users ----------------
    const users = [
      { username: "police1", email: "police1@example.com", role: "police", officerId: "OFF-101", password: "police123" },
      { username: "police2", email: "police2@example.com", role: "police", officerId: "OFF-102", password: "police234" },
      { username: "judge1", email: "judge1@example.com", role: "judge", judgeId: "JDG-101", password: "judge123" },
      { username: "judge2", email: "judge2@example.com", role: "judge", judgeId: "JDG-102", password: "judge234" }
    ];

    for (let u of users) {
      const exists = await User.findOne({ username: u.username });
      if (!exists) {
        await User.register(
          new User({
            username: u.username,
            email: u.email,
            role: u.role,
            officerId: u.officerId,
            judgeId: u.judgeId
          }),
          u.password
        );
        console.log(`✅ Created user: ${u.username}`);
      } else {
        console.log(`ℹ️ User already exists: ${u.username}`);
      }
    }

    console.log("🎉 Seeding complete!");
  } catch (err) {
    console.error("❌ Seeding error:", err);
  } finally {
    await mongoose.connection.close();
    console.log("🔒 MongoDB connection closed");
  }
}

seedAll();