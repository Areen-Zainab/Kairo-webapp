const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');

class User {
  static async create(userData) {
    const { name, email, password, timezone = 'UTC' } = userData;

    // Validate input
    if (!name || !email || !password) {
      throw new Error('Name, email, and password are required');
    }

    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user with user preferences and notification settings in one transaction
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        timezone,
        userPreferences: {
          create: {
            timezone,
            autoJoin: false,
            autoRecord: false,
            defaultDuration: 30,
            themeMode: 'light',
            accentColor: '#007bff'
          }
        },
        notificationSettings: {
          create: {
            emailMeetingReminders: true,
            emailMeetingSummaries: true,
            emailActionItems: true,
            emailWeeklyDigest: false,
            pushMeetingStarting: true,
            pushMeetingJoined: false,
            pushMentionsAndReplies: true,
            pushActionItemsDue: true,
            inAppMeetingUpdates: true,
            inAppTranscriptionReady: true,
            inAppSharedWithYou: true
          }
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        profilePictureUrl: true,
        audioSampleUrl: true,
        timezone: true,
        createdAt: true,
        isActive: true,
        emailVerified: true,
        userPreferences: true,
        notificationSettings: true
      }
    });

    return user;
  }

  static async findByEmail(email) {
    return await prisma.user.findUnique({
      where: { email },
      include: {
        userPreferences: true,
        notificationSettings: true
      }
    });
  }

  static async findById(id) {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        profilePictureUrl: true,
        audioSampleUrl: true,
        timezone: true,
        createdAt: true,
        lastLogin: true,
        isActive: true,
        emailVerified: true,
        userPreferences: true,
        notificationSettings: true
      }
    });
  }

  static async updateLastLogin(id) {
    return await prisma.user.update({
      where: { id },
      data: { lastLogin: new Date() }
    });
  }

  static async updateProfile(id, updateData) {
    const allowedFields = ['name', 'profilePictureUrl', 'audioSampleUrl', 'timezone'];
    const filteredData = Object.keys(updateData)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateData[key];
        return obj;
      }, {});

    return await prisma.user.update({
      where: { id },
      data: filteredData,
      select: {
        id: true,
        name: true,
        email: true,
        profilePictureUrl: true,
        audioSampleUrl: true,
        timezone: true,
        updatedAt: true
      }
    });
  }

  static async updatePreferences(id, preferences) {
    return await prisma.userPreferences.upsert({
      where: { userId: id },
      update: preferences,
      create: {
        userId: id,
        ...preferences
      }
    });
  }

  static async updateNotificationSettings(id, settings) {
    return await prisma.notificationSettings.upsert({
      where: { userId: id },
      update: settings,
      create: {
        userId: id,
        ...settings
      }
    });
  }

  static async changePassword(id, currentPassword, newPassword) {
    // Get the user with their password hash
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        passwordHash: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: newPasswordHash
      }
    });

    return { message: 'Password updated successfully' };
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static async deactivate(id) {
    return await prisma.user.update({
      where: { id },
      data: { isActive: false }
    });
  }

  static async delete(id) {
    return await prisma.user.delete({
      where: { id }
    });
  }
}

module.exports = User;