import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parcel } from './entities/parcel.entity';
import { ParcelImage } from './entities/parcel-image.entity';
import { ParcelDocument } from './entities/parcel-document.entity';
import { ParcelStatusHistory } from './entities/parcel-status-history.entity';
import { ParcelMapData } from './entities/parcel-map-data.entity';
import { Favorite } from './entities/favorite.entity';
import { SavedSearch } from './entities/saved-search.entity';

import { ParcelService } from './services/parcel.service';
import { ParcelMediaService } from './services/parcel-media.service';
import { FavoriteService } from './services/favorite.service';
import { SavedSearchService } from './services/saved-search.service';

import { ParcelController } from './controllers/parcel.controller';
import { ParcelMediaController } from './controllers/parcel-media.controller';
import { FavoriteController } from './controllers/favorite.controller';
import { SavedSearchController } from './controllers/saved-search.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Parcel,
      ParcelImage,
      ParcelDocument,
      ParcelStatusHistory,
      ParcelMapData,
      Favorite,
      SavedSearch,
    ]),
  ],
  controllers: [
    ParcelController,
    ParcelMediaController,
    FavoriteController,
    SavedSearchController,
  ],
  providers: [
    ParcelService,
    ParcelMediaService,
    FavoriteService,
    SavedSearchService,
  ],
  exports: [TypeOrmModule, ParcelService],
})
export class ListingsModule {}
