import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TkgmService } from '../services/tkgm.service';
import { TkgmLookupDto } from '../dto/tkgm-lookup.dto';

@Controller('integrations/tkgm')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'consultant')
export class TkgmController {
  constructor(private readonly tkgmService: TkgmService) {}

  @Post('lookup')
  @HttpCode(HttpStatus.OK)
  async lookup(@Body() dto: TkgmLookupDto) {
    return this.tkgmService.lookup(dto);
  }
}
