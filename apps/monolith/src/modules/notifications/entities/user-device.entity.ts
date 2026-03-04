import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ schema: 'auth', name: 'user_devices' })
export class UserDevice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'device_token', type: 'varchar', length: 500 })
  deviceToken!: string;

  @Column({ type: 'varchar', length: 20 })
  platform!: 'web' | 'ios' | 'android';

  @Column({ name: 'device_name', type: 'varchar', length: 255, nullable: true })
  deviceName!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'last_used_at', type: 'timestamptz', default: () => 'NOW()' })
  lastUsedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
