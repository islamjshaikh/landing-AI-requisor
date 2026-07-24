import { db } from "./db";
import { aiTools } from "@shared/schema";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix the csv-parse import
import * as csvParse from 'csv-parse';
const { parse } = csvParse;

// ES Module replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Seeds the database with AI tools from the provided CSV file
 */
export async function seedAiTools() {
  try {
    console.log("Checking if AI tools need to be seeded...");
    
    // Check if tools are already in the database
    const existingTools = await db.select().from(aiTools);
    
    // If tools already exist, skip seeding
    if (existingTools.length > 0) {
      console.log(`AI tools table already has ${existingTools.length} tools. Skipping seed.`);
      return;
    }
    
    // Read the CSV file
    const csvPath = path.join(__dirname, '../attached_assets/Top_100_AI_Tools_for_Entrepreneurs (1).csv');
    if (!fs.existsSync(csvPath)) {
      console.error("Could not find the AI tools CSV file in the attached_assets directory.");
      return;
    }
    
    const csvData = fs.readFileSync(csvPath, 'utf8');
    
    // Parse the CSV file
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      delimiter: ',',
      quote: '"'
    });
    
    // Transform the data for insertion
    const toolsToInsert = records.map((record: any) => {
      // Handle descriptions that might have been split across columns
      let description = record['Description'] || '';
      
      // Check for additional columns that might contain parts of the description
      // This handles cases where commas in the description caused it to be split
      for (let i = 0; i < 10; i++) {
        const extraKey = `field${i+1}`;
        if (record[extraKey] && 
            !['Yes', 'No'].includes(record[extraKey]) && 
            !record[extraKey].startsWith('http') &&
            !record[extraKey].includes('$') &&
            !record[extraKey].includes('/month')) {
          description += ' ' + record[extraKey];
        }
      }
      
      return {
        name: record['Tool Name'] || '',
        category: record['Category'] || '',
        description: description.trim(),
        freePlanAvailable: record['Free Plan Available'] === 'Yes',
        pricing: record['Pricing (Starting)'] || '',
        website: record['Website'] || '',
        logoUrl: null, // No logos in the CSV, we'll need to add these later if needed
        useCase: null,
        idealFor: null
      };
    });
    
    // Insert the tools into the database
    await db.insert(aiTools).values(toolsToInsert);
    
    console.log(`Successfully seeded AI tools table with ${toolsToInsert.length} tools.`);
  } catch (error) {
    console.error("Error seeding AI tools:", error);
  }
}