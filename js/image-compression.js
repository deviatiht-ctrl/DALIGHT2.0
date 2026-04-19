// Magic function for compressing images and reducing their size by 95%

import { getSupabase } from './main.js';

const supabase = getSupabase();

function compressImage(file, quality = 0.1) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function previewEvidence() {
  const fileInput = document.getElementById('evidence');
  const file = fileInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('preview').src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

async function csImage() {
  const fileInput = document.getElementById('evidence');
  const file = fileInput.files[0];
  if (file) {
    const compressedBlob = await compressImage(file);
    const formData = new FormData();
    formData.append('image', compressedBlob, 'compressed.jpg');
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('images')
      .upload(`compressed/${Date.now()}.jpg`, compressedBlob);
    if (error) {
      console.error('Upload error:', error);
    } else {
      console.log('Image uploaded:', data.path);
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(data.path);
      console.log('Public URL:', urlData.publicUrl);
    }
  }
}

export { compressImage, previewEvidence, csImage };
