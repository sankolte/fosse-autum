require("dotenv").config();
const sdk = require("node-appwrite");

const client = new sdk.Client();
client
  .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
  .setProject(process.env.APPWRITE_PROJECT_ID || "osdag-secure-login")
  .setKey(process.env.APPWRITE_API_KEY || "placeholder_secret_key");

const account = new sdk.Account(client);
const databases = new sdk.Databases(client);
const storage = new sdk.Storage(client);
const users = new sdk.Users(client);

const createSessionClient = (sessionSecret) => {
  const sessionClient = new sdk.Client();
  sessionClient
    .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
    .setProject(process.env.APPWRITE_PROJECT_ID || "osdag-secure-login");
  if (sessionSecret) {
    sessionClient.setSession(sessionSecret);
  }
  return sessionClient;
};

module.exports = {
  client,
  account,
  databases,
  storage,
  users,
  createSessionClient,
  ID: sdk.ID,
  Permission: sdk.Permission,
  Role: sdk.Role,
  Query: sdk.Query,
  InputFile: sdk.InputFile,
  DATABASE_ID: process.env.DATABASE_ID || "osdag-db",
  FILES_COLLECTION_ID: process.env.FILES_COLLECTION_ID || "files",
  STORAGE_BUCKET_ID: process.env.STORAGE_BUCKET_ID || "user-files",
};
