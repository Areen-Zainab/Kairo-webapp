const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const { uploadProfilePicture, uploadAudioRecording, deleteProfilePicture, deleteAudioRecording } = require("../lib/supabase");
const prisma = require("../lib/prisma");

const router = express.Router();

// Upload profile picture
router.post("/profile-picture", authenticateToken, async (req, res) => {
  try {
    const { imageData, fileExtension } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: "Image data is required" });
    }

    if (!imageData.includes('data:image/')) {
      return res.status(400).json({ error: "Invalid image format" });
    }

    // Get current user to retrieve old profile picture URL
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { profilePictureUrl: true }
    });

    // Delete old profile picture if it exists
    if (user && user.profilePictureUrl) {
      try {
        await deleteProfilePicture(user.profilePictureUrl);
        console.log("Deleted old profile picture:", user.profilePictureUrl);
      } catch (deleteError) {
        console.error("Error deleting old profile picture:", deleteError);
        // Continue with upload even if deletion fails
      }
    }

    const ext = fileExtension || imageData.split(';')[0].split('/')[1] || 'png';
    
    const imageUrl = await uploadProfilePicture(
      req.user.id.toString(),
      imageData,
      ext
    );

    res.json({
      message: "Profile picture uploaded successfully",
      imageUrl
    });
  } catch (error) {
    console.error("Upload profile picture error:", error);
    res.status(500).json({ error: error.message || "Failed to upload profile picture" });
  }
});

// Upload audio recording
router.post("/audio-recording", authenticateToken, async (req, res) => {
  try {
    const { audioData, fileExtension } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: "Audio data is required" });
    }

    if (!audioData.includes('data:audio/')) {
      return res.status(400).json({ error: "Invalid audio format" });
    }

    // Get current user to retrieve old audio sample URL
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { audioSampleUrl: true }
    });

    // Delete old audio recording if it exists
    if (user && user.audioSampleUrl) {
      try {
        await deleteAudioRecording(user.audioSampleUrl);
        console.log("Deleted old audio sample:", user.audioSampleUrl);
      } catch (deleteError) {
        console.error("Error deleting old audio sample:", deleteError);
        // Continue with upload even if deletion fails
      }
    }

    const ext = fileExtension || audioData.split(';')[0].split('/')[1] || 'webm';
    
    const audioUrl = await uploadAudioRecording(
      req.user.id.toString(),
      audioData,
      ext
    );

    res.json({
      message: "Audio recording uploaded successfully",
      audioUrl
    });
  } catch (error) {
    console.error("Upload audio recording error:", error);
    res.status(500).json({ error: error.message || "Failed to upload audio recording" });
  }
});

// Delete profile picture
router.delete("/profile-picture", authenticateToken, async (req, res) => {
  try {
    // Get current user to retrieve profile picture URL
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { profilePictureUrl: true }
    });

    // Delete from Supabase if it exists
    if (user && user.profilePictureUrl) {
      try {
        await deleteProfilePicture(user.profilePictureUrl);
        console.log("Deleted profile picture:", user.profilePictureUrl);
      } catch (deleteError) {
        console.error("Error deleting profile picture:", deleteError);
        // Continue even if deletion fails
      }
    }

    res.json({
      message: "Profile picture deleted successfully"
    });
  } catch (error) {
    console.error("Delete profile picture error:", error);
    res.status(500).json({ error: error.message || "Failed to delete profile picture" });
  }
});

// Delete audio recording
router.delete("/audio-recording", authenticateToken, async (req, res) => {
  try {
    // Get current user to retrieve audio sample URL
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { audioSampleUrl: true }
    });

    // Delete from Supabase if it exists
    if (user && user.audioSampleUrl) {
      try {
        await deleteAudioRecording(user.audioSampleUrl);
        console.log("Deleted audio sample:", user.audioSampleUrl);
      } catch (deleteError) {
        console.error("Error deleting audio sample:", deleteError);
        // Continue even if deletion fails
      }
    }

    res.json({
      message: "Audio recording deleted successfully"
    });
  } catch (error) {
    console.error("Delete audio recording error:", error);
    res.status(500).json({ error: error.message || "Failed to delete audio recording" });
  }
});

module.exports = router;

