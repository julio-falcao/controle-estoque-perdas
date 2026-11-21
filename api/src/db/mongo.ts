import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectMongo(url = env.MONGO_URL) {
  await mongoose.connect(url);
}

export async function disconnectMongo() {
  await mongoose.disconnect();
}
