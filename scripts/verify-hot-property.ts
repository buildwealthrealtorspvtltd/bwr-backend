
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Property } from "../src/modules/properties/property.model";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "";

async function verify() {
    try {
        if (!MONGO_URI) {
            throw new Error("MONGO_URI is not defined");
        }
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        // 1. Find a random property and set isHot = true (simulating Admin action)
        // We'll try to find one that ISN'T hot first to toggle it.
        const randomProp = await Property.findOne({ isHot: { $ne: true } });

        if (randomProp) {
            console.log(`Setting property '${randomProp.title}' (${randomProp._id}) to HOT`);
            randomProp.isHot = true;
            await randomProp.save();
        } else {
            console.log("No non-hot properties found to update, or all are already hot.");
        }

        // 2. Query properties with the sort
        console.log("\nQuerying properties with { isHot: -1, createdAt: -1 } sort...");
        const properties = await Property.find({})
            .sort({ isHot: -1, createdAt: -1 })
            .limit(5)
            .select("title isHot");

        console.log("\nTop 5 Properties:");
        properties.forEach(p => {
            console.log(`- [${p.isHot ? "HOT" : "   "}] ${p.title}`);
        });

        await mongoose.disconnect();
        console.log("\nVerification Complete");

    } catch (error) {
        console.error("Verification failed:", error);
        process.exit(1);
    }
}

verify();
