import 'dotenv/config';
import { initDb } from '../bot/database.js';

await initDb();
console.log('Database schema initialized successfully.');
