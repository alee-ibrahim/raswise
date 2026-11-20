import { MONGO_URI } from "$app/env/private";
import { MongoClient } from "mongodb";

// During build time, MONGO_URI might not be available
// Only connect at runtime when the environment variable is present
const mongoUri = MONGO_URI || "mongodb://localhost:27017/raswise";

const client = new MongoClient(mongoUri);

// Only connect if we're not in build mode
let connectionPromise: Promise<MongoClient> | null = null;
if (MONGO_URI) {
	connectionPromise = client.connect();
}

// Export a function to ensure connection before use
export async function ensureConnected() {
	if (connectionPromise) {
		await connectionPromise;
	}
}

export default client.db("raswise");