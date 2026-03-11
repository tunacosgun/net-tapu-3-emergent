import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

class ListDealersQuery {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsEnum(['pending', 'approved', 'rejected', 'suspended'])
  status?: string;
}

@Controller('admin/dealers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminDealerController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get()
  async list(@Query() query: ListDealersQuery) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const offset = (page - 1) * limit;

    // Dealers are users with role_id=5 (dealer)
    let where = '';
    const params: unknown[] = [limit, offset];

    if (query.status === 'approved') {
      where = 'AND u.is_active = true AND u.email_verified = true';
    } else if (query.status === 'pending') {
      where = 'AND (u.is_active = false OR u.email_verified = false)';
    } else if (query.status === 'suspended') {
      where = 'AND u.is_active = false';
    }

    const [rows, countResult] = await Promise.all([
      this.ds.query(
        `SELECT u.id, u.email, u.first_name AS "firstName", u.last_name AS "lastName",
                u.phone, u.email_verified AS "isVerified", u.is_active AS "isActive",
                u.created_at AS "createdAt",
                dq.commission_rate AS "commissionRate",
                COALESCE(dq.max_listings, 0) AS "portfolioCount"
         FROM auth.users u
         INNER JOIN auth.user_roles ur ON ur.user_id = u.id AND ur.role_id = 5
         LEFT JOIN auth.dealer_quotas dq ON dq.user_id = u.id
         WHERE 1=1 ${where}
         ORDER BY u.created_at DESC
         LIMIT $1 OFFSET $2`,
        params,
      ),
      this.ds.query(
        `SELECT COUNT(*) AS total
         FROM auth.users u
         INNER JOIN auth.user_roles ur ON ur.user_id = u.id AND ur.role_id = 5
         WHERE 1=1 ${where}`,
      ),
    ]);

    const total = parseInt(countResult[0]?.total || '0', 10);

    // Map status
    const data = rows.map((r: Record<string, unknown>) => ({
      ...r,
      status: !(r as { isActive: boolean }).isActive
        ? 'suspended'
        : !(r as { isVerified: boolean }).isVerified
          ? 'pending'
          : 'approved',
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  @Patch(':id/approve')
  async approve(@Param('id', ParseUUIDPipe) id: string) {
    await this.ds.query(
      `UPDATE auth.users SET is_active = true, email_verified = true, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    return { success: true };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status?: string; commissionRate?: number },
  ) {
    if (body.status === 'suspended') {
      await this.ds.query(`UPDATE auth.users SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
    } else if (body.status === 'approved') {
      await this.ds.query(`UPDATE auth.users SET is_active = true, email_verified = true, updated_at = NOW() WHERE id = $1`, [id]);
    }
    if (body.commissionRate !== undefined) {
      await this.ds.query(
        `INSERT INTO auth.dealer_quotas (user_id, commission_rate, valid_from, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE SET commission_rate = $2, updated_at = NOW()`,
        [id, body.commissionRate],
      );
    }
    return { success: true };
  }
}
