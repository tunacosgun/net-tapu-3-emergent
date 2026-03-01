import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum OutboxEventType {
  BID_ACCEPTED = 'BID_ACCEPTED',
  AUCTION_STARTED = 'AUCTION_STARTED',
  AUCTION_ENDING = 'AUCTION_ENDING',
  AUCTION_ENDED = 'AUCTION_ENDED',
  SNIPER_EXTENSION = 'SNIPER_EXTENSION',
}

export enum OutboxEventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  DEAD_LETTER = 'dead_letter',
}

@Entity({ schema: 'auctions', name: 'event_outbox' })
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'aggregate_id', type: 'uuid' })
  aggregateId!: string;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: OutboxEventType,
    enumName: 'outbox_event_type',
  })
  eventType!: OutboxEventType;

  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: OutboxEventStatus,
    enumName: 'outbox_event_status',
    default: OutboxEventStatus.PENDING,
  })
  status!: OutboxEventStatus;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 })
  idempotencyKey!: string;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ name: 'max_attempts', type: 'integer', default: 5 })
  maxAttempts!: number;

  @Column({ name: 'last_attempt_at', type: 'timestamptz', nullable: true })
  lastAttemptAt!: Date | null;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  @Column({ name: 'error_details', type: 'text', nullable: true })
  errorDetails!: string | null;

  @Column({ type: 'bigint' })
  sequence!: string; // bigint comes as string from PG

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
