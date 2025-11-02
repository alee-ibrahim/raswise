import { env } from "$env/dynamic/private";
import { MongoClient } from "mongodb";

// During build time, env.MONGO_URI might not be available
// Only connect at runtime when the environment variable is present
const mongoUri = env.MONGO_URI || "mongodb://localhost:27017/raswise";

const client = new MongoClient(mongoUri);

// Only connect if we're not in build mode
let connectionPromise: Promise<void> | null = null;
if (env.MONGO_URI) {
	connectionPromise = client.connect();
}

// Export a function to ensure connection before use
export async function ensureConnected() {
	if (connectionPromise) {
		await connectionPromise;
	}
}

export default client.db("raswise");