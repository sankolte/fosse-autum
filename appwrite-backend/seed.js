require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  users,
  databases,
  storage,
  ID,
  Permission,
  Role,
  InputFile,
  DATABASE_ID,
  FILES_COLLECTION_ID,
  STORAGE_BUCKET_ID,
} = require("./src/config/appwriteClient");

async function seedAppwrite() {
  console.log("Starting Appwrite Backend Seeding...");

  // 1. Ensure Database exists
  try {
    await databases.get(DATABASE_ID);
    console.log(`Database '${DATABASE_ID}' already exists.`);
  } catch (err) {
    console.log(`Creating database '${DATABASE_ID}'...`);
    await databases.create(DATABASE_ID, "Osdag Secure Database");
  }

  // 2. Ensure Files Collection exists
  try {
    await databases.getCollection(DATABASE_ID, FILES_COLLECTION_ID);
    console.log(`Collection '${FILES_COLLECTION_ID}' already exists.`);
  } catch (err) {
    console.log(`Creating collection '${FILES_COLLECTION_ID}'...`);
    await databases.createCollection(
      DATABASE_ID,
      FILES_COLLECTION_ID,
      "Files",
      [Permission.read(Role.users()), Permission.write(Role.users())], // Collection-level fallback
      true // Enable document security
    );

    // Create Collection Attributes
    await databases.createStringAttribute(DATABASE_ID, FILES_COLLECTION_ID, "filename", 255, true);
    await databases.createStringAttribute(DATABASE_ID, FILES_COLLECTION_ID, "path", 255, true);
    await databases.createStringAttribute(DATABASE_ID, FILES_COLLECTION_ID, "userId", 255, true);

    console.log("Collection attributes created.");
  }

  // 3. Ensure Storage Bucket exists
  try {
    await storage.getBucket(STORAGE_BUCKET_ID);
    console.log(`Storage Bucket '${STORAGE_BUCKET_ID}' already exists.`);
  } catch (err) {
    console.log(`Creating storage bucket '${STORAGE_BUCKET_ID}'...`);
    await storage.createBucket(
      STORAGE_BUCKET_ID,
      "User Files",
      [Permission.read(Role.users()), Permission.write(Role.users())],
      true, // File security enabled
      true  // Enabled
    );
  }

  // 4. Seed Users and Upload Files
  const testAccounts = [
    { email: "alice@test.com", password: "Password123!", name: "Alice" },
    { email: "bob@test.com", password: "Password123!", name: "Bob" },
    { email: "carol@test.com", password: "Password123!", name: "Carol" },
  ];

  for (const accountData of testAccounts) {
    let user;
    try {
      user = await users.create(
        ID.unique(),
        accountData.email,
        undefined,
        accountData.password,
        accountData.name
      );
      console.log(`Created Appwrite user: ${accountData.email} (ID: ${user.$id})`);
    } catch (err) {
      // User might already exist
      const userList = await users.list();
      user = userList.users.find((u) => u.email === accountData.email);
      if (user) {
        console.log(`User ${accountData.email} already exists (ID: ${user.$id}).`);
      } else {
        throw err;
      }
    }

    // Prepare temp seed files
    const userDir = path.join(__dirname, "temp_seed", user.$id);
    fs.mkdirSync(userDir, { recursive: true });

    const file1Name = `${accountData.name.toLowerCase()}_confidential_doc1.txt`;
    const file1Path = path.join(userDir, file1Name);
    fs.writeFileSync(file1Path, `Appwrite confidential document 1 for ${accountData.name}`);

    const file2Name = `${accountData.name.toLowerCase()}_report_doc2.txt`;
    const file2Path = path.join(userDir, file2Name);
    fs.writeFileSync(file2Path, `Appwrite security report document 2 for ${accountData.name}`);

    // Upload files to Appwrite Storage with owner-only read permissions
    for (const fileObj of [{ name: file1Name, p: file1Path }, { name: file2Name, p: file2Path }]) {
      const fileBuffer = fs.readFileSync(fileObj.p);
      const inputFile = InputFile.fromBuffer(fileBuffer, fileObj.name);

      const uploadedFile = await storage.createFile(
        STORAGE_BUCKET_ID,
        ID.unique(),
        inputFile,
        [Permission.read(Role.user(user.$id)), Permission.delete(Role.user(user.$id))]
      );

      // Save document record in Appwrite Database
      await databases.createDocument(
        DATABASE_ID,
        FILES_COLLECTION_ID,
        ID.unique(),
        {
          filename: fileObj.name,
          path: uploadedFile.$id,
          userId: user.$id,
        },
        [Permission.read(Role.user(user.$id))]
      );

      console.log(`Uploaded file '${fileObj.name}' for user ${accountData.name}`);
    }
  }

  console.log("Appwrite Backend Seeding completed successfully.");
}

if (require.main === module) {
  seedAppwrite().catch((err) => {
    console.error("Appwrite Seed Error:", err);
    process.exit(1);
  });
}

module.exports = seedAppwrite;
