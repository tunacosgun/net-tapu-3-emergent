import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignRule } from './entities/campaign-rule.entity';
import { CampaignAssignment } from './entities/campaign-assignment.entity';

export interface ListCampaignsQuery {
  page?: number;
  limit?: number;
  status?: string;
  campaignType?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CreateCampaignInput {
  title: string;
  description?: string;
  campaignType: string;
  startsAt: string;
  endsAt: string;
  discountPercent?: number;
  discountAmount?: number;
  maxUses?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateCampaignInput {
  title?: string;
  description?: string;
  status?: string;
  startsAt?: string;
  endsAt?: string;
  discountPercent?: number;
  discountAmount?: number;
  maxUses?: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignRule)
    private readonly ruleRepo: Repository<CampaignRule>,
    @InjectRepository(CampaignAssignment)
    private readonly assignmentRepo: Repository<CampaignAssignment>,
  ) {}

  async findAll(query: ListCampaignsQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.campaignRepo.createQueryBuilder('c');

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }
    if (query.campaignType) {
      qb.andWhere('c.campaign_type = :campaignType', { campaignType: query.campaignType });
    }
    if (query.search) {
      qb.andWhere('(c.title ILIKE :search OR c.description ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    // Add assignment count subquery
    qb.addSelect(
      `(SELECT COUNT(*) FROM campaigns.campaign_assignments ca WHERE ca.campaign_id = c.id)`,
      'c_assignmentCount',
    );

    const sortColumn = {
      title: 'c.title',
      startsAt: 'c.starts_at',
      endsAt: 'c.ends_at',
      createdAt: 'c.created_at',
    }[query.sortBy ?? 'createdAt'] ?? 'c.created_at';

    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortColumn, sortOrder).skip(skip).take(limit);

    const { entities, raw } = await qb.getRawAndEntities();
    const total = await qb.getCount();

    const data = entities.map((entity, idx) => ({
      ...entity,
      assignmentCount: parseInt(raw[idx]?.c_assignmentCount ?? '0', 10),
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);

    const rules = await this.ruleRepo.find({ where: { campaignId: id } });
    const assignmentCount = await this.assignmentRepo.count({ where: { campaignId: id } });

    return { ...campaign, rules, assignmentCount };
  }

  async create(dto: CreateCampaignInput, userId: string) {
    const campaign = this.campaignRepo.create({
      title: dto.title,
      description: dto.description ?? null,
      campaignType: dto.campaignType,
      status: 'draft',
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      discountPercent: dto.discountPercent?.toFixed(2) ?? null,
      discountAmount: dto.discountAmount?.toFixed(2) ?? null,
      maxUses: dto.maxUses ?? null,
      metadata: dto.metadata ?? null,
      createdBy: userId,
    });

    const saved = await this.campaignRepo.save(campaign);
    this.logger.log(`Campaign ${saved.id} created by ${userId}`);
    return saved;
  }

  async update(id: string, dto: UpdateCampaignInput) {
    const campaign = await this.findById(id);

    if (dto.title !== undefined) campaign.title = dto.title;
    if (dto.description !== undefined) campaign.description = dto.description ?? null;
    if (dto.status !== undefined) {
      const validTransitions: Record<string, string[]> = {
        draft: ['active'],
        active: ['paused', 'ended'],
        paused: ['active', 'ended'],
      };
      const allowed = validTransitions[campaign.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot transition from ${campaign.status} to ${dto.status}`,
        );
      }
      campaign.status = dto.status;
    }
    if (dto.startsAt) campaign.startsAt = new Date(dto.startsAt);
    if (dto.endsAt) campaign.endsAt = new Date(dto.endsAt);
    if (dto.discountPercent !== undefined) campaign.discountPercent = dto.discountPercent?.toFixed(2) ?? null;
    if (dto.discountAmount !== undefined) campaign.discountAmount = dto.discountAmount?.toFixed(2) ?? null;
    if (dto.maxUses !== undefined) campaign.maxUses = dto.maxUses ?? null;
    if (dto.metadata !== undefined) campaign.metadata = dto.metadata ?? null;

    const saved = await this.campaignRepo.save(campaign);
    this.logger.log(`Campaign ${id} updated`);
    return saved;
  }

  async remove(id: string) {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);

    if (campaign.status === 'active') {
      throw new BadRequestException('Cannot delete an active campaign. Pause or end it first.');
    }

    await this.campaignRepo.remove(campaign);
    this.logger.log(`Campaign ${id} deleted`);
  }

  // ── Rules ──

  async addRule(campaignId: string, ruleType: string, ruleValue: Record<string, unknown>) {
    await this.findById(campaignId); // Verify exists
    const rule = this.ruleRepo.create({ campaignId, ruleType, ruleValue });
    return this.ruleRepo.save(rule);
  }

  async removeRule(ruleId: string) {
    const rule = await this.ruleRepo.findOne({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException(`Rule ${ruleId} not found`);
    await this.ruleRepo.remove(rule);
  }

  // ── Assignments ──

  async assignParcels(campaignId: string, parcelIds: string[]) {
    await this.findById(campaignId);
    const assignments = parcelIds.map((parcelId) =>
      this.assignmentRepo.create({ campaignId, parcelId }),
    );
    return this.assignmentRepo.save(assignments);
  }

  async unassignParcel(campaignId: string, parcelId: string) {
    const assignment = await this.assignmentRepo.findOne({
      where: { campaignId, parcelId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.assignmentRepo.remove(assignment);
  }
}
