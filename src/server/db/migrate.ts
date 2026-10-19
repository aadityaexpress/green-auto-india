import { initializeSchema } from './schema.js';
import { seedDatabase } from './seed.js';

console.log('Running Green Auto India database schema migration and seed...');
initializeSchema();
const counts = seedDatabase();
console.log('Database initialized and seeded successfully:', counts);
