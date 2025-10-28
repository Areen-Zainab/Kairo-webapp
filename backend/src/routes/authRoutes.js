const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { authenticateToken } = require("../middleware/auth");
const { validateSignup, validateLogin, validateProfileUpdate } = require("../middleware/validation");
const { deleteProfilePicture, deleteAudioRecording } = require("../lib/supabase");
const prisma = require("../lib/prisma");

const router = express.Router();

// Signup route
router.post("/signup", validateSignup, async (req, res) => {
  try {
    const { name, email, password, timezone } = req.body;

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      timezone: timezone || 'UTC'
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Create welcome notification
    try {
      await Notification.create({
        userId: user.id,
        title: "Welcome to Kairo! 🎉",
        message: "Finish setting up your account to get the most out of Kairo.",
        type: "account",
        priority: "high",
        workspace: "System",
        actionRequired: true
      });
    } catch (notifError) {
      console.error("Error creating welcome notification:", notifError);
      // Don't fail the signup if notification creation fails
    }

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePictureUrl: user.profilePictureUrl,
        audioSampleUrl: user.audioSampleUrl,
        timezone: user.timezone,
        createdAt: user.createdAt
      },
      token
    });
  } catch (error) {
    console.error("Signup error:", error);
    
    if (error.message === 'Email already registered') {
      return res.status(409).json({ error: error.message });
    }
    
    if (error.message.includes('validation') || error.message.includes('required')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

// Login route
router.post("/login", validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: "Account is deactivated" });
    }

    const isPasswordValid = await User.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Update last login
    await User.updateLastLogin(user.id);

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePictureUrl: user.profilePictureUrl,
        audioSampleUrl: user.audioSampleUrl,
        timezone: user.timezone,
        lastLogin: user.lastLogin,
        emailVerified: user.emailVerified,
        isActive: user.isActive,
        preferences: user.userPreferences,
        notificationSettings: user.notificationSettings
      },
      token
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get current user profile
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePictureUrl: user.profilePictureUrl,
        audioSampleUrl: user.audioSampleUrl,
        timezone: user.timezone,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        preferences: user.userPreferences,
        notificationSettings: user.notificationSettings
      }
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user profile
router.put("/me", authenticateToken, validateProfileUpdate, async (req, res) => {
  try {
    const updateData = req.body;
    
    // Get current user to check for existing files
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { profilePictureUrl: true, audioSampleUrl: true }
    });

    // Delete old files if they exist and are being replaced or removed
    if (updateData.profilePictureUrl !== undefined && currentUser?.profilePictureUrl) {
      if (updateData.profilePictureUrl === null || updateData.profilePictureUrl !== currentUser.profilePictureUrl) {
        try {
          await deleteProfilePicture(currentUser.profilePictureUrl);
          console.log("Deleted old profile picture:", currentUser.profilePictureUrl);
        } catch (deleteError) {
          console.error("Error deleting old profile picture:", deleteError);
          // Continue even if deletion fails
        }
      }
    }

    if (updateData.audioSampleUrl !== undefined && currentUser?.audioSampleUrl) {
      if (updateData.audioSampleUrl === null || updateData.audioSampleUrl !== currentUser.audioSampleUrl) {
        try {
          await deleteAudioRecording(currentUser.audioSampleUrl);
          console.log("Deleted old audio sample:", currentUser.audioSampleUrl);
        } catch (deleteError) {
          console.error("Error deleting old audio sample:", deleteError);
          // Continue even if deletion fails
        }
      }
    }

    const user = await User.updateProfile(req.user.id, updateData);

    res.json({
      message: "Profile updated successfully",
      user
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user preferences
router.put("/me/preferences", authenticateToken, async (req, res) => {
  try {
    const preferences = req.body;
    const updatedPreferences = await User.updatePreferences(req.user.id, preferences);

    // Fetch the updated user data
    const user = await User.findById(req.user.id);

    res.json({
      message: "Preferences updated successfully",
      preferences: updatedPreferences,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePictureUrl: user.profilePictureUrl,
        audioSampleUrl: user.audioSampleUrl,
        timezone: user.timezone,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        preferences: updatedPreferences,
        notificationSettings: user.notificationSettings
      }
    });
  } catch (error) {
    console.error("Update preferences error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update notification settings
router.put("/me/notifications", authenticateToken, async (req, res) => {
  try {
    const settings = req.body;
    
    // Validate settings object
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: "Invalid notification settings" });
    }

    const updatedSettings = await User.updateNotificationSettings(req.user.id, settings);

    // Fetch the updated user data
    const user = await User.findById(req.user.id);

    res.json({
      message: "Notification settings updated successfully",
      notificationSettings: updatedSettings,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profilePictureUrl: user.profilePictureUrl,
        audioSampleUrl: user.audioSampleUrl,
        timezone: user.timezone,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        preferences: user.userPreferences,
        notificationSettings: updatedSettings
      }
    });
  } catch (error) {
    console.error("Update notification settings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Change password route
router.put("/me/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    await User.changePassword(req.user.id, currentPassword, newPassword);
    
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    if (error.message === 'User not found') {
      res.status(404).json({ error: "User not found" });
    } else if (error.message === 'Current password is incorrect') {
      res.status(401).json({ error: "Current password is incorrect" });
    } else {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Logout route (client-side token removal)
router.post("/logout", authenticateToken, (req, res) => {
  res.json({ message: "Logged out successfully" });
});

// Verify token route
router.get("/verify", authenticateToken, (req, res) => {
  res.json({ 
    valid: true, 
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email
    }
  });
});

module.exports = router;
