import { Module } from '@nestjs/common';
import { CertificatesModule } from '../certificates/certificates.module';
import { InterviewsController, InternalResultsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';

@Module({
  imports: [CertificatesModule],
  controllers: [InterviewsController, InternalResultsController],
  providers: [InterviewsService],
  exports: [InterviewsService],
})
export class InterviewsModule {}
