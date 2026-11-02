import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { RequisitionsModule } from './modules/requisitions/requisitions.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { PassportsModule } from './modules/passports/passports.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
// NOTE: MediaModule — add when S3 upload is wired
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { VoiceModule } from './modules/voice/voice.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),

    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,  limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long',   ttl: 60000, limit: 200 },
    ]),

    DatabaseModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    RequisitionsModule,
    ApplicationsModule,
    AssessmentsModule,
    PassportsModule,
    ProjectsModule,
    ProposalsModule,
    ContractsModule,
    MarketplaceModule,
    AnalyticsModule,
    AdminModule,
    NotificationsModule,
    LedgerModule,
    VoiceModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
