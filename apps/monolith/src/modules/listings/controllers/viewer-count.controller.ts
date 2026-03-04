import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ViewerCountService } from '../services/viewer-count.service';

class ViewerSessionDto {
  sessionId!: string;
}

@Controller('parcels')
export class ViewerCountController {
  constructor(private readonly viewerCountService: ViewerCountService) {}

  /**
   * GET /parcels/:id/viewers — Get current viewer count for a parcel
   */
  @Get(':id/viewers')
  async getViewerCount(@Param('id', ParseUUIDPipe) id: string) {
    const count = await this.viewerCountService.getActiveViewerCount(id);
    return { parcelId: id, viewerCount: count };
  }

  /**
   * POST /parcels/:id/viewers — Register a viewer session (also used as heartbeat)
   */
  @Post(':id/viewers')
  @HttpCode(HttpStatus.OK)
  async registerViewer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ViewerSessionDto,
  ) {
    const count = await this.viewerCountService.registerViewer(id, dto.sessionId);
    return { parcelId: id, viewerCount: count };
  }

  /**
   * POST /parcels/:id/viewers/heartbeat — Heartbeat to keep session alive
   */
  @Post(':id/viewers/heartbeat')
  @HttpCode(HttpStatus.OK)
  async heartbeat(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ViewerSessionDto,
  ) {
    const count = await this.viewerCountService.heartbeat(id, dto.sessionId);
    return { parcelId: id, viewerCount: count };
  }

  /**
   * DELETE /parcels/:id/viewers — Remove a viewer session
   */
  @Delete(':id/viewers')
  @HttpCode(HttpStatus.OK)
  async removeViewer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ViewerSessionDto,
  ) {
    const count = await this.viewerCountService.removeViewer(id, dto.sessionId);
    return { parcelId: id, viewerCount: count };
  }
}
