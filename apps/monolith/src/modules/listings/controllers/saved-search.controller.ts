import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/auth.service';
import { SavedSearchService } from '../services/saved-search.service';
import { CreateSavedSearchDto } from '../dto/create-saved-search.dto';
import { UpdateSavedSearchDto } from '../dto/update-saved-search.dto';

@Controller('saved-searches')
@UseGuards(JwtAuthGuard)
export class SavedSearchController {
  constructor(private readonly savedSearchService: SavedSearchService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateSavedSearchDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.savedSearchService.create(dto, user.sub);
  }

  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    return this.savedSearchService.listByUser(user.sub);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSavedSearchDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.savedSearchService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.savedSearchService.remove(id, user.sub);
  }
}
