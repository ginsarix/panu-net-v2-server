import { db } from './index.js';
import { currentDefinition } from './schema/current-definition.js';
import { definitions } from './schema/definitions.js';

export const seedDefaultDefinitionScript = async () => {
  try {
    const definitionsCount = await db.$count(definitions);

    let definitionId: number;
    if (!definitionsCount) {
      await db
        .insert(definitions)
        .values({ name: 'Varsayılan Tanım' })
        .returning({ id: definitions.id })
        .then((result) => {
          definitionId = result[0].id;
        });

      console.info('Default definition seeded ✅');
    } else {
      await db
        .select()
        .from(definitions)
        .limit(1)
        .then((result) => {
          definitionId = result[0].id;
        });

      console.info('Default definition already seeded');
    }

    const currentDefinitionCount = await db.$count(currentDefinition);
    if (!currentDefinitionCount) {
      await db.insert(currentDefinition).values({ definitionId: definitionId! });
      console.info('Default current definition seeded ✅');
    } else {
      console.info('Default current definition already seeded');
    }

    process.exit(0);
  } catch (error) {
    console.error('Failed to seed default definition: ', error);
    process.exit(1);
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  void seedDefaultDefinitionScript();
}
