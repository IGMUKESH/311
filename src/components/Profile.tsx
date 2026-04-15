import React, { useState, useEffect, useCallback } from 'react';
import { auth, db, doc, setDoc, updateProfile, getDoc } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { User, Users, Camera, Save, ArrowLeft, Shield, Info, FileText, Phone, LogOut, LogIn, CheckCircle, Heart, Globe, Lock, EyeOff, Upload, X, Scissors } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { googleProvider, signInWithPopup, signOut } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { IKContext, IKUpload } from 'imagekitio-react';
import { imagekitConfig } from '../imagekit';
import Cropper from 'react-easy-crop';

type TabType = 'settings';

export const Profile: React.FC = () => {
  const [user] = useAuthState(auth);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [updating, setUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Cropping State
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

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

  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    if (tab && ['settings', 'about', 'terms', 'privacy'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
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
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const autoSaveProfile = async (newPhotoURL: string) => {
    if (!user) return;
    setUpdating(true);
    try {
      await updateProfile(user, { photoURL: newPhotoURL });
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        photoURL: newPhotoURL,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      const userPublicRef = doc(db, 'users_public', user.uid);
      await setDoc(userPublicRef, {
        photoURL: newPhotoURL,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setMessage({ type: 'success', text: 'Profile photo updated and saved!' });
    } catch (error) {
      console.error('Auto-save failed:', error);
      setMessage({ type: 'error', text: 'Failed to save photo automatically.' });
    } finally {
      setUpdating(false);
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

      // Upload to ImageKit via their API since IKUpload is a component
      const formData = new FormData();
      formData.append('file', croppedBlob);
      formData.append('fileName', `profile_${user.uid}_${Date.now()}.jpg`);
      formData.append('publicKey', imagekitConfig.publicKey);
      formData.append('folder', 'profiles');
      
      // We need an authenticator for manual upload
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
        await autoSaveProfile(result.url);
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Crop/Upload error:', error);
      setMessage({ type: 'error', text: 'Failed to process image: ' + error.message });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setUpdating(true);
    setMessage(null);

    try {
      await updateProfile(user, { 
        displayName,
        photoURL: photoURL || user.photoURL
      });
      
      // Also update in firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        displayName,
        phoneNumber,
        photoURL,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      const userPublicRef = doc(db, 'users_public', user.uid);
      await setDoc(userPublicRef, {
        displayName,
        photoURL,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setUpdating(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center animate-fade-in">
        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 mx-auto">
          <User className="text-[#8E9299]" size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-2">Join the Community</h2>
        <p className="text-[#8E9299] mb-8">Login to personalize your quotes and share with the community.</p>
        <div className="flex flex-col gap-3">
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-[#F27D26] text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#F27D26]/20"
          >
            <LogIn size={20} />
            Login with Google
          </button>
          <Link to="/" className="w-full py-4 bg-white/5 text-white rounded-2xl font-bold">Go Home</Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'settings', label: 'सेटिंग्स', icon: User },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-32 md:pb-8 animate-fade-in text-gray-900 dark:text-white">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 bg-gray-100 dark:bg-[#151619] rounded-xl text-gray-500 dark:text-[#8E9299] hover:text-black dark:hover:text-white transition-all">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-3xl font-bold gradient-text">प्रोफ़ाइल</h1>
        </div>
        <button 
          onClick={handleLogout}
          className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all flex items-center gap-2 font-bold text-sm"
        >
          <LogOut size={18} />
          लॉग आउट
        </button>
      </div>

      <div className="flex bg-gray-100 dark:bg-[#151619] p-1 rounded-2xl border border-gray-200 dark:border-white/5 mb-8 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id ? 'bg-[#F27D26] text-white shadow-lg shadow-[#F27D26]/20' : 'text-gray-500 dark:text-[#8E9299] hover:bg-gray-200 dark:hover:bg-white/5'
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'settings' && (
            <div className="rounded-3xl p-8 bg-white dark:bg-[#151619] shadow-xl border border-gray-100 dark:border-white/5">
              <form onSubmit={handleUpdate} className="space-y-6">
                <div className="flex flex-col items-center mb-8 gap-4">
                  <div className="relative group">
                    <img 
                      src={photoURL || user.photoURL || 'https://ui-avatars.com/api/?name=' + displayName + '&background=random'} 
                      alt="Profile" 
                      className="w-32 h-32 rounded-full shadow-2xl shadow-[#F27D26]/20 object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <div className="w-8 h-8 border-2 border-[#F27D26] border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="w-full max-w-xs">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                      className="hidden" 
                      id="profile-photo-upload" 
                    />
                    <label 
                      htmlFor="profile-photo-upload"
                      className="flex items-center justify-center gap-2 w-full bg-gray-100 dark:bg-[#151619] border border-gray-200 dark:border-white/10 rounded-xl py-3 px-4 hover:border-[#F27D26] cursor-pointer transition-all group"
                    >
                      <Upload size={18} className="text-[#F27D26]" />
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300">
                        {isUploading ? 'अपलोड हो रहा है...' : 'प्रोफ़ाइल फोटो बदलें'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Cropping Modal */}
                <AnimatePresence>
                  {imageToCrop && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4"
                    >
                      <div className="relative w-full max-w-2xl aspect-square bg-gray-200 dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-gray-300 dark:border-white/10">
                        <Cropper
                          image={imageToCrop}
                          crop={crop}
                          zoom={zoom}
                          rotation={rotation}
                          aspect={1}
                          onCropChange={setCrop}
                          onCropComplete={onCropComplete}
                          onZoomChange={setZoom}
                          onRotationChange={setRotation}
                        />
                      </div>
                      
                      <div className="w-full max-w-2xl mt-6 space-y-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-white/10 shadow-xl">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">ज़ूम</label>
                          <input 
                            type="range" 
                            min={1} 
                            max={3} 
                            step={0.1} 
                            value={zoom} 
                            onChange={(e) => setZoom(Number(e.target.value))} 
                            className="w-full accent-[#F27D26]"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">रोटेशन</label>
                          <input 
                            type="range" 
                            min={0} 
                            max={360} 
                            value={rotation} 
                            onChange={(e) => setRotation(Number(e.target.value))} 
                            className="w-full accent-[#F27D26]"
                          />
                        </div>
                        
                        <div className="flex gap-4">
                          <button 
                            type="button"
                            onClick={() => setImageToCrop(null)}
                            className="flex-1 py-4 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white rounded-2xl font-bold flex items-center justify-center gap-2"
                          >
                            <X size={20} />
                            रद्द करें
                          </button>
                          <button 
                            type="button"
                            onClick={handleCropSave}
                            disabled={isUploading}
                            className="flex-1 py-4 bg-[#F27D26] text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#F27D26]/20 disabled:opacity-50"
                          >
                            {isUploading ? (
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm">{uploadProgress > 0 ? `${uploadProgress}%` : 'अपलोड हो रहा है...'}</span>
                              </div>
                            ) : (
                              <>
                                <Scissors size={20} />
                                क्रॉप और सेव करें
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 dark:text-[#8E9299] uppercase tracking-widest ml-1">प्रदर्शन नाम</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-[#8E9299]" size={20} />
                    <input 
                      type="text" 
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="आपका नाम"
                      className="w-full bg-gray-100 dark:bg-[#151619] border border-gray-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:border-[#F27D26] outline-none transition-all font-sans"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 dark:text-[#8E9299] uppercase tracking-widest ml-1">फ़ोन नंबर</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-[#8E9299]" size={20} />
                    <input 
                      type="tel" 
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+91 00000 00000"
                      className="w-full bg-gray-100 dark:bg-[#151619] border border-gray-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:border-[#F27D26] outline-none transition-all font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 dark:text-[#8E9299] uppercase tracking-widest ml-1">ईमेल (निजी)</label>
                  <input 
                    type="email" 
                    value={user.email || ''}
                    disabled
                    className="w-full bg-gray-100 dark:bg-[#151619]/50 border border-gray-200 dark:border-white/5 rounded-2xl py-4 px-4 text-gray-500 dark:text-[#8E9299] cursor-not-allowed"
                  />
                </div>

                {message && (
                  <div className={`p-4 rounded-2xl text-sm font-bold ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {message.text}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={updating}
                  className="w-full bg-[#F27D26] text-white rounded-2xl py-4 font-bold flex items-center justify-center gap-2 hover:bg-opacity-90 transition-all shadow-lg shadow-[#F27D26]/20 disabled:opacity-50"
                >
                  {updating ? 'अपडेट हो रहा है...' : (
                    <>
                      <Save size={20} />
                      बदलाव सुरक्षित करें
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
