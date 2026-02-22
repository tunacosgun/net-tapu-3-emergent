import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Faq } from '../entities/faq.entity';
import { CreateFaqDto } from '../dto/create-faq.dto';
import { UpdateFaqDto } from '../dto/update-faq.dto';

@Injectable()
export class FaqService {
  private readonly logger = new Logger(FaqService.name);

  constructor(
    @InjectRepository(Faq)
    private readonly faqRepo: Repository<Faq>,
  ) {}

  async create(dto: CreateFaqDto, userId: string): Promise<Faq> {
    const faq = this.faqRepo.create({
      question: dto.question,
      answer: dto.answer,
      category: dto.category ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isPublished: dto.isPublished ?? false,
      createdBy: userId,
    });

    const saved = await this.faqRepo.save(faq);
    this.logger.log(`FAQ created: ${saved.id} by ${userId}`);
    return saved;
  }

  async findAll(): Promise<Faq[]> {
    return this.faqRepo.find({ order: { sortOrder: 'ASC', createdAt: 'DESC' } });
  }

  async findPublished(): Promise<Faq[]> {
    return this.faqRepo.find({
      where: { isPublished: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async findById(id: string): Promise<Faq> {
    const faq = await this.faqRepo.findOne({ where: { id } });
    if (!faq) throw new NotFoundException(`FAQ ${id} not found`);
    return faq;
  }

  async update(id: string, dto: UpdateFaqDto, userId: string): Promise<Faq> {
    const faq = await this.findById(id);

    if (dto.question !== undefined) faq.question = dto.question;
    if (dto.answer !== undefined) faq.answer = dto.answer;
    if (dto.category !== undefined) faq.category = dto.category;
    if (dto.sortOrder !== undefined) faq.sortOrder = dto.sortOrder;
    if (dto.isPublished !== undefined) faq.isPublished = dto.isPublished;

    const saved = await this.faqRepo.save(faq);
    this.logger.log(`FAQ ${id} updated by ${userId}`);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const faq = await this.findById(id);
    await this.faqRepo.remove(faq);
    this.logger.log(`FAQ ${id} deleted`);
  }
}
