const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('Supabase credentials not found in environment variables');
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Upload a profile picture to Supabase storage
 * @param {string} userId - User ID
 * @param {string} base64Image - Base64 encoded image string
 * @param {string} fileExtension - File extension (e.g., 'png', 'jpg')
 * @returns {Promise<string>} Public URL of the uploaded image
 */
async function uploadProfilePicture(userId, base64Image, fileExtension = 'png') {
  try {
    // Convert base64 to buffer
    const base64Data = base64Image.split(',')[1]; // Remove data:image/png;base64, prefix
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${userId}-${timestamp}.${fileExtension}`;
    const filepath = `profile-pictures/${filename}`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('profile-pictures')
      .upload(filepath, buffer, {
        contentType: `image/${fileExtension}`,
        upsert: false // Don't overwrite existing files
      });

    if (error) {
      console.error('Error uploading profile picture:', error);
      throw new Error(`Failed to upload profile picture: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(filepath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadProfilePicture:', error);
    throw error;
  }
}

/**
 * Upload an audio recording to Supabase storage
 * @param {string} userId - User ID
 * @param {string} base64Audio - Base64 encoded audio string
 * @param {string} fileExtension - File extension (e.g., 'webm', 'mp3', 'wav')
 * @returns {Promise<string>} Public URL of the uploaded audio
 */
async function uploadAudioRecording(userId, base64Audio, fileExtension = 'webm') {
  try {
    // Convert base64 to buffer
    const base64Data = base64Audio.split(',')[1]; // Remove data:audio/webm;base64, prefix
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${userId}-${timestamp}.${fileExtension}`;
    const filepath = `audio-recordings/${filename}`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('audio-recordings')
      .upload(filepath, buffer, {
        contentType: `audio/${fileExtension}`,
        upsert: false // Don't overwrite existing files
      });

    if (error) {
      console.error('Error uploading audio recording:', error);
      throw new Error(`Failed to upload audio recording: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('audio-recordings')
      .getPublicUrl(filepath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadAudioRecording:', error);
    throw error;
  }
}

/**
 * Delete a profile picture from Supabase storage
 * @param {string} url - Full URL of the profile picture
 */
async function deleteProfilePicture(url) {
  try {
    // Extract the file path from the full URL
    // URLs look like: https://xxx.supabase.co/storage/v1/object/public/profile-pictures/profile-pictures/123-123456.png
    let filepath = url;
    
    // Check if it's a full Supabase URL
    if (url.includes('/storage/v1/object/public/profile-pictures/')) {
      // Extract path after the bucket name
      filepath = url.split('/storage/v1/object/public/profile-pictures/')[1];
    } else if (url.includes('/profile-pictures/')) {
      // Extract path after profile-pictures/
      filepath = url.split('/profile-pictures/')[1];
    }

    console.log('Deleting profile picture at path:', filepath);

    const { error } = await supabase.storage
      .from('profile-pictures')
      .remove([filepath]);

    if (error) {
      console.error('Error deleting profile picture:', error);
      throw new Error(`Failed to delete profile picture: ${error.message}`);
    }

    return true;
  } catch (error) {
    console.error('Error in deleteProfilePicture:', error);
    throw error;
  }
}

/**
 * Delete an audio recording from Supabase storage
 * @param {string} url - Full URL of the audio recording
 */
async function deleteAudioRecording(url) {
  try {
    // Extract the file path from the full URL
    // URLs look like: https://xxx.supabase.co/storage/v1/object/public/audio-recordings/audio-recordings/123-123456.webm
    let filepath = url;
    
    // Check if it's a full Supabase URL
    if (url.includes('/storage/v1/object/public/audio-recordings/')) {
      // Extract path after the bucket name
      filepath = url.split('/storage/v1/object/public/audio-recordings/')[1];
    } else if (url.includes('/audio-recordings/')) {
      // Extract path after audio-recordings/
      filepath = url.split('/audio-recordings/')[1];
    }

    console.log('Deleting audio recording at path:', filepath);

    const { error } = await supabase.storage
      .from('audio-recordings')
      .remove([filepath]);

    if (error) {
      console.error('Error deleting audio recording:', error);
      throw new Error(`Failed to delete audio recording: ${error.message}`);
    }

    return true;
  } catch (error) {
    console.error('Error in deleteAudioRecording:', error);
    throw error;
  }
}

module.exports = {
  supabase,
  uploadProfilePicture,
  uploadAudioRecording,
  deleteProfilePicture,
  deleteAudioRecording,
};

