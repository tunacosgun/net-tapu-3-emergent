import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignRule } from './entities/campaign-rule.entity';
import { CampaignAssignment } from './entities/campaign-assignment.entity';
import { SpinResult } from './entities/spin-result.entity';
import { CampaignsService } from './campaigns.service';
import { SpinWheelService } from './spin-wheel.service';
import { CampaignsController } from './campaigns.controller';
import { SpinWheelController } from './spin-wheel.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campaign,
      CampaignRule,
      CampaignAssignment,
      SpinResult,
    ]),
  ],
  controllers: [CampaignsController, SpinWheelController],
  providers: [CampaignsService, SpinWheelService],
  exports: [TypeOrmModule, CampaignsService, SpinWheelService],
})
export class CampaignsModule {}
