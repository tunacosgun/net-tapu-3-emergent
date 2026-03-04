import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'listings', name: 'price_alerts' })
export class PriceAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'parcel_id', type: 'uuid' })
  parcelId!: string;

  @Column({ name: 'target_price', type: 'numeric', precision: 15, scale: 2, nullable: true })
  targetPrice!: string | null;

  @Column({ name: 'alert_type', type: 'varchar', length: 30, default: 'any_drop' })
  alertType!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'last_notified_at', type: 'timestamptz', nullable: true })
  lastNotifiedAt!: Date | null;

  @Column({ name: 'triggered_count', type: 'integer', default: 0 })
  triggeredCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
