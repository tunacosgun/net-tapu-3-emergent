import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';
import {
  CampaignsService,
  ListCampaignsQuery,
  CreateCampaignInput,
  UpdateCampaignInput,
} from './campaigns.service';

@Controller('admin/campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  async findAll(@Query() query: ListCampaignsQuery) {
    return this.campaignsService.findAll(query);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignsService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCampaignInput,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.campaignsService.create(dto, user.sub);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignInput,
  ) {
    return this.campaignsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.campaignsService.remove(id);
  }

  // ── Rules ──

  @Post(':id/rules')
  @HttpCode(HttpStatus.CREATED)
  async addRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { ruleType: string; ruleValue: Record<string, unknown> },
  ) {
    return this.campaignsService.addRule(id, body.ruleType, body.ruleValue);
  }

  @Delete('rules/:ruleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRule(@Param('ruleId', ParseUUIDPipe) ruleId: string) {
    await this.campaignsService.removeRule(ruleId);
  }

  // ── Assignments ──

  @Post(':id/assignments')
  @HttpCode(HttpStatus.CREATED)
  async assignParcels(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { parcelIds: string[] },
  ) {
    return this.campaignsService.assignParcels(id, body.parcelIds);
  }

  @Delete(':id/assignments/:parcelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unassignParcel(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('parcelId', ParseUUIDPipe) parcelId: string,
  ) {
    await this.campaignsService.unassignParcel(id, parcelId);
  }
}
