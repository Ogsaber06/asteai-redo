import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AiService } from './ai.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
