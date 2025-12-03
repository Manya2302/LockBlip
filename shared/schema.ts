import { z } from "zod";

// Mongoose schemas are defined in server/models/
// These are TypeScript types and Zod schemas for validation

export interface User {
  _id?: string;
  username: string;
  email: string;
  phone: string;
  fullName: string;
  dateOfBirth: string;
  password: string;
  publicKey: string;
  authorizedIPs: Array<{
    ip: string;
    authorizedAt: string;
    userAgent: string;
  }>;
  isVerified: boolean;
  createdAt: Date;
}

export interface Block {
  _id?: string;
  index: number;
  timestamp: string;
  from: string;
  to: string;
  payload: string;
  prevHash: string;
  hash: string;
  createdAt: Date;
}

export interface OTP {
  _id?: string;
  email: string;
  otp: string;
  expiresAt: Date;
  verified: boolean;
  createdAt: Date;
}

export interface IPAuthorization {
  _id?: string;
  username: string;
  ip: string;
  token: string;
  userAgent?: string;
  authorized: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface Connection {
  _id?: string;
  sender: string;
  receiver: string;
  status: 'pending' | 'accepted' | 'ignored' | 'blocked';
  isFriend: boolean;
  messagePermission: boolean;
  createdAt: Date;
  updatedAt: Date;
  notes?: string;
}

export const insertUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  fullName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  publicKey: z.string().min(1),
});

export type InsertUser = z.infer<typeof insertUserSchema>;

export const insertConnectionSchema = z.object({
  sender: z.string().min(1),
  receiver: z.string().min(1),
  notes: z.string().optional(),
});

export type InsertConnection = z.infer<typeof insertConnectionSchema>;
