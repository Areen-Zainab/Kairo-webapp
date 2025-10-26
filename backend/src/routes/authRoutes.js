const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { authenticateToken } = require("../middleware/auth");
const { validateSignup, validateLogin, validateProfileUpdate } = require("../middleware/validation");

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

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
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
        twoFactorEnabled: user.twoFactorEnabled,
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
        twoFactorEnabled: user.twoFactorEnabled,
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

    res.json({
      message: "Preferences updated successfully",
      preferences: updatedPreferences
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
    const updatedSettings = await User.updateNotificationSettings(req.user.id, settings);

    res.json({
      message: "Notification settings updated successfully",
      notificationSettings: updatedSettings
    });
  } catch (error) {
    console.error("Update notification settings error:", error);
    res.status(500).json({ error: "Internal server error" });
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
