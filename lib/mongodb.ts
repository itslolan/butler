import { Collection, Db, MongoClient, MongoClientOptions } from 'mongodb';

const uri = process.env.MONGODB_URI;
const configuredDbName = process.env.MONGODB_DB;

type MongoCache = {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
  db: Db | null;
};

declare global {
  // eslint-disable-next-line no-var
  var _mongoCache: MongoCache | undefined;
}

const cached: MongoCache = global._mongoCache ?? {
  client: null,
  promise: null,
  db: null,
};

if (!global._mongoCache) {
  global._mongoCache = cached;
}

const options: MongoClientOptions = {
  maxPoolSize: 10,
};

async function createClient() {
  if (!cached.promise) {
    if (!uri) {
      throw new Error('Missing MONGODB_URI environment variable');
    }
    cached.promise = MongoClient.connect(uri, options);
  }
  cached.client = await cached.promise;
  return cached.client;
}

export async function getMongoClient(): Promise<MongoClient> {
  if (cached.client) {
    return cached.client;
  }
  return createClient();
}

export async function getDb(): Promise<Db> {
  if (cached.db) {
    return cached.db;
  }

  const client = await getMongoClient();
  const dbName =
    configuredDbName ||
    client.options.dbName ||
    (uri ? extractDatabaseName(uri) : undefined);

  if (!dbName) {
    throw new Error('Unable to determine database name from configuration');
  }

  cached.db = client.db(dbName);
  return cached.db;
}

export async function getCollection<TSchema>(collectionName: string): Promise<Collection<TSchema>> {
  const db = await getDb();
  return db.collection<TSchema>(collectionName);
}

function extractDatabaseName(connectionString: string): string | undefined {
  try {
    const normalized = connectionString.startsWith('mongodb+srv://')
      ? connectionString.replace('mongodb+srv://', 'mongodb://')
      : connectionString;
    const url = new URL(normalized);
    const pathname = url.pathname.replace(/^\//, '');
    return pathname || undefined;
  } catch {
    return undefined;
  }
}
