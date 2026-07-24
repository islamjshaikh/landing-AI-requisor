import { Pool } from '@neondatabase/serverless';
const DATABASE_URL = process.env.DATABASE_URL;

// Simple test script to verify database connection
async function testDatabaseConnection() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    return;
  }

  console.log('Testing database connection...');
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Test connection with a simple query
    const result = await pool.query('SELECT NOW()');
    console.log('Connection successful!', result.rows[0]);
    
    // Check if tasks table exists
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Available tables:', tablesResult.rows.map(row => row.table_name));
    
    // Check tasks table structure
    const tasksCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tasks'
    `);
    
    console.log('Tasks table columns:', tasksCheck.rows);
    
    // Count tasks
    const taskCount = await pool.query('SELECT COUNT(*) FROM tasks');
    console.log('Total tasks in database:', taskCount.rows[0].count);
    
    // Insert a test task if needed
    if (parseInt(taskCount.rows[0].count) < 1) {
      console.log('Adding a test task...');
      const insertTask = await pool.query(`
        INSERT INTO tasks (name, description, project_id) 
        VALUES ('Test Task', 'This is a test task to verify database connectivity', 1)
        RETURNING id, name
      `);
      console.log('Test task created:', insertTask.rows[0]);
    }
    
  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await pool.end();
  }
}

testDatabaseConnection().catch(console.error);