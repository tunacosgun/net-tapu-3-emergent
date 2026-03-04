import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity({ schema: 'auctions', name: 'event_consumer_offsets' })
export class EventConsumerOffset {
  @PrimaryColumn({ name: 'consumer_group', type: 'varchar', length: 100 })
  consumerGroup!: string;

  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt!: Date;
}
