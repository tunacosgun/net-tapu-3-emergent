import {
  Controller,
  Get,
  Post,
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
import { FavoriteService } from '../services/favorite.service';
import { CreateFavoriteDto } from '../dto/create-favorite.dto';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async add(
    @Body() dto: CreateFavoriteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.favoriteService.add(dto.parcelId, user.sub);
  }

  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    return this.favoriteService.listByUser(user.sub);
  }

  @Delete(':parcelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('parcelId', ParseUUIDPipe) parcelId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.favoriteService.remove(parcelId, user.sub);
  }
}
