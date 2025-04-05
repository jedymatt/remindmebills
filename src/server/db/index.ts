/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// This approach is taken from https://github.com/vercel/next.js/tree/canary/examples/with-mongodb
import {
  MongoClient,
  ServerApiVersion,
  type MongoClientOptions,
} from "mongodb";

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;
const options: MongoClientOptions = {
  serverApi: {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
};

const createMongoClient = (): MongoClient => {
  return new MongoClient(uri, options);
};

const globalForDb = globalThis as unknown as {
  _mongoClient?: ReturnType<typeof createMongoClient>;
};

export const db = globalForDb._mongoClient ?? createMongoClient();

if (process.env.NODE_ENV !== "production") globalForDb._mongoClient = db;
