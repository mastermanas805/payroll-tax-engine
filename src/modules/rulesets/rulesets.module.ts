import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RULESET_REPOSITORY } from 'src/shared';
import { MongoRulesetRepository } from './mongo-ruleset.repository';
import { RuleSet, RuleSetSchema } from './schemas/ruleset.schema';

/**
 * RulesetsModule — provides the platform-global, data-driven ruleset config the
 * tax engine interprets. Binds the Mongo-backed MongoRulesetRepository to
 * RULESET_REPOSITORY and exports it so other modules (Tax Engine, Payroll) can
 * inject the interface. Registers the RuleSet schema via MongooseModule.forFeature;
 * the repository self-seeds the JSON rulesets on first boot (empty collection).
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: RuleSet.name, schema: RuleSetSchema }]),
  ],
  providers: [
    {
      provide: RULESET_REPOSITORY,
      useClass: MongoRulesetRepository,
    },
  ],
  exports: [RULESET_REPOSITORY],
})
export class RulesetsModule {}
