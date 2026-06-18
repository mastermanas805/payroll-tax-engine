import { Module } from '@nestjs/common';
import { RULESET_REPOSITORY } from 'src/shared';
import { InMemoryRulesetRepository } from './in-memory-ruleset.repository';

/**
 * RulesetsModule — provides the platform-global, data-driven ruleset config the
 * tax engine interprets. Binds InMemoryRulesetRepository to RULESET_REPOSITORY
 * and exports it so other modules (Tax Engine, Payroll) can inject the interface.
 */
@Module({
  providers: [
    {
      provide: RULESET_REPOSITORY,
      useClass: InMemoryRulesetRepository,
    },
  ],
  exports: [RULESET_REPOSITORY],
})
export class RulesetsModule {}
