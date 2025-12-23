import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function initializeSchema() {
  const client = await pool.connect();
  
  try {
    console.log('Connecting to database...');
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`Database: ${process.env.DB_NAME}`);
    
    const schemaPath = path.join(__dirname, '../src/models/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Running schema...');
    await client.query('BEGIN');
    
    await client.query(schema);
    
    await client.query(`
      ALTER TABLE games 
      ALTER COLUMN player1_id DROP NOT NULL,
      ALTER COLUMN player2_id DROP NOT NULL,
      ALTER COLUMN winner_id DROP NOT NULL;
    `);
    
    await client.query(`
      ALTER TABLE game_moves 
      ALTER COLUMN player_id DROP NOT NULL;
    `);
    
    await client.query('COMMIT');
    
    console.log('Schema initialized successfully!');
    
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('\nTables created:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error initializing schema:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initializeSchema();

