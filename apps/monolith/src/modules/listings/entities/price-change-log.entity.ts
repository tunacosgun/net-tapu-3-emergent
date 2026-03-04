import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ schema: 'listings', name: 'price_change_log' })
export class PriceChangeLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'parcel_id', type: 'uuid' })
  parcelId!: string;

  @Column({ name: 'old_price', type: 'numeric', precision: 15, scale: 2, nullable: true })
  oldPrice!: string | null;

  @Column({ name: 'new_price', type: 'numeric', precision: 15, scale: 2 })
  newPrice!: string;

  @Column({ name: 'change_type', type: 'varchar', length: 50 })
  changeType!: string;

  @Column({ name: 'change_percent', type: 'numeric', precision: 8, scale: 4, nullable: true })
  changePercent!: string | null;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
