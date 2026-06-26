import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { getUserByEmail, getUserById, insertUser } from "./databaseService";
import { User } from "../types";

const SALT_ROUNDS = 10;

export async function signupUser(email: string, username: string, password: string): Promise<User> {
  const existing = await getUserByEmail(email);
  if (existing) {
    throw new Error("Email already registered");
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const user: User = {
    user_id: randomUUID(),
    email,
    username,
    password: hashedPassword,
    created_at: new Date()
  };

  await insertUser(user);
  return user;
}

export async function loginUser(email: string, password: string): Promise<User> {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const matches = await bcrypt.compare(password, user.password);
  if (!matches) {
    throw new Error("Invalid credentials");
  }

  return user;
}

export async function getUserByUserId(userId: string): Promise<User | null> {
  return getUserById(userId);
}
