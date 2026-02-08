import mongoose from "mongoose";
import Evidence from "../models/evidence.js";
import evidencedata from "./data.js";

async function main() {
    try {
        await mongoose.connect("mongodb://127.0.0.1:27017/nyaya-setu");
        
        // Clear existing data
        await Evidence.deleteMany({});
        
        // Insert seed data
        const docs = await Evidence.insertMany(evidencedata);
        console.log(`${docs.length} records inserted successfully.`);
        
    } catch (err) {
        console.error("Error during seeding:", err);
    } finally {
        // Close connection so the script finishes
        await mongoose.connection.close();
    }
}

main();