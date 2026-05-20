import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import imageCompression from 'browser-image-compression';

export async function uploadMedia(
  file: File, 
  path: string, 
  onProgress?: (progress: number) => void
): Promise<string> {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1200,
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

  const fileExtension = compressedFile.name.split('.').pop() || 'png';
  const fileName = `${crypto.randomUUID()}.${fileExtension}`;
  const storageRef = ref(storage, `${path}/${fileName}`);
  
  const uploadTask = uploadBytesResumable(storageRef, compressedFile);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => {
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
}
