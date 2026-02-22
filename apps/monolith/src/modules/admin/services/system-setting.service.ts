import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SystemSetting } from '../entities/system-setting.entity';
import { UpdateSystemSettingDto } from '../dto/update-system-setting.dto';

@Injectable()
export class SystemSettingService {
  private readonly logger = new Logger(SystemSettingService.name);

  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingRepo: Repository<SystemSetting>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<SystemSetting[]> {
    return this.settingRepo.find({ order: { key: 'ASC' } });
  }

  async findByKey(key: string): Promise<SystemSetting> {
    const setting = await this.settingRepo.findOne({ where: { key } });
    if (!setting) throw new NotFoundException(`Setting "${key}" not found`);
    return setting;
  }

  async upsert(key: string, dto: UpdateSystemSettingDto, userId: string): Promise<SystemSetting> {
    await this.dataSource.query(
      `INSERT INTO admin.system_settings (key, value, description, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         description = COALESCE(EXCLUDED.description, admin.system_settings.description),
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [key, JSON.stringify(dto.value), dto.description ?? null, userId],
    );

    const saved = await this.settingRepo.findOneByOrFail({ key });
    this.logger.log(`Setting "${key}" updated by ${userId}`);
    return saved;
  }

  async remove(key: string): Promise<void> {
    const setting = await this.findByKey(key);
    await this.settingRepo.remove(setting);
    this.logger.log(`Setting "${key}" deleted`);
  }
}
