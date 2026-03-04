import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Testimonial } from '../entities/testimonial.entity';

@Injectable()
export class TestimonialService {
  private readonly logger = new Logger(TestimonialService.name);

  constructor(
    @InjectRepository(Testimonial)
    private readonly testimonialRepo: Repository<Testimonial>,
  ) {}

  async findAll(onlyApproved = false) {
    const where = onlyApproved ? { isApproved: true } : {};
    return this.testimonialRepo.find({
      where,
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  async findById(id: string) {
    const testimonial = await this.testimonialRepo.findOne({ where: { id } });
    if (!testimonial) throw new NotFoundException(`Testimonial ${id} not found`);
    return testimonial;
  }

  async create(data: Partial<Testimonial>) {
    const testimonial = this.testimonialRepo.create(data);
    const saved = await this.testimonialRepo.save(testimonial);
    this.logger.log(`Testimonial ${saved.id} created`);
    return saved;
  }

  async update(id: string, data: Partial<Testimonial>) {
    const testimonial = await this.findById(id);
    Object.assign(testimonial, data);
    return this.testimonialRepo.save(testimonial);
  }

  async remove(id: string) {
    const testimonial = await this.findById(id);
    await this.testimonialRepo.remove(testimonial);
    this.logger.log(`Testimonial ${id} deleted`);
  }

  async approve(id: string) {
    const testimonial = await this.findById(id);
    testimonial.isApproved = true;
    return this.testimonialRepo.save(testimonial);
  }
}
