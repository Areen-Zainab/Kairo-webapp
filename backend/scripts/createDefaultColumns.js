/**
 * Script to create default kanban columns for all existing workspaces
 * Run this after deploying the task management system to existing workspaces
 * 
 * Usage: node scripts/createDefaultColumns.js
 */

const prisma = require('../src/lib/prisma');
const TaskCreationService = require('../src/services/TaskCreationService');

async function createDefaultColumnsForAllWorkspaces() {
  console.log('🚀 Starting default kanban columns creation...\n');

  try {
    // Get all active workspaces
    const workspaces = await prisma.workspace.findMany({
      where: { isActive: true },
      include: {
        kanbanColumns: true
      }
    });

    console.log(`📊 Found ${workspaces.length} active workspace(s)\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const workspace of workspaces) {
      try {
        console.log(`Processing workspace: ${workspace.name} (ID: ${workspace.id})`);
        
        // Check if workspace already has columns
        if (workspace.kanbanColumns && workspace.kanbanColumns.length > 0) {
          console.log(`  ⏭️  Skipping - already has ${workspace.kanbanColumns.length} column(s)`);
          skipped++;
        } else {
          // Create default columns
          await TaskCreationService.ensureDefaultKanbanColumns(workspace.id);
          console.log(`  ✅ Created default columns`);
          created++;
        }
      } catch (error) {
        console.error(`  ❌ Error processing workspace ${workspace.id}:`, error.message);
        errors++;
      }
      console.log(''); // Empty line for readability
    }

    console.log('\n📊 Summary:');
    console.log(`  - Workspaces processed: ${workspaces.length}`);
    console.log(`  - Columns created: ${created}`);
    console.log(`  - Skipped (already had columns): ${skipped}`);
    console.log(`  - Errors: ${errors}`);
    console.log('\n✅ Script completed successfully!');

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run the script
createDefaultColumnsForAllWorkspaces();


