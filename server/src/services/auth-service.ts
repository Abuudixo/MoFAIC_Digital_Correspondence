import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";
import { safeUserSelect } from "../utils/safe-user";

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      isActive: true,
      role: { select: { name: true } },
    },
  });

  const matches = user
    ? await bcrypt.compare(password, user.passwordHash)
    : await bcrypt.compare(password, "$2a$12$C6UzMDM.H6dfI/f/IKcEe.4nK9HqWm5vy5q9u7JQfR2j/OaV9rH0i");

  if (!user || !matches || !user.isActive) {
    throw new AppError(401, "Invalid email or password.");
  }

  const accessToken = jwt.sign({}, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    issuer: "mofaic-correspondence-api",
    audience: "mofaic-correspondence-client",
  });

  const safeUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: safeUserSelect,
  });

  return { accessToken, tokenType: "Bearer" as const, user: safeUser };
}
