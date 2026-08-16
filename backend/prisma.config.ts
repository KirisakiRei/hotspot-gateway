import { defineConfig } from 'prisma/config';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
