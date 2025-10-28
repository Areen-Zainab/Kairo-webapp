const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function setup() {
  try {
    console.log('Setting up database...');
    
    // Test database connection
    await prisma.$connect();
    console.log('Database connected successfully');
    
    // Check if any users exist
    const userCount = await prisma.user.count();
    console.log(`Found ${userCount} existing users`);
    
    if (userCount === 0) {
      console.log('Creating sample user...');
      
      // Create a sample user
      const hashedPassword = await bcrypt.hash('password123', 12);
      
      const sampleUser = await prisma.user.create({
        data: {
          name: 'Sample User',
          email: 'user@example.com',
          passwordHash: hashedPassword,
          timezone: 'UTC'
        }
      });
      
      // Create user preferences
      await prisma.userPreferences.create({
        data: {
          userId: sampleUser.id,
          timezone: 'UTC'
        }
      });
      
      // Create notification settings
      await prisma.notificationSettings.create({
        data: {
          userId: sampleUser.id
        }
      });
      
      console.log('✅ Sample user created successfully');
      console.log('📧 Email: user@example.com');
      console.log('🔑 Password: password123');
    }
    
    console.log('🎉 Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setup();
