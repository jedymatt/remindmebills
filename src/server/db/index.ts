import {
  MongoClient,
  ServerApiVersion,
  type MongoClientOptions,
} from "mongodb";
import { env } from "~/env";

const uri = env.MONGODB_URI;
const options: MongoClientOptions = {
  serverApi: {
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

export const dbClient = (globalForDb._mongoClient ?? createMongoClient());

// default to database "main"
export const db = dbClient.db("main");

if (process.env.NODE_ENV !== "production") globalForDb._mongoClient = dbClient;
