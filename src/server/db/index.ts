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
  _mongoClient?: MongoClient;
};

const client = globalForDb._mongoClient ?? createMongoClient();
if (process.env.NODE_ENV !== "production") globalForDb._mongoClient = client;

// default to database "main"
export const db = client.db("main");
