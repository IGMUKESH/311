import React, { useState, useCallback, useEffect } from 'react';
import { auth, db, doc, setDoc, updateProfile, getDoc } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { User, Camera, Save, X, Scissors, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { imagekitConfig } from '../imagekit';
import Cropper from 'react-easy-crop';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'full' | 'photo';
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, mode = 'full' }) => {
  const [user] = useAuthState(auth);
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [updating, setUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  useEffect(() => {
    if (user && isOpen) {
      const fetchProfile = async () => {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setDisplayName(data.displayName || user.displayName || '');
          setPhoneNumber(data.phoneNumber || '');
          setPhotoURL(data.photoURL || user.photoURL || '');
        }
      };
      fetchProfile();
    }
  }, [user, isOpen]);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      // Only set crossOrigin for non-data URLs
      if (!url.startsWith('data:')) {
        image.setAttribute('crossOrigin', 'anonymous');
      }
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: any, rotation = 0): Promise<Blob | null> => {
    if (!pixelCrop || pixelCrop.width === 0 || pixelCrop.height === 0) {
      console.error('Invalid crop area');
      return null;
    }
    
    try {
      const image = await createImage(imageSrc);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Could not get canvas context');
        return null;
      }
      
      // Set canvas size to the cropped area
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      
      // Rotate canvas
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      
      ctx.drawImage(
        image, 
        pixelCrop.x, 
        pixelCrop.y, 
        pixelCrop.width, 
        pixelCrop.height, 
        0, 
        0, 
        pixelCrop.width, 
        pixelCrop.height
      );
      
      return new Promise((resolve) => { 
        canvas.toBlob((blob) => {
          if (!blob) {
            console.error('Canvas toBlob failed');
            resolve(null);
          } else {
            resolve(blob);
          }
        }, 'image/jpeg', 0.85); // Slightly lower quality for speed
      });
    } catch (error) {
      console.error('Error in getCroppedImg:', error);
      return null;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setImageToCrop(reader.result as string));
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCropSave = async () => {
    if (!imageToCrop || !croppedAreaPixels || !user) return;
    setIsUploading(true);
    try {
      const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels, rotation);
      if (!croppedBlob) throw new Error('Failed to crop image');
      const formData = new FormData();
      formData.append('file', croppedBlob);
      formData.append('fileName', `profile_${user.uid}_${Date.now()}.jpg`);
      formData.append('publicKey', imagekitConfig.publicKey);
      formData.append('folder', 'profiles');
      const authResponse = await imagekitConfig.authenticator();
      formData.append('signature', authResponse.signature);
      formData.append('expire', authResponse.expire.toString());
      formData.append('token', authResponse.token);
      
      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload');
        
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(xhr.responseText || 'Upload failed'));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(formData);
      });

      if (result.url) {
        setPhotoURL(result.url);
        setImageToCrop(null);
        setUploadProgress(0);
        setRotation(0); // Reset rotation
        
        // If in photo mode, save immediately after crop
        if (mode === 'photo') {
          await updateProfile(user, { photoURL: result.url });
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, { photoURL: result.url, updatedAt: new Date().toISOString() }, { merge: true });
          onClose();
        }
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Crop/Upload error:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setUpdating(true);
    try {
      await updateProfile(user, { displayName, photoURL });
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { displayName, phoneNumber, photoURL, updatedAt: new Date().toISOString() }, { merge: true });
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white dark:bg-[#151619] border border-gray-200 dark:border-white/10 rounded-3xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto text-black dark:text-white">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">{mode === 'photo' ? 'फोटो बदलें' : 'प्रोफ़ाइल संपादित करें'}</h2>
            <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10"><X size={20} /></button>
          </div>
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <img src={photoURL || 'https://ui-avatars.com/api/?name=' + displayName + '&background=random'} alt="Profile" className="w-24 h-24 rounded-full object-cover border border-gray-200 dark:border-white/10" />
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="profile-photo-upload" />
              <label htmlFor="profile-photo-upload" className="flex items-center gap-2 bg-[#F27D26] text-white px-4 py-2 rounded-xl cursor-pointer"><Upload size={16} /> {mode === 'photo' ? 'फोटो चुनें' : 'फोटो बदलें'}</label>
              {mode === 'photo' && <p className="text-xs text-gray-500 dark:text-slate-500 text-center">क्रॉप करने के बाद फोटो अपने आप सेव हो जाएगी।</p>}
            </div>
            
            {mode === 'full' && (
              <>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="नाम" className="w-full bg-gray-100 dark:bg-[#1A1B1E] border border-gray-200 dark:border-white/10 rounded-2xl p-4 outline-none font-sans text-black dark:text-white" />
                <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="फ़ोन नंबर" className="w-full bg-gray-100 dark:bg-[#1A1B1E] border border-gray-200 dark:border-white/10 rounded-2xl p-4 outline-none font-sans text-black dark:text-white" />
                <button type="submit" disabled={updating} className="w-full bg-[#F27D26] text-white rounded-2xl py-4 font-bold">{updating ? 'सहेज रहा है...' : 'बदलाव सुरक्षित करें'}</button>
              </>
            )}
          </form>
        </motion.div>
      </motion.div>
      {imageToCrop && (
        <motion.div className="fixed inset-0 z-[110] bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-2xl aspect-square bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
            <Cropper image={imageToCrop} crop={crop} zoom={zoom} rotation={rotation} aspect={1} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} onRotationChange={setRotation} />
          </div>
          <div className="w-full max-w-2xl mt-4">
            <label className="text-white text-sm">Rotation</label>
            <input type="range" min="0" max="360" value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-full" />
          </div>
          <div className="flex gap-4 mt-6">
            <button onClick={() => setImageToCrop(null)} className="py-4 px-8 bg-white/5 rounded-2xl font-bold">रद्द करें</button>
            <button 
              onClick={handleCropSave} 
              disabled={isUploading}
              className="py-4 px-8 bg-[#F27D26] rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUploading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">{uploadProgress > 0 ? `${uploadProgress}%` : 'अपलोड हो रहा है...'}</span>
                </div>
              ) : (
                'क्रॉप और सेव करें'
              )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
