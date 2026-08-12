const prisma = require("../../config/prisma");
const AppError = require("../../utils/AppError");

/**
 * Retrieves profile of logged-in user.
 * @param {string} userId
 */
const getUserProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      files: {
        select: {
          id: true,
          filename: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

module.exports = {
  getUserProfile,
};
