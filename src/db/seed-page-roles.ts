import { seedPageRoles } from '../services/page-roles.js';

/**
 * Seed script to populate initial page roles from constants.
 * Run this after migrations to ensure all page roles are in the database.
 */
export const seedPageRolesScript = async () => {
  try {
    const result = await seedPageRoles();
    console.log(result.message);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed page roles:', error);
    process.exit(1);
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  void seedPageRolesScript();
}
