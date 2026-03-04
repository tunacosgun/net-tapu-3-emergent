import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ schema: 'payments', name: 'payments' })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'parcel_id', type: 'uuid', nullable: true })
  parcelId!: string | null;

  @Column({ name: 'auction_id', type: 'uuid', nullable: true })
  auctionId!: string | null;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 3, default: 'TRY' })
  currency!: string;

  @Column({ type: 'enum', enum: ['pending', 'awaiting_3ds', 'provisioned', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded'], default: 'pending' })
  status!: string;

  @Column({ name: 'payment_method', type: 'enum', enum: ['credit_card', 'bank_transfer', 'mail_order'] })
  paymentMethod!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', name: 'idempotency_key', length: 255, unique: true })
  idempotencyKey!: string;

  @Column({ name: 'pos_transaction_token', type: 'varchar', length: 500, nullable: true })
  posTransactionToken!: string | null;

  @Column({ name: 'three_ds_initiated_at', type: 'timestamptz', nullable: true })
  threeDsInitiatedAt!: Date | null;

  @Column({ name: 'callback_received_at', type: 'timestamptz', nullable: true })
  callbackReceivedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
