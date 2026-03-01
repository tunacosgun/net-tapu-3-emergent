import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

interface SeedUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

const SEED_USERS: SeedUser[] = [
  {
    email: 'admin@loadtest.com',
    password: 'Admin123!@#',
    firstName: 'Admin',
    lastName: 'NetTapu',
    roles: ['admin', 'user'],
  },
];

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    for (const seed of SEED_USERS) {
      await this.ensureUser(seed);
    }
  }

  private async ensureUser(seed: SeedUser): Promise<void> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      // Check if user already exists
      const existing: { id: string }[] = await qr.query(
        `SELECT id FROM auth.users WHERE email = $1`,
        [seed.email],
      );

      if (existing.length > 0) {
        this.logger.debug(`Seed user ${seed.email} already exists, skipping`);
        return;
      }

      // Hash password with same rounds as AuthService
      const passwordHash = await bcrypt.hash(seed.password, BCRYPT_ROUNDS);

      // Insert user
      const inserted: { id: string }[] = await qr.query(
        `INSERT INTO auth.users (email, password_hash, first_name, last_name, is_active, is_verified)
         VALUES ($1, $2, $3, $4, true, true)
         RETURNING id`,
        [seed.email, passwordHash, seed.firstName, seed.lastName],
      );
      const userId = inserted[0].id;

      // Assign roles
      for (const roleName of seed.roles) {
        const roles: { id: number }[] = await qr.query(
          `SELECT id FROM auth.roles WHERE name = $1`,
          [roleName],
        );
        if (roles.length > 0) {
          await qr.query(
            `INSERT INTO auth.user_roles (user_id, role_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [userId, roles[0].id],
          );
        }
      }

      this.logger.log(
        `Seed user created: ${seed.email} with roles [${seed.roles.join(', ')}]`,
      );
    } catch (err) {
      // Unique constraint race — another instance seeded concurrently
      if ((err as { code?: string }).code === '23505') {
        this.logger.debug(`Seed user ${seed.email} created by another instance`);
        return;
      }
      throw err;
    } finally {
      await qr.release();
    }
  }
}
