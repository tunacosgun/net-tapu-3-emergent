import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'admin', name: 'testimonials' })
export class Testimonial {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  title!: string | null;

  @Column({ type: 'text' })
  comment!: string;

  @Column({ type: 'integer' })
  rating!: number;

  @Column({ name: 'photo_url', type: 'varchar', length: 1000, nullable: true })
  photoUrl!: string | null;

  @Column({ name: 'video_url', type: 'varchar', length: 1000, nullable: true })
  videoUrl!: string | null;

  @Column({ name: 'is_approved', type: 'boolean', default: false })
  isApproved!: boolean;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
