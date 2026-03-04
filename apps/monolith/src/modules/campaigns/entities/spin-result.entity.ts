import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ schema: 'campaigns', name: 'spin_results' })
export class SpinResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId!: string;

  @Column({ name: 'prize_key', type: 'varchar', length: 100 })
  prizeKey!: string;

  @Column({ name: 'prize_label', type: 'varchar', length: 255 })
  prizeLabel!: string;

  @Column({ name: 'discount_code', type: 'varchar', length: 50, nullable: true })
  discountCode!: string | null;

  @Column({ name: 'is_redeemed', type: 'boolean', default: false })
  isRedeemed!: boolean;

  @Column({ name: 'redeemed_at', type: 'timestamptz', nullable: true })
  redeemedAt!: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
