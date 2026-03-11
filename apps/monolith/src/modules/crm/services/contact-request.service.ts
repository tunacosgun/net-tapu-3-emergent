import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ContactRequest } from '../entities/contact-request.entity';
import { CreateContactRequestDto } from '../dto/create-contact-request.dto';
import { UpdateContactRequestDto } from '../dto/update-contact-request.dto';
import { ListContactRequestsQueryDto } from '../dto/list-contact-requests-query.dto';

@Injectable()
export class ContactRequestService {
  private readonly logger = new Logger(ContactRequestService.name);

  constructor(
    @InjectRepository(ContactRequest)
    private readonly repo: Repository<ContactRequest>,
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}

  async create(dto: CreateContactRequestDto, userId?: string, ipAddress?: string): Promise<ContactRequest> {
    const entity = this.repo.create({
      type: dto.type,
      name: dto.name,
      phone: dto.phone,
      email: dto.email ?? null,
      message: dto.message ?? null,
      parcelId: dto.parcelId ?? null,
      userId: userId ?? null,
      ipAddress: ipAddress ?? null,
      status: 'new',
    });

    const saved = await this.repo.save(entity);
    this.logger.log(`ContactRequest created: ${saved.id} type=${saved.type}`);
    return saved;
  }

  async findAll(query: ListContactRequestsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const params: unknown[] = [limit, offset];
    let paramIdx = 2;

    let where = '';
    if (query.status) {
      paramIdx++;
      where += ` AND cr.status = $${paramIdx}`;
      params.push(query.status);
    }
    if (query.type) {
      paramIdx++;
      where += ` AND cr.type = $${paramIdx}`;
      params.push(query.type);
    }
    if (query.assigned_to) {
      paramIdx++;
      where += ` AND cr.assigned_to = $${paramIdx}`;
      params.push(query.assigned_to);
    }
    if (query.search) {
      paramIdx++;
      where += ` AND (cr.name ILIKE $${paramIdx} OR cr.phone ILIKE $${paramIdx})`;
      params.push(`%${query.search}%`);
    }

    const sql = `
      SELECT
        cr.id, cr.type, cr.status, cr.user_id AS "userId", cr.parcel_id AS "parcelId",
        cr.name, cr.phone, cr.email, cr.message, cr.assigned_to AS "assignedTo",
        cr.ip_address AS "ipAddress", cr.created_at AS "createdAt", cr.updated_at AS "updatedAt",
        -- parcel info
        p.title AS "parcelTitle", p.listing_id AS "parcelListingId",
        p.city AS "parcelCity", p.district AS "parcelDistrict", p.price AS "parcelPrice",
        -- user info
        u.first_name AS "userFirstName", u.last_name AS "userLastName", u.email AS "userEmail",
        -- assignee info
        a.first_name AS "assigneeFirstName", a.last_name AS "assigneeLastName"
      FROM crm.contact_requests cr
      LEFT JOIN listings.parcels p ON p.id = cr.parcel_id
      LEFT JOIN auth.users u ON u.id = cr.user_id
      LEFT JOIN auth.users a ON a.id = cr.assigned_to
      WHERE 1=1 ${where}
      ORDER BY cr.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const countSql = `
      SELECT COUNT(*) AS total FROM crm.contact_requests cr WHERE 1=1 ${where}
    `;
    // For count query, we skip first 2 params ($1=limit, $2=offset)
    const countParams = params.slice(2);

    const [rows, countResult] = await Promise.all([
      this.ds.query(sql, params),
      this.ds.query(
        countSql.replace(/\$(\d+)/g, (_, n) => `$${Number(n) - 2}`),
        countParams,
      ),
    ]);

    const total = parseInt(countResult[0]?.total || '0', 10);

    const data = rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      userId: r.userId,
      parcelId: r.parcelId,
      name: r.name,
      phone: r.phone,
      email: r.email,
      message: r.message,
      assignedTo: r.assignedTo,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      parcel: r.parcelTitle
        ? {
            title: r.parcelTitle,
            listingId: r.parcelListingId,
            city: r.parcelCity,
            district: r.parcelDistrict,
            price: r.parcelPrice,
          }
        : null,
      user: r.userFirstName
        ? {
            firstName: r.userFirstName,
            lastName: r.userLastName,
            email: r.userEmail,
          }
        : null,
      assignee: r.assigneeFirstName
        ? {
            firstName: r.assigneeFirstName,
            lastName: r.assigneeLastName,
          }
        : null,
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<ContactRequest> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`ContactRequest ${id} not found`);
    }
    return entity;
  }

  async update(id: string, dto: UpdateContactRequestDto, userId: string): Promise<ContactRequest> {
    const entity = await this.findById(id);

    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.assignedTo !== undefined) entity.assignedTo = dto.assignedTo;

    const saved = await this.repo.save(entity);
    this.logger.log(`ContactRequest ${id} updated by ${userId}`);
    return saved;
  }

  async getActivity(contactId: string) {
    const contact = await this.findById(contactId);
    if (!contact.userId) {
      return { activities: [], summary: null };
    }

    const activities = await this.ds.query(
      `SELECT action, resource_type AS "resourceType", resource_id AS "resourceId",
              metadata, created_at AS "createdAt"
       FROM crm.user_activity_log
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 15`,
      [contact.userId],
    );

    const summary = await this.ds.query(
      `SELECT
         MIN(created_at) AS "firstVisit",
         MAX(created_at) AS "lastVisit",
         COUNT(*) AS "totalActions",
         COUNT(DISTINCT CASE WHEN action = 'parcel_view' THEN resource_id END) AS "parcelsViewed"
       FROM crm.user_activity_log
       WHERE user_id = $1`,
      [contact.userId],
    );

    return {
      activities,
      summary: summary[0] ?? null,
    };
  }
}
