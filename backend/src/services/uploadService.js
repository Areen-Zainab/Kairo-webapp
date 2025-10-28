import supabase from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export async function uploadProfilePicture(userId, file) {
  const ext = path.extname(file.originalname);
  const fileName = `${userId}_${uuidv4()}${ext}`;
  const { data, error } = await supabase.storage
    .from('profile-pictures')
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true
    });

  if (error) throw error;

  // Get public URL
  const { data: publicUrl } = supabase.storage
    .from('profile-pictures')
    .getPublicUrl(fileName);

  return publicUrl.publicUrl;
}
