import React, { useState, useEffect, useRef } from 'react';
import { Quote, OperationType, BrandingConfig } from '../types';
import { Quote as QuoteIcon, Share2, Heart, MessageCircle, Download, MessageSquare, User, Edit, Camera, Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import { db, auth, doc, setDoc, deleteDoc, onSnapshot, updateDoc, increment, handleFirestoreError, collection, query, getDoc, signInWithPopup, googleProvider } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { CommentSection } from './CommentSection';
import { EditProfileModal } from './EditProfileModal';
import { BrandingOverlay } from './BrandingOverlay';

import { PaymentModal } from './PaymentModal';

interface QuoteCardProps {
  quote: Quote;
}

// Global circuit breaker for ImageKit limits
let fastSystemDisabledUntil = 0;

export const QuoteCard: React.FC<QuoteCardProps> = ({ quote }) => {
  const [user] = useAuthState(auth);
  const [currentUserData, setCurrentUserData] = useState<{ displayName?: string, phoneNumber?: string, photoURL?: string } | null>(null);

  useEffect(() => {
    if (!user) {
      setCurrentUserData(null);
      return;
    }
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setCurrentUserData(doc.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });
    return unsubscribe;
  }, [user]);

  const [userData, setUserData] = useState<{ displayName?: string, phoneNumber?: string, photoURL?: string } | null>(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(quote.likesCount || 0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editModalMode, setEditModalMode] = useState<'full' | 'photo'>('full');

  const handleOpenEditModal = async (mode: 'full' | 'photo') => {
    console.log('Edit clicked');
    if (!user) {
      console.log('Not logged in, triggering login');
      await signInWithPopup(auth, googleProvider);
      return;
    }
    setEditModalMode(mode);
    setShowEditModal(true);
  };
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [mediaDimensions, setMediaDimensions] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const updateDimensions = () => {
      if (quote.imageUrl && imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        setMediaDimensions({ width: rect.width, height: rect.height });
      }
    };
    
    const timeoutId = setTimeout(updateDimensions, 500); // Initial delay to ensure rendering
    window.addEventListener('resize', updateDimensions);
    return () => {
      window.removeEventListener('resize', updateDimensions);
      clearTimeout(timeoutId);
    };
  }, [quote.imageUrl, imageLoaded]);

  useEffect(() => {
    // Increment view count once per session per quote to prevent jumping
    const viewedQuotes = JSON.parse(sessionStorage.getItem('viewed_quotes') || '[]');
    if (viewedQuotes.includes(quote.id)) return;

    const incrementView = async () => {
      try {
        const quoteDoc = doc(db, 'quotes', quote.id!);
        await updateDoc(quoteDoc, {
          viewsCount: increment(1)
        });
        viewedQuotes.push(quote.id);
        sessionStorage.setItem('viewed_quotes', JSON.stringify(viewedQuotes));
      } catch (err) {
        console.error('Error incrementing view:', err);
      }
    };
    incrementView();
  }, [quote.id]);

  useEffect(() => {
    if (!quote.createdBy) return;
    const userRef = doc(db, 'users_public', quote.createdBy);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setUserData(doc.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users_public/${quote.createdBy}`);
    });
    return unsubscribe;
  }, [quote.createdBy]);

  useEffect(() => {
    if (!user) return;
    const likeDoc = doc(db, 'quotes', quote.id!, 'likes', user.uid);
    const unsubscribe = onSnapshot(likeDoc, (doc) => {
      setLiked(doc.exists());
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `quotes/${quote.id}/likes/${user.uid}`);
    });
    return unsubscribe;
  }, [user, quote.id]);

  useEffect(() => {
    const quoteDoc = doc(db, 'quotes', quote.id!);
    const unsubscribe = onSnapshot(quoteDoc, (doc) => {
      if (doc.exists()) {
        setLikesCount(doc.data().likesCount || 0);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `quotes/${quote.id}`);
    });
    return unsubscribe;
  }, [quote.id]);

  useEffect(() => {
    const q = query(collection(db, 'quotes', quote.id!, 'comments'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCommentsCount(snapshot.size);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `quotes/${quote.id}/comments`);
    });
    return unsubscribe;
  }, [quote.id]);

  const handleLike = async () => {
    if (!user) {
      document.getElementById('login-btn')?.click();
      return;
    }

    const likeDoc = doc(db, 'quotes', quote.id!, 'likes', user.uid);
    const quoteDoc = doc(db, 'quotes', quote.id!);

    try {
      if (liked) {
        await deleteDoc(likeDoc);
        await updateDoc(quoteDoc, {
          likesCount: increment(-1)
        });
      } else {
        await setDoc(likeDoc, {
          uid: user.uid,
          quoteId: quote.id,
          createdAt: new Date().toISOString()
        });
        await updateDoc(quoteDoc, {
          likesCount: increment(1)
        });
      }
    } catch (error) {
      console.error("Like failed:", error);
    }
  };

  const handleWhatsAppShare = async () => {
    setIsSharing(true);
    try {
      const media = await generateBrandedMediaBlob();
      if (!media) {
        alert("Failed to prepare media for sharing.");
        setIsSharing(false);
        return;
      }

      const file = new File([media.blob], `quote-${quote.id}.${media.ext}`, { type: media.mimeType });
      
      // Try to use Web Share API for WhatsApp specifically if possible
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
        });
      } else {
        // Fallback: This is limited on web, but best effort
        alert("Direct WhatsApp sharing is not supported on this browser. Please use the main Share button.");
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("WhatsApp share failed:", err);
      }
    } finally {
      setIsSharing(false);
    }
  };

  const FONT_STACK = '"Inter", system-ui, -apple-system, sans-serif';

  const drawBranding = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, b: BrandingConfig, userData: any, userImg: HTMLImageElement | null) => {
    try {
      const scale = canvas.width / 400;
      const size = (b.imageSize || 80) * scale;
      const fontSize = (b.textSize || 32) * scale;
      const opacity = b.opacity ?? 1;

      if (opacity <= 0) return;

      ctx.save();
      ctx.globalAlpha = opacity;

      let imgX = (canvas.width * (b.imageX || 0)) / 100;
      let imgY = (canvas.height * (b.imageY || 0)) / 100;
      let textX = (canvas.width * (b.textX || 0)) / 100;
      let textY = (canvas.height * (b.textY || 0)) / 100;

      let textBlockWidth = 0;
      let textBlockHeight = 0;

      if (b.position !== 'custom') {
        const margin = 28 * scale; 
        const gap = 12 * scale;
        
        ctx.font = `900 ${fontSize}px ${FONT_STACK}`;
        const name = (userData?.displayName || user?.displayName || 'User').toUpperCase();
        const nameWidth = ctx.measureText(name).width;
        
        if (b.showName || b.showPhone) {
          textBlockWidth = nameWidth;
          textBlockHeight = fontSize;
          if (b.showPhone && (userData?.phoneNumber || user?.phoneNumber)) {
            ctx.font = `bold ${fontSize * 0.6}px ${FONT_STACK}`;
            const phone = userData?.phoneNumber || user?.phoneNumber || '';
            const phoneWidth = ctx.measureText(phone).width;
            textBlockWidth = Math.max(textBlockWidth, phoneWidth);
            textBlockHeight += fontSize * 0.8;
          }
        }

        let blockWidth = size;
        let blockHeight = size;

        if (b.layout === 'vertical') {
          blockWidth = Math.max(size, textBlockWidth);
          blockHeight = size + (textBlockWidth > 0 ? gap + textBlockHeight : 0);
        } else {
          blockWidth = size + (textBlockWidth > 0 ? gap + textBlockWidth : 0);
          blockHeight = Math.max(size, textBlockHeight);
        }

        let startX = 0;
        let startY = 0;

        switch (b.position) {
          case 'top-left':
            startX = margin;
            startY = margin;
            break;
          case 'top-right':
            startX = canvas.width - margin - blockWidth;
            startY = margin;
            break;
          case 'bottom-left':
            startX = margin;
            startY = canvas.height - margin - blockHeight;
            break;
          case 'bottom-right':
            startX = canvas.width - margin - blockWidth;
            startY = canvas.height - margin - blockHeight;
            break;
          case 'top-center':
            startX = (canvas.width - blockWidth) / 2;
            startY = margin;
            break;
          case 'bottom-center':
          default:
            startX = (canvas.width - blockWidth) / 2;
            startY = canvas.height - margin - blockHeight;
            break;
        }

        if (b.layout === 'vertical') {
          imgX = startX + blockWidth / 2;
          imgY = startY + size / 2;
          textX = startX + blockWidth / 2;
          textY = startY + size + gap + textBlockHeight / 2;
        } else {
          imgX = startX + size / 2;
          imgY = startY + blockHeight / 2;
          textX = startX + size + gap + textBlockWidth / 2;
          textY = startY + blockHeight / 2;
        }
      }

      // Draw User Image
      const drawX = imgX - size/2;
      const drawY = imgY - size/2;

      ctx.save();
      if (b.imageStyle === 'circle') {
        ctx.beginPath();
        ctx.arc(imgX, imgY, size / 2, 0, Math.PI * 2);
        ctx.clip();
      } else if (b.imageStyle === 'rounded') {
        ctx.beginPath();
        const r = size * 0.2;
        if (ctx.roundRect) {
          ctx.roundRect(drawX, drawY, size, size, r);
        } else {
          // Fallback for roundRect
          ctx.moveTo(drawX + r, drawY);
          ctx.lineTo(drawX + size - r, drawY);
          ctx.quadraticCurveTo(drawX + size, drawY, drawX + size, drawY + r);
          ctx.lineTo(drawX + size, drawY + size - r);
          ctx.quadraticCurveTo(drawX + size, drawY + size, drawX + size - r, drawY + size);
          ctx.lineTo(drawX + r, drawY + size);
          ctx.quadraticCurveTo(drawX, drawY + size, drawX, drawY + size - r);
          ctx.lineTo(drawX, drawY + r);
          ctx.quadraticCurveTo(drawX, drawY, drawX + r, drawY);
        }
        ctx.clip();
      } else if (b.imageStyle === 'hexagon') {
        ctx.beginPath();
        ctx.moveTo(drawX + size * 0.25, drawY);
        ctx.lineTo(drawX + size * 0.75, drawY);
        ctx.lineTo(drawX + size, drawY + size * 0.5);
        ctx.lineTo(drawX + size * 0.75, drawY + size);
        ctx.lineTo(drawX + size * 0.25, drawY + size);
        ctx.lineTo(drawX, drawY + size * 0.5);
        ctx.closePath();
        ctx.clip();
      } else if (b.imageStyle === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(drawX + size * 0.5, drawY);
        ctx.lineTo(drawX + size, drawY + size * 0.5);
        ctx.lineTo(drawX + size * 0.5, drawY + size);
        ctx.lineTo(drawX, drawY + size * 0.5);
        ctx.closePath();
        ctx.clip();
      } else if (b.imageStyle === 'star') {
        const cx = imgX;
        const cy = imgY;
        const spikes = 5;
        const outerRadius = size / 2;
        const innerRadius = size / 4;
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
          x = cx + Math.cos(rot) * outerRadius;
          y = cy + Math.sin(rot) * outerRadius;
          ctx.lineTo(x, y);
          rot += step;
          x = cx + Math.cos(rot) * innerRadius;
          y = cy + Math.sin(rot) * innerRadius;
          ctx.lineTo(x, y);
          rot += step;
        }
        ctx.closePath();
        ctx.clip();
      } else if (b.imageStyle === 'shield') {
        ctx.beginPath();
        ctx.moveTo(imgX, drawY);
        ctx.lineTo(drawX + size, drawY + size * 0.2);
        ctx.lineTo(drawX + size, drawY + size * 0.7);
        ctx.quadraticCurveTo(drawX + size, drawY + size, imgX, drawY + size);
        ctx.quadraticCurveTo(drawX, drawY + size, drawX, drawY + size * 0.7);
        ctx.lineTo(drawX, drawY + size * 0.2);
        ctx.closePath();
        ctx.clip();
      }
      
      if (userImg) {
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10 * scale;
        ctx.drawImage(userImg, drawX, drawY, size, size);
      } else {
        // Placeholder for missing user image
        ctx.fillStyle = b.backgroundColor || '#F27D26';
        ctx.fillRect(drawX, drawY, size, size);
        ctx.fillStyle = b.textColor || '#ffffff';
        ctx.font = `bold ${size * 0.5}px ${FONT_STACK}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initial = (userData?.displayName || 'U').charAt(0).toUpperCase();
        ctx.fillText(initial, imgX, imgY);
      }
      ctx.restore();

      // Draw Text
      if (b.showName || b.showPhone) {
        ctx.save();
        ctx.fillStyle = b.textColor || '#ffffff';
        ctx.textAlign = (b.position !== 'custom' && b.layout === 'horizontal') ? 'left' : 'center';
        ctx.textBaseline = 'middle';
        
        let currentTextX = textX;
        if (b.position !== 'custom' && b.layout === 'horizontal') {
          currentTextX = textX - textBlockWidth / 2;
        }
        
        if (b.textOutlineColor) {
          ctx.strokeStyle = b.textOutlineColor;
          ctx.lineWidth = 2 * scale;
        }

        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 15 * scale;
        ctx.shadowOffsetX = 3 * scale;
        ctx.shadowOffsetY = 3 * scale;

        let totalHeight = 0;
        if (b.showName) totalHeight += fontSize;
        if (b.showPhone && (userData?.phoneNumber || user?.phoneNumber)) totalHeight += fontSize * 0.8;
        
        let currentTextY = textY - totalHeight / 2 + fontSize / 2;
        
        if (b.showName) {
          ctx.font = `900 ${fontSize}px ${FONT_STACK}`;
          const name = (userData?.displayName || user?.displayName || 'User').toUpperCase();
          if (b.textOutlineColor) {
            ctx.strokeStyle = b.textOutlineColor;
            ctx.lineWidth = 4 * scale; // Thicker outline
            ctx.strokeText(name, currentTextX, currentTextY);
          }
          ctx.fillText(name, currentTextX, currentTextY);
          currentTextY += fontSize * 0.8 + (10 * scale);
        }

        if (b.showPhone && (userData?.phoneNumber || user?.phoneNumber)) {
          ctx.font = `bold ${fontSize * 0.6}px ${FONT_STACK}`;
          const phone = userData?.phoneNumber || user?.phoneNumber || '';
          if (b.textOutlineColor) {
            ctx.strokeStyle = b.textOutlineColor;
            ctx.lineWidth = 3 * scale;
            ctx.strokeText(phone, currentTextX, currentTextY);
          }
          ctx.fillText(phone, currentTextX, currentTextY);
        }
        ctx.restore();
      }
      ctx.restore();
    } catch (e) {
      console.error("Error in drawBranding:", e);
    }
  };

    // Remove Site Watermark
    // const watermarkSize = Math.max(12, Math.floor(canvas.width / 50));
    // ctx.font = `bold ${watermarkSize}px Inter, sans-serif`;
    // ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    // ctx.textAlign = 'right';
    // ctx.fillText("108counter.site", canvas.width - 20, canvas.height - 20);

  const generateBrandedMediaBlob = async (onProgress?: (progress: number) => void): Promise<{ blob: Blob, ext: string, mimeType: string } | null> => {
    if (!quote.imageUrl && !quote.videoUrl) return null;
    
    const brandingData = currentUserData || userData || { displayName: user?.displayName || 'User', photoURL: user?.photoURL || undefined };

    console.log("Branding Data Check:", { 
      hasCurrentUserData: !!currentUserData,
      hasUserData: !!userData, 
      hasUser: !!user, 
      photo: brandingData.photoURL,
      name: brandingData.displayName,
      branding: quote.branding
    });

    // Pre-load user image
    let userImgToDraw: HTMLImageElement | null = null;
    if (brandingData.photoURL) {
      userImgToDraw = new Image();
      userImgToDraw.crossOrigin = "anonymous";
      userImgToDraw.src = brandingData.photoURL;
      console.log("Loading user image from:", userImgToDraw.src);
      await new Promise((resolve) => {
        userImgToDraw!.onload = () => {
          console.log("User image loaded successfully");
          resolve(null);
        };
        userImgToDraw!.onerror = (e) => { 
          console.error("User image failed to load:", e);
          userImgToDraw = null; 
          resolve(null); 
        };
      });
    }

    if (quote.videoUrl) {
      // FAST SYSTEM: Use ImageKit Video Overlays if it's an ImageKit URL
      const ikEndpoint = (import.meta as any).env.VITE_IMAGEKIT_URL_ENDPOINT || '';
      const isInternalVideo = quote.videoUrl?.startsWith(ikEndpoint) || quote.videoUrl?.includes('ik.imagekit.io');
      
      // Check circuit breaker
      const isFastSystemAllowed = Date.now() > fastSystemDisabledUntil;

      if (isInternalVideo && quote.branding && isFastSystemAllowed) {
        try {
          if (onProgress) onProgress(0.1);
          console.log("Using Fast ImageKit Overlay System");
          
          // 1. Create a transparent canvas for the branding overlay
          const video = document.createElement('video');
          video.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Video load timeout")), 15000);
            video.src = quote.videoUrl!;
            const checkDimensions = () => {
              if (video.videoWidth > 0 && video.videoHeight > 0) {
                clearTimeout(timeout);
                resolve(null);
              }
            };
            video.onloadedmetadata = checkDimensions;
            video.oncanplay = checkDimensions;
            video.onerror = (e) => {
              clearTimeout(timeout);
              reject(e);
            };
          });

          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          console.log("Canvas dimensions for overlay:", canvas.width, "x", canvas.height);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not get canvas context');

          // 2. Draw branding on the transparent canvas
          drawBranding(ctx, canvas, quote.branding, brandingData, userImgToDraw);
          if (onProgress) onProgress(0.3);

          // 3. Convert to Base64 and upload to server
          const base64Overlay = canvas.toDataURL('image/png');
          console.log("Overlay data URL length:", base64Overlay.length);
          
          const uploadResponse = await fetch('/api/imagekit/upload-overlay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file: base64Overlay,
              fileName: `overlay_${quote.id}_${Date.now()}.png`
            })
          });

          if (!uploadResponse.ok) {
            if (uploadResponse.status === 403) {
              throw new Error('ImageKit upload limit exceeded (403)');
            }
            throw new Error('Overlay upload failed');
          }
          const uploadResult = await uploadResponse.json();
          const overlayPath = uploadResult.filePath; // e.g. "overlays/img.png"
          if (onProgress) onProgress(0.5);

          const ikEndpoint = (import.meta as any).env.VITE_IMAGEKIT_URL_ENDPOINT || '';
          const isInternalVideo = quote.videoUrl?.startsWith(ikEndpoint);
          
          if (!isInternalVideo) {
            console.log("External video detected, skipping fast system to avoid 404...");
            throw new Error('External video - skipping fast system');
          }

          // 4. Construct transformed URL
          // Use path-based transformation for maximum reliability
          const escapedPath = uploadResult.filePath.replace(/^\//, '').replace(/\//g, '@@');
          // Use w-1.0, h-1.0 for relative scaling to video size
          const transformation = `tr:l-image,i-${escapedPath},w-1.0,h-1.0,lx-0,ly-0,l-end`;
          
          let transformedUrl = "";
          try {
            const urlObj = new URL(quote.videoUrl);
            const pathSegments = urlObj.pathname.split('/').filter(Boolean);
            
            if (urlObj.hostname.includes('ik.imagekit.io') && pathSegments.length >= 1) {
              const ikId = pathSegments[0];
              // Check if there's already a transformation segment
              const trIndex = pathSegments.findIndex(s => s.startsWith('tr:'));
              
              if (trIndex !== -1) {
                // Append to existing transformation
                pathSegments[trIndex] = `${pathSegments[trIndex]},${transformation.replace('tr:', '')}`;
              } else {
                // Insert after ikId
                pathSegments.splice(1, 0, transformation);
              }
              
              transformedUrl = `${urlObj.protocol}//${urlObj.host}/${pathSegments.join('/')}${urlObj.search}`;
            } else {
              // Fallback to query param
              transformedUrl = `${quote.videoUrl}${quote.videoUrl.includes('?') ? '&' : '?'}tr=${transformation.replace('tr:', '')}`;
            }
          } catch (e) {
            transformedUrl = `${quote.videoUrl}${quote.videoUrl.includes('?') ? '&' : '?'}tr=${transformation.replace('tr:', '')}`;
          }
          
          // Add cache buster and ensure it's a fresh request
          transformedUrl += (transformedUrl.includes('?') ? '&' : '?') + `v=${Date.now()}`;
          console.log("Transformed Video URL:", transformedUrl);

          // 5. Verify overlay availability before fetching transformed video
          if (onProgress) onProgress(0.6);
          let overlayReady = false;
          for (let i = 0; i < 8; i++) { // Increased check attempts
            try {
              // Use a cache-busting query param for the overlay check too
              const checkRes = await fetch(`${uploadResult.url}?v=${Date.now()}`, { method: 'HEAD', cache: 'no-cache' });
              if (checkRes.ok) {
                overlayReady = true;
                break;
              }
            } catch (e) {
              console.warn("Overlay check failed, retrying...", e);
            }
            await new Promise(resolve => setTimeout(resolve, 1500));
          }

          if (!overlayReady) {
            console.warn("Overlay not ready after 12s, proceeding anyway but might fail...");
          }

          // 6. Fetch the final video with retries
          if (onProgress) onProgress(0.7);
          let videoResponse: Response | null = null;
          let lastError = "";
          
          // Initial delay to let ImageKit process the transformation
          await new Promise(resolve => setTimeout(resolve, 3000));

          for (let i = 0; i < 5; i++) {
            try {
              videoResponse = await fetch(transformedUrl);
              if (videoResponse.ok) break;
              
              const errorText = await videoResponse.text();
              lastError = `Status ${videoResponse.status}: ${errorText}`;
              console.warn(`Fetch attempt ${i+1} failed.`, lastError);

              // If limit exceeded (403), don't retry, just fall back immediately
              if (videoResponse.status === 403) {
                console.warn("ImageKit transformation limit exceeded. Falling back to recorder immediately.");
                throw new Error("ImageKit limit exceeded (403)");
              }
              
              // If it's a 404, maybe the path-based URL failed, try query-based as last resort
              if (videoResponse.status === 404 && i === 2) {
                console.log("Switching to query-based transformation fallback...");
                transformedUrl = `${quote.videoUrl}${quote.videoUrl.includes('?') ? '&' : '?'}tr=${transformation.replace('tr:', '')}&v=${Date.now()}`;
              }
              
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (e) {
              lastError = e instanceof Error ? e.message : String(e);
              if (lastError.includes("403")) throw e; // Re-throw to trigger fallback
              console.warn(`Fetch attempt ${i+1} errored. Retrying in 2s...`, lastError);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }

          if (!videoResponse || !videoResponse.ok) {
            if (videoResponse?.status === 403) {
              // Disable fast system for 10 minutes if limit hit
              fastSystemDisabledUntil = Date.now() + 10 * 60 * 1000;
              console.warn("ImageKit limit hit. Disabling fast system for 10 mins.");
            }
            throw new Error(`Failed to fetch transformed video after retries. Last error: ${lastError}`);
          }
          
          const blob = await videoResponse.blob();
          if (onProgress) onProgress(1.0);
          
          return { blob, ext: 'mp4', mimeType: 'video/mp4' };
        } catch (err) {
          console.error("Fast system failed, falling back to recorder:", err);
          // Fallback to old recorder system below
        }
      }

      // FALLBACK: High-Speed Seeking Recorder (Fast & Works in Background)
      // OPTIMIZATION: Pre-render branding once to speed up frame processing
      const brandingCanvas = document.createElement('canvas');
      const brandingCtx = brandingCanvas.getContext('2d');
      
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.playsInline = true;
      video.muted = true; 
      video.loop = false;
      
      console.log("Starting video load for high-speed recording:", quote.videoUrl);
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Video load timeout")), 20000);
        video.src = quote.videoUrl!;
        video.oncanplay = () => {
          clearTimeout(timeout);
          resolve(null);
        };
        video.onerror = (e) => {
          clearTimeout(timeout);
          reject(e);
        };
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return null;

      // Pre-render branding to its own canvas at the correct scale
      if (quote.branding && brandingCtx) {
        brandingCanvas.width = canvas.width;
        brandingCanvas.height = canvas.height;
        drawBranding(brandingCtx, brandingCanvas, quote.branding, brandingData, userImgToDraw);
      }

      const FPS = 24; // Reduced from 30 to speed up processing by 20%
      const videoStream = canvas.captureStream(FPS);
      
      const recorder = new MediaRecorder(videoStream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000 
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      return new Promise(async (resolve, reject) => {
        let isStopped = false;
        
        // Safety timeout increased to 180s to handle longer videos or slow devices
        const processTimeout = setTimeout(() => {
          if (!isStopped) {
            isStopped = true;
            recorder.stop();
            reject(new Error("Recording timed out (180s limit)"));
          }
        }, 180000);

        recorder.onstop = async () => {
          isStopped = true;
          clearTimeout(processTimeout);
          videoStream.getTracks().forEach(track => track.stop());
          const webmBlob = new Blob(chunks, { type: 'video/webm' });
          resolve({ blob: webmBlob, ext: 'webm', mimeType: 'video/webm' });
        };

        try {
          recorder.start();
          
          const frameDuration = 1 / FPS;
          let currentTime = 0;
          const duration = video.duration;

          while (currentTime < duration && !isStopped) {
            video.currentTime = currentTime;
            
            // Wait for the frame to be ready
            await new Promise((resolveSeek) => {
              let seekTimeout: NodeJS.Timeout;
              const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                clearTimeout(seekTimeout);
                // Increased delay to ensure frame is fully painted to buffer
                setTimeout(() => resolveSeek(null), 150); 
              };
              video.addEventListener('seeked', onSeeked);
              seekTimeout = setTimeout(onSeeked, 600); 
            });

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Draw pre-rendered branding overlay
            if (quote.branding && brandingCanvas.width > 0) {
              ctx.drawImage(brandingCanvas, 0, 0);
            }
            
            if (onProgress) {
              onProgress(currentTime / duration);
            }

            currentTime += frameDuration;
            // Breathe more frequently and longer to ensure stability
            if (Math.floor(currentTime * FPS) % 5 === 0) {
              await new Promise(r => setTimeout(r, 50));
            }
          }

          if (!isStopped) {
            recorder.stop();
          }
        } catch (e) {
          isStopped = true;
          clearTimeout(processTimeout);
          recorder.stop();
          reject(e);
        }
      });
    }

    if (!quote.imageUrl) return null;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = quote.imageUrl;
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);

    if (quote.branding) {
      drawBranding(ctx, canvas, quote.branding, brandingData, userImgToDraw);
    }

    if (onProgress) onProgress(1);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve({ blob, ext: 'jpg', mimeType: 'image/jpeg' });
        } else {
          resolve(null);
        }
      }, 'image/jpeg', 0.9); // Higher quality
    });
  };

  const handleDownload = async () => {
    console.log('Download clicked');
    if (!user) {
      console.log('Not logged in, triggering login');
      await signInWithPopup(auth, googleProvider);
      return;
    }

    // Check Subscription and Limits
    const isSubscribed = (currentUserData as any)?.isSubscribed || (currentUserData as any)?.role === 'admin' || (currentUserData as any)?.role === 'sub-admin';
    const downloadCredits = (currentUserData as any)?.downloadCredits ?? 0;
    
    if (!isSubscribed && downloadCredits <= 0) {
      setShowPaymentModal(true);
      return;
    }

    if (!quote.imageUrl) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    
    try {
      const media = await generateBrandedMediaBlob((progress) => {
        setDownloadProgress(Math.round(progress * 100));
      });
      if (!media) throw new Error("Failed to generate media");
      
      const url = URL.createObjectURL(media.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quote-${quote.id}.${media.ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      const quoteDoc = doc(db, 'quotes', quote.id!);
      await updateDoc(quoteDoc, { downloadsCount: increment(1) });

      // Track total downloads and decrement credit if they have any and are not subscribed
      const userRef = doc(db, 'users', user.uid);
      const updates: any = { downloadsCount: increment(1) };
      if (!isSubscribed && downloadCredits > 0) {
        updates.downloadCredits = increment(-1);
      }
      await updateDoc(userRef, updates);
    } catch (err) {
      console.error('Download failed:', err);
      if (quote.imageUrl) {
        window.open(quote.imageUrl, '_blank');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    console.log('Share clicked');
    if (!user) {
      console.log('Not logged in, triggering login');
      await signInWithPopup(auth, googleProvider);
      return;
    }

    // Check Subscription and Limits
    const isSubscribed = (currentUserData as any)?.isSubscribed || (currentUserData as any)?.role === 'admin' || (currentUserData as any)?.role === 'sub-admin';
    const shareCredits = (currentUserData as any)?.shareCredits ?? 0;

    if (!isSubscribed && shareCredits <= 0) {
      setShowPaymentModal(true);
      return;
    }

    if (!navigator.share) {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
      
      // Track total shares and decrement credit if they have any and are not subscribed
      const userRef = doc(db, 'users', user.uid);
      const updates: any = { sharesCount: increment(1) };
      if (!isSubscribed && shareCredits > 0) {
        updates.shareCredits = increment(-1);
      }
      await updateDoc(userRef, updates);
      return;
    }

    setIsSharing(true);
    setDownloadProgress(0);
    try {
      let shareData: ShareData = {};

      if (quote.imageUrl) {
        const media = await generateBrandedMediaBlob((progress) => {
          setDownloadProgress(Math.round(progress * 100));
        });
        if (media) {
          const file = new File([media.blob], `quote-${quote.id}.${media.ext}`, { type: media.mimeType });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            shareData.files = [file];
          } else {
            shareData.url = window.location.href;
          }
        } else {
          shareData.url = window.location.href;
        }
      } else {
        shareData.url = window.location.href;
      }

      await navigator.share(shareData);

      // Track total shares and decrement credit if they have any and are not subscribed
      const userRef = doc(db, 'users', user.uid);
      const updates: any = { sharesCount: increment(1) };
      if (!isSubscribed && shareCredits > 0) {
        updates.shareCredits = increment(-1);
      }
      await updateDoc(userRef, updates);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error sharing:', err);
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <motion.div 
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card rounded-none overflow-hidden flex flex-col relative group hover:border-[#F27D26]/30 transition-all duration-500 bg-white dark:bg-[#000000]"
    >
      {quote.imageUrl && (
        <div className="relative w-full overflow-hidden bg-gray-100 dark:bg-black flex flex-col justify-center">
          <div className="relative w-full h-auto flex items-center justify-center">
            <div className="relative max-w-full h-auto flex items-center justify-center">
              <>
                {!imageLoaded && !imageError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-30">
                    <div className="relative w-12 h-12 mb-4">
                      <div className="absolute inset-0 border-4 border-[#F27D26]/20 rounded-full" />
                      <div className="absolute inset-0 border-4 border-[#F27D26] border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-[10px] text-white/70 font-bold uppercase tracking-[0.3em] animate-pulse">Loading Image...</p>
                  </div>
                )}
                {imageError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl z-30 p-6 text-center">
                    <div className="w-12 h-12 mb-4 text-red-500/50">
                      <Camera size={48} strokeWidth={1} />
                    </div>
                    <p className="text-sm text-white/80 font-bold mb-2">Image Load Failed</p>
                    <p className="text-xs text-white/40">The image could not be loaded. Please check your connection or try again later.</p>
                  </div>
                )}
                <img 
                  ref={imageRef}
                  src={quote.imageUrl} 
                  alt={quote.category}
                  onLoad={() => {
                    setImageLoaded(true);
                    setImageError(false);
                    const rect = imageRef.current?.getBoundingClientRect();
                    if (rect) setMediaDimensions({ width: rect.width, height: rect.height });
                  }}
                  onError={() => {
                    setImageError(true);
                    setImageLoaded(false);
                  }}
                  className={`w-full max-h-[calc(100dvh-280px)] object-contain bg-black transition-all duration-1000 ${imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
                  referrerPolicy="no-referrer"
                />
              </>
              
              {imageLoaded && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
                  <div style={{ width: mediaDimensions.width, height: mediaDimensions.height }} className="relative pointer-events-none">
                    <BrandingOverlay 
                      branding={quote.branding} 
                      userData={currentUserData || userData} 
                      isMobile={window.innerWidth < 768} 
                      isVideo={false} 
                      width={mediaDimensions.width} 
                      onClick={() => {
                        const hasPhoto = (currentUserData || userData)?.photoURL;
                        handleOpenEditModal(hasPhoto ? 'full' : 'photo');
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="absolute top-4 right-4 flex flex-col gap-2 z-50 opacity-0 group-hover:opacity-100 transition-all duration-300">
            <button 
              onClick={handleShare}
              className="p-3 bg-blue-500 rounded-2xl text-white shadow-lg hover:scale-110 transition-transform relative"
              title="Share"
            >
              <Share2 size={20} />
              {(!currentUserData || !((currentUserData as any)?.isSubscribed || (currentUserData as any)?.role === 'admin' || (currentUserData as any)?.role === 'sub-admin')) && (
                <div className="absolute -top-2 -right-2 bg-yellow-500 text-white p-1 rounded-full shadow-md">
                  <Crown size={10} fill="currentColor" />
                </div>
              )}
            </button>
            <button 
              onClick={() => handleOpenEditModal('photo')}
              className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white shadow-lg hover:scale-110 transition-transform"
              title="Apni photo badle"
            >
              <Camera size={20} />
            </button>
            <button 
              onClick={() => handleOpenEditModal('full')}
              className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white shadow-lg hover:scale-110 transition-transform"
              title="Edit Profile"
            >
              <User size={20} />
            </button>
            {quote.imageUrl && (
              <button 
                onClick={handleDownload}
                disabled={isDownloading}
                className="p-3 bg-[#F27D26] rounded-2xl text-white shadow-lg hover:scale-110 transition-transform disabled:opacity-50 relative"
                title="Download Image"
              >
                {isDownloading ? (
                  <span className="text-xs font-bold">{downloadProgress}%</span>
                ) : (
                  <Download size={20} />
                )}
                {(!currentUserData || !((currentUserData as any)?.isSubscribed || (currentUserData as any)?.role === 'admin' || (currentUserData as any)?.role === 'sub-admin')) && (
                  <div className="absolute -top-2 -right-2 bg-yellow-500 text-white p-1 rounded-full shadow-md">
                    <Crown size={10} fill="currentColor" />
                  </div>
                )}
              </button>
            )}
          </div>
          
          {(isDownloading || isSharing) && (
            <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-40">
              <div className="w-16 h-16 border-4 border-[#F27D26] border-t-transparent rounded-full animate-spin mb-4 flex items-center justify-center">
                <span className="text-xs font-bold text-[#F27D26]">{downloadProgress}%</span>
              </div>
              <p className="text-gray-900 dark:text-white font-bold text-sm">Preparing Media...</p>
              <p className="text-gray-500 dark:text-[#8E9299] text-[10px] mt-1">Adding Branding & Optimizing</p>
            </div>
          )}
        </div>
      )}
      
      <div className="p-4 md:p-6 flex flex-col justify-center items-center text-center bg-white dark:bg-[#000000]">
        {quote.text && (
          <p className="text-base md:text-lg font-medium leading-relaxed mb-4">
            {quote.text}
          </p>
        )}

        <div className="flex items-center gap-2 pt-3 w-full relative z-20">
          <button 
            onClick={handleShare}
            className="flex-1 flex items-center justify-center py-3 rounded-2xl transition-all font-bold bg-blue-500 text-white hover:bg-blue-600 shadow-md relative"
            title="Share"
          >
            <Share2 size={20} />
            {(!currentUserData || !((currentUserData as any)?.isSubscribed || (currentUserData as any)?.role === 'admin' || (currentUserData as any)?.role === 'sub-admin')) && (
              <div className="absolute -top-2 -right-2 bg-yellow-500 text-white p-1 rounded-full shadow-md">
                <Crown size={12} fill="currentColor" />
              </div>
            )}
          </button>

          <button 
            onClick={() => handleOpenEditModal('full')}
            className="flex-1 flex items-center justify-center py-3 rounded-2xl transition-all font-bold bg-[#F27D26] text-white hover:bg-[#e06b1d] shadow-md"
            title="Edit Profile"
          >
            <Edit size={20} />
          </button>

          <button 
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex-1 flex items-center justify-center py-3 rounded-2xl transition-all font-bold bg-white dark:bg-black text-black dark:text-white shadow-sm hover:bg-gray-50 dark:hover:bg-white/5 relative"
          >
            {isDownloading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download size={20} />
            )}
            {(!currentUserData || !((currentUserData as any)?.isSubscribed || (currentUserData as any)?.role === 'admin' || (currentUserData as any)?.role === 'sub-admin')) && (
              <div className="absolute -top-2 -right-2 bg-yellow-500 text-white p-1 rounded-full shadow-md">
                <Crown size={12} fill="currentColor" />
              </div>
            )}
          </button>

          <button 
            onClick={() => handleOpenEditModal('photo')}
            className="flex-1 flex items-center justify-center py-3 rounded-2xl transition-all font-bold bg-purple-500 text-white hover:bg-purple-600 shadow-md text-[10px] uppercase"
            title="फोटो बदलें"
          >
            <Camera size={18} className="mr-1" /> फोटो बदलें
          </button>
        </div>
        
        <CommentSection quoteId={quote.id!} forceShow={showComments} />
        <EditProfileModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} mode={editModalMode} />
        <PaymentModal 
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            // Success logic if needed
          }}
        />
      </div>
    </motion.div>
  );
};
