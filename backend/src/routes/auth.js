import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../db/client.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

const SignupSchema = z.object({
  orgName:  z.string().min(2).max(100),
  email:    z.string().email(),
  password: z.string().min(8).max(128),
});

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, org: user.org_id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );
}

// POST /auth/signup
router.post('/signup', asyncHandler(async (req, res) => {
  const { orgName, email, password } = SignupSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(password, 12);

  const { rows } = await query(
    `WITH org AS (
       INSERT INTO organizations (name) VALUES ($1) RETURNING id
     ), usr AS (
       INSERT INTO users (email, org_id, password_hash, role)
       SELECT $2, org.id, $3, 'admin' FROM org
       RETURNING id, org_id, role
     )
     SELECT usr.id, usr.org_id, usr.role FROM usr`,
    [orgName, email, passwordHash],
  );

  const token = issueToken(rows[0]);
  res.status(201).json({ token, userId: rows[0].id, orgId: rows[0].org_id });
}));

// POST /auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = LoginSchema.parse(req.body);
  const { rows } = await query(
    'SELECT id, org_id, role, password_hash FROM users WHERE email = $1',
    [email],
  );
  if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ token: issueToken(rows[0]), userId: rows[0].id, orgId: rows[0].org_id });
}));

// POST /auth/logout
router.post('/logout', (_req, res) => res.json({ message: 'Logged out' }));

export default router;
