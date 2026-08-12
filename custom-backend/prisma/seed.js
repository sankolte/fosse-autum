const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seed...");

  // 1. Clear existing records (idempotent reseed)
  await prisma.revokedToken.deleteMany({});
  await prisma.file.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Hash default password
  const defaultPassword = "Password123!";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 3. Define seed users
  const usersData = [
    { email: "alice@test.com", name: "Alice" },
    { email: "bob@test.com", name: "Bob" },
    { email: "carol@test.com", name: "Carol" },
  ];

  for (const userData of usersData) {
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        passwordHash,
      },
    });

    // Create physical directory for user's uploaded files
    const userUploadDir = path.join(__dirname, "../uploads", user.id);
    fs.mkdirSync(userUploadDir, { recursive: true });

    const file1Name = `${userData.name.toLowerCase()}_confidential_doc1.txt`;
    const file1Path = path.join(userUploadDir, file1Name);
    const file1Content = `This is confidential file 1 belonging to ${userData.name} (${user.email}).`;
    fs.writeFileSync(file1Path, file1Content, "utf-8");

    const file2Name = `${userData.name.toLowerCase()}_report_doc2.txt`;
    const file2Path = path.join(userUploadDir, file2Name);
    const file2Content = `This is security report file 2 belonging to ${userData.name} (${user.email}).`;
    fs.writeFileSync(file2Path, file2Content, "utf-8");

    const relativePath1 = path.relative(path.join(__dirname, ".."), file1Path).replace(/\\/g, "/");
    const relativePath2 = path.relative(path.join(__dirname, ".."), file2Path).replace(/\\/g, "/");

    await prisma.file.createMany({
      data: [
        {
          filename: file1Name,
          path: relativePath1,
          userId: user.id,
        },
        {
          filename: file2Name,
          path: relativePath2,
          userId: user.id,
        },
      ],
    });

    console.log(`Seeded user ${user.email} (ID: ${user.id}) with 2 files.`);
  }

  console.log("Database seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
