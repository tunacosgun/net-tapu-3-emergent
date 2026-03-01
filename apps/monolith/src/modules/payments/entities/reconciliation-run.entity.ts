import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ schema: 'payments', name: 'reconciliation_runs' })
export class ReconciliationRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'payments_checked', type: 'int', default: 0 })
  paymentsChecked!: number;

  @Column({ name: 'mismatches_found', type: 'int', default: 0 })
  mismatchesFound!: number;

  @Column({ name: 'mismatches_resolved', type: 'int', default: 0 })
  mismatchesResolved!: number;

  @Column({ type: 'int', default: 0 })
  errors!: number;

  @Column({ type: 'jsonb', nullable: true })
  details!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
