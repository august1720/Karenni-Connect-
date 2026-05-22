import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import imageCompression from 'browser-image-compression';

export async function uploadMedia(
  file: File, 
  path: string, 
  onProgress?: (progress: number) => void
): Promise<string> {
  // We use base64 strings stored in Firestore since Firebase Storage
  // might not be provisioned in this environment. 
  // We compress aggressively to fit within Firestore's 1MB document limit.
  const options = {
    maxSizeMB: 0.7,
    maxWidthOrHeight: 1000,
    useWebWorker: true,
  };
  
  let compressedFile = file;
  if (file.type.startsWith('image/')) {
    try {
      compressedFile = await imageCompression(file, options);
    } catch (error) {
      console.warn('Image compression failed, using original file', error);
    }
  }

  if (onProgress) onProgress(50); // Simulated progress

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (onProgress) onProgress(100);
      resolve(reader.result as string);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(compressedFile);
  });
}
