// Appwrite Node SDK initialization
const sdk = require("node-appwrite");

const client = new sdk.Client();
client
  .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
  .setProject(process.env.APPWRITE_PROJECT_ID || "")
  .setKey(process.env.APPWRITE_API_KEY || "");

module.exports = client;
