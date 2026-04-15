import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, setDoc, handleFirestoreError, collectionGroup, getDocs, where, storage, getBlob, getDoc } from '../firebase';
import { Quote, OperationType, Comment, Category } from '../types';
import { Plus, Trash2, Edit2, X, Save, Image as ImageIcon, Quote as QuoteIcon, Flame, MessageCircle, Filter, List, AlertTriangle, Tag, Users, User, Star, Upload, CheckSquare, Square, Download, ChevronDown, MoreVertical, UploadCloud, Share2, ChevronLeft, ChevronRight, CreditCard, Mail, Settings } from 'lucide-react';
import { IKContext, IKUpload } from 'imagekitio-react';
import { imagekitConfig } from '../imagekit';
import { ref } from 'firebase/storage';
import { BrandingOverlay } from './BrandingOverlay';
import { BrandingConfig } from '../types';

export const AdminPanel: React.FC = () => {
  const [user] = useAuthState(auth);
  const [activeTab, setActiveTab] = useState<'quotes' | 'users' | 'database' | 'categories' | 'payments' | 'settings'>('quotes');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [subAdminEmail, setSubAdminEmail] = useState('');
  const [userRole, setUserRole] = useState<string>('user');
  const [isMainAdmin, setIsMainAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    setIsMainAdmin(user.email?.toLowerCase() === 'ig.mukesh12@gmail.com');
    
    const unsubRole = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setUserRole(doc.data().role || 'user');
      }
    });
    return () => unsubRole();
  }, [user]);

  useEffect(() => {
    if (!isMainAdmin && userRole !== 'admin') {
      if (activeTab === 'users') {
        setActiveTab('quotes');
      }
    }
  }, [isMainAdmin, userRole, activeTab]);

  useEffect(() => {
    if (!isMainAdmin && userRole !== 'admin') return;
    
    // Fetch users
    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const filteredUsers = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(u => u.email?.toLowerCase() !== 'ig.mukesh12@gmail.com');
      setUsersList(filteredUsers);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    return () => {
      unsubUsers();
    };
  }, [isMainAdmin, userRole]);
  const [dbCategories, setDbCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryImageUrl, setNewCategoryImageUrl] = useState('');
  const [newCategoryStartTime, setNewCategoryStartTime] = useState('');
  const [newCategoryEndTime, setNewCategoryEndTime] = useState('');
  const [newCategoryParentId, setNewCategoryParentId] = useState('');
  const [newCategoryIsMain, setNewCategoryIsMain] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const isCategoryActive = (cat: Category) => {
    if (!cat.startTime || !cat.endTime) return false;
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startH, startM] = cat.startTime.split(':').map(Number);
    const [endH, endM] = cat.endTime.split(':').map(Number);
    
    const startTime = startH * 60 + startM;
    const endTime = endH * 60 + endM;
    
    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overlap midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  };

  const sortedCategories = [...dbCategories].sort((a, b) => {
    const aActive = isCategoryActive(a);
    const bActive = isCategoryActive(b);
    
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    
    // Both active or both inactive, sort by order
    return (a.order || 999) - (b.order || 999);
  });
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ikPublicKey, setIkPublicKey] = useState('');
  const [ikUrlEndpoint, setIkUrlEndpoint] = useState('');
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpaySecret, setRazorpaySecret] = useState('');
  const [confirmCount, setConfirmCount] = useState(0);
  const [paymentSettings, setPaymentSettings] = useState<any>({
    subscriptionPrice: 99,
    freeDownloadsLimit: 3,
    razorpayKeyId: 'rzp_test_Sdb9QzH1sFzGWW'
  });
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [freeSubEmail, setFreeSubEmail] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      const docSnap = await getDoc(doc(db, 'settings', 'payment'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRazorpayKeyId(data.razorpayKeyId || '');
        setRazorpaySecret(data.razorpaySecret || '');
      }
      const ikSnap = await getDoc(doc(db, 'settings', 'imagekit'));
      if (ikSnap.exists()) {
        const data = ikSnap.data();
        setIkPublicKey(data.publicKey || '');
        setIkUrlEndpoint(data.urlEndpoint || '');
      }
    };
    if (activeTab === 'settings') fetchSettings();
  }, [activeTab]);

  const handleUpdateSettings = async () => {
    if (confirmCount < 2) {
      setConfirmCount(prev => prev + 1);
      setSuccess(`Confirm ${3 - (confirmCount + 1)} more times to update.`);
      return;
    }
    
    try {
      await setDoc(doc(db, 'settings', 'payment'), { razorpayKeyId, razorpaySecret }, { merge: true });
      await setDoc(doc(db, 'settings', 'imagekit'), { publicKey: ikPublicKey, urlEndpoint: ikUrlEndpoint }, { merge: true });
      setSuccess("Settings updated successfully!");
      setConfirmCount(0);
    } catch (err) {
      setError("Failed to update settings.");
    }
  };

  const maskKey = (key: string) => {
    if (!key) return '****';
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
  };

  useEffect(() => {
    if (!isMainAdmin && userRole !== 'admin') return;

    // Initialize payment settings if missing
    const initSettings = async () => {
      const docRef = doc(db, 'settings', 'payment');
      const docSnap = await getDocs(query(collection(db, 'settings'), where('__name__', '==', 'payment')));
      if (docSnap.empty) {
        await setDoc(docRef, {
          subscriptionPrice: 99,
          freeDownloadsLimit: 3,
          razorpayKeyId: 'rzp_test_Sdb9QzH1sFzGWW'
        });
      }
    };
    initSettings();

    // Fetch payment settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'payment'), (doc) => {
      if (doc.exists()) {
        setPaymentSettings(doc.data());
      }
    });

    // Fetch subscriptions
    const qSubs = query(collection(db, 'subscriptions'), orderBy('createdAt', 'desc'));
    const unsubSubs = onSnapshot(qSubs, (snapshot) => {
      setSubscriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubSettings();
      unsubSubs();
    };
  }, [isMainAdmin, userRole]);

  const handleUpdatePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'settings', 'payment'), paymentSettings);
      setSuccess("Payment settings updated successfully!");
    } catch (err: any) {
      setError(`Failed to update settings: ${err.message}`);
    }
  };

  const handleGrantFreeSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freeSubEmail.trim()) return;
    try {
      const q = query(collection(db, 'users'), where('email', '==', freeSubEmail.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        setError("User not found with this email.");
        return;
      }
      const userDoc = snap.docs[0];
      await updateDoc(doc(db, 'users', userDoc.id), {
        isSubscribed: true,
        freeSubscription: true,
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
      });
      setSuccess(`Free subscription granted to ${freeSubEmail}`);
      setFreeSubEmail('');
    } catch (err: any) {
      setError(`Failed to grant subscription: ${err.message}`);
    }
  };
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [confirmDelete, setConfirmDelete] = useState<{
    id?: string;
    ids?: string[];
    collection: string;
    quoteId?: string;
    step: 1 | 2;
    isBulk?: boolean;
  } | null>(null);

  const [deleteAllQuotesStep, setDeleteAllQuotesStep] = useState(0);
  
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isIKConfigured, setIsIKConfigured] = useState(false);

  useEffect(() => {
    setIsIKConfigured(!!imagekitConfig.publicKey && !!imagekitConfig.urlEndpoint);
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [fileUploadProgress, setFileUploadProgress] = useState<number>(0);
  const [quoteFiles, setQuoteFiles] = useState<File[]>([]);
  const [categoryFile, setCategoryFile] = useState<File | null>(null);
  const [bulkCategory, setBulkCategory] = useState('');
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [quoteFilter, setQuoteFilter] = useState('सभी');

  const [ikFiles, setIkFiles] = useState<any[]>([]);
  const [ikLoading, setIkLoading] = useState(false);
  const [ikSelectedFiles, setIkSelectedFiles] = useState<string[]>([]);
  const [ikSearch, setIkSearch] = useState('');
  const [ikFolder, setIkFolder] = useState('quotes');
  const [previewIndex, setPreviewIndex] = useState(0);
  const [brandingConfigs, setBrandingConfigs] = useState<BrandingConfig[]>([]);
  const [showIkDeleteConfirm, setShowIkDeleteConfirm] = useState(false);

  const [quoteForm, setQuoteForm] = useState<Partial<Quote>>({
    text: '',
    author: '',
    category: '',
    imageUrl: ''
  });

  const [brandingConfig, setBrandingConfig] = useState<BrandingConfig>({
    position: 'custom',
    imageX: 50,
    imageY: 80,
    textX: 50,
    textY: 90,
    layout: 'horizontal',
    imageStyle: 'circle',
    imageSize: 80,
    textSize: 32,
    showName: true,
    showPhone: true,
    showBackground: true,
    backgroundColor: '#F27D26',
    textColor: '#FFFFFF',
    opacity: 1
  });

  const [currentUserData, setCurrentUserData] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setCurrentUserData(doc.data());
      }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (dbCategories.length > 0 && !quoteForm.category) {
      setQuoteForm(prev => ({ ...prev, category: dbCategories[0].name }));
    }
  }, [dbCategories]);

  useEffect(() => {
    const qQuotes = query(collection(db, 'quotes'), orderBy('createdAt', 'desc'));

    const unsubQuotes = onSnapshot(qQuotes, (snapshot) => {
      const quotesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Quote[];
      const uniqueQuotes = Array.from(new Map(quotesData.map(q => [q.id, q])).values());
      setQuotes(uniqueQuotes);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'quotes');
      setIsLoading(false);
    });

    const qCats = query(collection(db, 'categories'));
    const unsubCats = onSnapshot(qCats, (snapshot) => {
      const catsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[];
      const uniqueCats = Array.from(new Map(catsData.map(c => [c.id, c])).values());
      const sortedCats = uniqueCats.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 999;
        const orderB = b.order !== undefined ? b.order : 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
      setDbCategories(sortedCats);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'categories');
    });

    return () => { unsubQuotes(); unsubCats(); };
  }, [isMainAdmin, userRole, user?.uid]);

  const handleBulkDelete = () => {
    if (selectedQuoteIds.length === 0) return;
    setConfirmDelete({ 
      ids: selectedQuoteIds, 
      collection: 'quotes', 
      step: 1, 
      isBulk: true 
    });
  };

  const handleBulkUpdateCategory = async () => {
    if (selectedQuoteIds.length === 0 || !bulkCategory) return;

    setError(null);
    setSuccess(null);
    try {
      const promises = selectedQuoteIds.map(id => updateDoc(doc(db, 'quotes', id), { category: bulkCategory }));
      await Promise.all(promises);
      setSuccess(`${selectedQuoteIds.length} quotes updated successfully`);
      setSelectedQuoteIds([]);
      setBulkCategory('');
      setShowBulkActions(false);
    } catch (err: any) {
      setError(`Failed to update quotes: ${err.message}`);
    }
  };

  const handleBulkDeleteQuotes = () => {
    if (selectedQuoteIds.length === 0) return;
    setConfirmDelete({ 
      ids: selectedQuoteIds, 
      collection: 'quotes', 
      step: 1, 
      isBulk: true 
    });
  };

  const toggleSelectQuote = (id: string) => {
    setSelectedQuoteIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedQuoteIds.length === quotes.length) {
      setSelectedQuoteIds([]);
    } else {
      setSelectedQuoteIds(quotes.map(q => q.id!));
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      let blob: Blob;
      // If it's a Firebase Storage URL, use getBlob for better CORS handling
      if (url.includes('firebasestorage.googleapis.com')) {
        const storageRef = ref(storage, url);
        blob = await getBlob(storageRef);
      } else {
        // Use our proxy to bypass CORS issues
        const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Network response was not ok');
        blob = await response.blob();
      }
      
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
      // Fallback to opening in new tab
      window.open(url, '_blank');
    }
  };

  const handleDeleteUser = async (uid: string, docId: string) => {
    try {
      // 1. Get user document to find photoURL
      const userDocRef = doc(db, 'users', docId);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.exists() ? userDoc.data() : null;

      // 2. Delete user document from Firestore
      await deleteDoc(userDocRef);
      
      // 3. If photoURL exists and is in our storage, delete it
      if (userData?.photoURL && userData.photoURL.includes('imagekit.io')) {
        // Since we are using ImageKit, we cannot delete directly via Firebase Storage.
        // ImageKit files are managed via ImageKit API, not Firebase Storage.
        // We will just proceed with resetting the Auth profile.
        console.log("ImageKit file deletion requires ImageKit API, skipping storage deletion.");
      } else if (userData?.photoURL && userData.photoURL.includes('firebasestorage.googleapis.com')) {
        // If it's in Firebase Storage, we can delete it
        try {
          const storageRef = ref(storage, userData.photoURL);
          await deleteObject(storageRef);
        } catch (storageErr) {
          console.error("Failed to delete profile image from storage:", storageErr);
        }
      }
      
      // 4. Reset Firebase Auth profile (displayName and photoURL)
      if (auth.currentUser && auth.currentUser.uid === uid) {
        await updateProfile(auth.currentUser, { displayName: '', photoURL: '' });
      }
      
      setSuccess("User data deleted successfully.");
    } catch (err: any) {
      setError(`Failed to delete user data: ${err.message}`);
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    
    setError(null);
    setSuccess(null);
    
    const { id, ids, collection: collectionName, quoteId, step, isBulk } = confirmDelete;
    
    if (step === 1) {
      setConfirmDelete({ ...confirmDelete, step: 2 });
      return;
    }
    
    try {
      if (isBulk && ids) {
        const promises = ids.map(id => deleteDoc(doc(db, collectionName, id)));
        await Promise.all(promises);
        setSuccess(`${ids.length} ${collectionName} deleted successfully`);
        setSelectedQuoteIds([]);
        setShowBulkActions(false);
      } else if (id) {
        if (collectionName === 'comments' && quoteId) {
          await deleteDoc(doc(db, 'quotes', quoteId, 'comments', id));
        } else {
          await deleteDoc(doc(db, collectionName, id));
        }
        setSuccess(`${collectionName.slice(0, -1)} deleted successfully`);
      }
      setConfirmDelete(null);
    } catch (err: any) {
      setError(`Failed to delete: ${err.message || 'Unknown error'}`);
      handleFirestoreError(err, OperationType.DELETE, isBulk ? `${collectionName}/bulk` : `${collectionName}/${id}`);
      setConfirmDelete(null);
    }
  };

  const handleDeleteAllQuotes = async () => {
    if (deleteAllQuotesStep < 2) {
      setDeleteAllQuotesStep(prev => prev + 1);
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      const promises = quotes.map(quote => deleteDoc(doc(db, 'quotes', quote.id!)));
      await Promise.all(promises);
      setSuccess("All quotes deleted successfully");
      setDeleteAllQuotesStep(0);
    } catch (err: any) {
      setError(`Failed to delete all quotes: ${err.message || 'Unknown error'}`);
      handleFirestoreError(err, OperationType.DELETE, 'quotes/all');
      setDeleteAllQuotesStep(0);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setError(null);
    setSuccess(null);
    setIsUploading(true);
    try {
      let imageUrl = newCategoryImageUrl.trim() || editingCategory?.imageUrl || '';
      
      // If we have a file, it should have been uploaded via IKUpload already
      // or we can handle it here if we use the SDK directly.
      // For simplicity, I'll assume the user might still paste a URL.

      if (editingCategory) {
        await updateDoc(doc(db, 'categories', editingCategory.id), {
          name: newCategoryName.trim(),
          imageUrl,
          startTime: newCategoryStartTime,
          endTime: newCategoryEndTime,
          parentCategoryId: newCategoryParentId || null,
          isMain: newCategoryIsMain,
          updatedAt: new Date().toISOString()
        });
        setSuccess("Category updated successfully");
      } else {
        await addDoc(collection(db, 'categories'), {
          name: newCategoryName.trim(),
          imageUrl,
          startTime: newCategoryStartTime,
          endTime: newCategoryEndTime,
          parentCategoryId: newCategoryParentId || null,
          isMain: newCategoryIsMain,
          createdAt: new Date().toISOString(),
          createdBy: auth.currentUser?.uid,
          order: 999 // Default to end
        });
        setSuccess("Category added successfully");
      }
      setNewCategoryName('');
      setNewCategoryImageUrl('');
      setNewCategoryStartTime('');
      setNewCategoryEndTime('');
      setNewCategoryParentId('');
      setNewCategoryIsMain(false);
      setCategoryFile(null);
      setEditingCategory(null);
    } catch (err: any) {
      setError(`Category Operation Failed: ${err.message || 'Unknown error'}`);
      handleFirestoreError(err, editingCategory ? OperationType.UPDATE : OperationType.CREATE, editingCategory ? `categories/${editingCategory.id}` : 'categories');
    } finally {
      setIsUploading(false);
    }
  };

  const startEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setNewCategoryName(cat.name);
    setNewCategoryImageUrl(cat.imageUrl || '');
    setNewCategoryStartTime(cat.startTime || '');
    setNewCategoryEndTime(cat.endTime || '');
    setNewCategoryParentId(cat.parentCategoryId || '');
    setNewCategoryIsMain(cat.isMain || false);
    setCategoryFile(null);
    // Scroll to form
    setTimeout(() => {
      document.getElementById('category-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleUpdateCategoryOrder = async (categoryId: string, order: number) => {
    if (!isMainAdmin && userRole !== 'admin') {
      setError("Only administrators can change category order.");
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      await updateDoc(doc(db, 'categories', categoryId), { order });
      setSuccess("Category order updated");
    } catch (err: any) {
      setError(`Failed to update order: ${err.message}`);
      handleFirestoreError(err, OperationType.UPDATE, `categories/${categoryId}`);
    }
  };

  useEffect(() => {
    if (activeTab === 'database') {
      fetchIkFiles();
    }
  }, [activeTab, ikFolder]);

  const fetchIkFiles = async () => {
    setIkLoading(true);
    try {
      const response = await fetch(`/api/imagekit/files?path=${ikFolder}&limit=100`);
      if (!response.ok) throw new Error('Failed to fetch files');
      const data = await response.json();
      setIkFiles(data);
    } catch (err: any) {
      setError(`Failed to fetch ImageKit files: ${err.message}`);
    } finally {
      setIkLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setSuccess("Link copied!");
      }).catch(err => {
        console.error('Clipboard error:', err);
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setSuccess("Link copied!");
        } catch (err) {
          setError("Failed to copy link");
        }
        document.body.removeChild(textArea);
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setSuccess("Link copied!");
      } catch (err) {
        setError("Failed to copy link");
      }
      document.body.removeChild(textArea);
    }
  };

  const handleIkBulkDelete = async () => {
    if (ikSelectedFiles.length === 0) return;
    setShowIkDeleteConfirm(false);

    setIkLoading(true);
    try {
      const response = await fetch('/api/imagekit/files/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: ikSelectedFiles })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete files');
      }
      setSuccess(`${ikSelectedFiles.length} files deleted from ImageKit`);
      setIkSelectedFiles([]);
      fetchIkFiles();
    } catch (err: any) {
      setError(`Failed to delete ImageKit files: ${err.message}`);
    } finally {
      setIkLoading(false);
    }
  };

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!auth.currentUser) return;

    setIsUploading(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'quotes', editingId), {
          ...quoteForm,
          branding: brandingConfig,
          updatedAt: new Date().toISOString()
        });
        setSuccess("Quote updated successfully");
        setEditingId(null);
      } else {
        const imageUrls = (quoteForm.imageUrl || '').split('\n').map(url => url.trim()).filter(url => url !== '');
        
        const totalToUpload = imageUrls.length;
        
        if (totalToUpload === 0) {
          setError("Please provide at least one image URL or upload files");
          setIsUploading(false);
          return;
        }

        const allUrls = imageUrls.map(url => ({ url, type: 'image' }));
        
        for (let i = 0; i < allUrls.length; i++) {
          const item = allUrls[i];
          await addDoc(collection(db, 'quotes'), {
            ...quoteForm,
            imageUrl: item.url,
            likesCount: 0,
            branding: brandingConfigs[i] || brandingConfig,
            createdAt: new Date().toISOString(),
            createdBy: auth.currentUser?.uid,
            createdByName: auth.currentUser?.displayName || auth.currentUser?.email || 'Anonymous'
          });
        }

        setSuccess(`Quotes added successfully`);
      }
      setQuoteForm({ text: '', author: '', category: dbCategories[0]?.name || '', imageUrl: '' });
      setBrandingConfigs([]);
      setQuoteFiles([]);
      setIsAdding(false);
    } catch (err: any) {
      setError(`Operation Failed: ${err.message || 'Unknown error'}`);
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, editingId ? `quotes/${editingId}` : 'quotes');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const startEditQuote = (quote: Quote) => {
    setEditingId(quote.id!);
    setQuoteForm({ text: quote.text, author: quote.author, category: quote.category, imageUrl: quote.imageUrl });
    if (quote.branding) {
      setBrandingConfig(quote.branding);
    }
    setIsAdding(true);
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!isMainAdmin) return;
    
    // Safety check: Don't allow modifying the main admin's role
    const targetUser = usersList.find(u => u.id === userId);
    if (targetUser?.email?.toLowerCase() === 'ig.mukesh12@gmail.com') {
      setError("Cannot modify the primary administrator's role.");
      return;
    }

    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setSuccess(`User role updated to ${newRole}`);
    } catch (err: any) {
      setError(`Failed to update role: ${err.message}`);
    }
  };

  const handleAddSubAdminByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMainAdmin || !subAdminEmail.trim()) return;
    
    setError(null);
    setSuccess(null);
    
    try {
      // Find user by email
      const q = query(collection(db, 'users'), where('email', '==', subAdminEmail.trim().toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError("User with this email not found. They must login at least once.");
        return;
      }
      
      const userDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, 'users', userDoc.id), { role: 'sub-admin' });
      setSuccess(`${subAdminEmail} is now a Sub Admin`);
      setSubAdminEmail('');
    } catch (err: any) {
      setError(`Failed to add sub-admin: ${err.message}`);
      handleFirestoreError(err, OperationType.UPDATE, 'users/role');
    }
  };

  const handleToggleBlock = async (userId: string, currentStatus: boolean) => {
    if (!isMainAdmin) return;

    // Safety check: Don't allow blocking the main admin
    const targetUser = usersList.find(u => u.id === userId);
    if (targetUser?.email?.toLowerCase() === 'ig.mukesh12@gmail.com') {
      setError("Cannot block the primary administrator.");
      return;
    }

    try {
      await updateDoc(doc(db, 'users', userId), { blocked: !currentStatus });
      setSuccess(`User ${!currentStatus ? 'blocked' : 'unblocked'} successfully`);
    } catch (err: any) {
      setError(`Failed to update block status: ${err.message}`);
    }
  };

  const handleUpdateCredits = async (userId: string, type: 'downloadCredits' | 'shareCredits', value: number) => {
    if (!isMainAdmin) return;
    try {
      await updateDoc(doc(db, 'users', userId), { [type]: value });
      setSuccess(`Credits updated successfully`);
    } catch (err: any) {
      setError(`Failed to update credits: ${err.message}`);
    }
  };

  const handleSelfDemote = async () => {
    if (!user || userRole !== 'sub-admin') return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: 'user' });
      setSuccess("You have removed your sub-admin privileges.");
      // The useEffect will update userRole and redirect if needed
    } catch (err: any) {
      setError(`Failed to remove sub-admin role: ${err.message}`);
    }
  };

  const categories = ['सभी', ...sortedCategories.map(c => c.name)];

  const filteredQuotes = quoteFilter === 'सभी' ? quotes : quotes.filter(q => 
    q.category?.trim().toLowerCase() === quoteFilter.trim().toLowerCase()
  );

  const handleBrandingUpdate = (updates: Partial<BrandingConfig>) => {
    const imageUrls = (quoteForm.imageUrl || '').split('\n').map(u => u.trim()).filter(u => u !== '');
    const totalUrls = imageUrls.length;

    if (totalUrls > 1) {
      const newConfigs = [...brandingConfigs];
      while (newConfigs.length < totalUrls) {
        newConfigs.push({ ...brandingConfig });
      }
      newConfigs[previewIndex] = { ...(newConfigs[previewIndex] || brandingConfig), ...updates };
      setBrandingConfigs(newConfigs);
    } else {
      setBrandingConfig(prev => ({ ...prev, ...updates }));
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 pb-20 md:pb-0 font-sans selection:bg-[#F27D26]/30">
      <AnimatePresence>
        {uploadProgress && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md w-full text-center"
            >
              <div className="relative w-32 h-32 mx-auto mb-8">
                <div className="absolute inset-0 border-4 border-[#F27D26]/20 rounded-full" />
                <motion.div 
                  className="absolute inset-0 border-4 border-[#F27D26] rounded-full border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Upload className="text-[#F27D26] animate-bounce" size={40} />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Processing Upload</h3>
              <p className="text-slate-400 font-medium mb-4 text-sm">
                Uploading {uploadProgress.current} of {uploadProgress.total} items
              </p>
              
              {fileUploadProgress > 0 && fileUploadProgress < 100 && (
                <div className="mb-6">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    <span>Current File</span>
                    <span>{fileUploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700">
                    <motion.div 
                      className="h-full bg-[#F27D26]"
                      initial={{ width: 0 }}
                      animate={{ width: `${fileUploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                <motion.div 
                  className="h-full bg-[#F27D26]"
                  initial={{ width: 0 }}
                  animate={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </motion.div>
          </div>
        )}

        {confirmDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-red-500/20">
                <AlertTriangle className="text-red-500" size={40} />
              </div>
              
              <h2 className="text-2xl font-bold text-center mb-2 text-white">
                {confirmDelete.step === 1 ? 'Confirm Deletion' : 'Permanent Action'}
              </h2>
              <p className="text-slate-400 text-center mb-8">
                {confirmDelete.step === 1 
                  ? `Are you sure you want to delete ${confirmDelete.isBulk ? `${confirmDelete.ids?.length} items` : `this ${confirmDelete.collection.slice(0, -1)}`}? This action cannot be undone.`
                  : `Final warning: This data will be permanently removed from the system.`}
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={executeDelete}
                  className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg"
                >
                  {confirmDelete.step === 1 ? 'Yes, Delete' : 'Yes, Delete Permanently'}
                </button>
                <button 
                  onClick={() => setConfirmDelete(null)}
                  className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12 border-b border-slate-800 pb-10">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-[#F27D26]/10 rounded-2xl border border-[#F27D26]/20 shadow-xl">
              <ImageIcon size={40} className="text-[#F27D26]" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">Admin Dashboard</h1>
              <p className="text-slate-400 text-sm mt-1 font-medium">Content Management System</p>
            </div>
          </div>
          
          <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto shadow-2xl overflow-x-auto no-scrollbar scroll-smooth">
            <button 
              onClick={() => { setActiveTab('quotes'); setIsAdding(false); setEditingId(null); }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold transition-all whitespace-nowrap uppercase tracking-widest text-[10px] ${activeTab === 'quotes' ? 'bg-[#F27D26] text-white shadow-lg shadow-[#F27D26]/20' : 'text-slate-400 hover:bg-white/5'}`}
            >
              <QuoteIcon size={18} /> Quotes
            </button>
            <button 
              onClick={() => { setActiveTab('categories'); setIsAdding(false); setEditingId(null); }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold transition-all whitespace-nowrap uppercase tracking-widest text-[10px] ${activeTab === 'categories' ? 'bg-[#F27D26] text-white shadow-lg shadow-[#F27D26]/20' : 'text-slate-400 hover:bg-white/5'}`}
            >
              <Tag size={18} /> Categories
            </button>
            {(isMainAdmin || userRole === 'admin') && (
              <>
                <button 
                  onClick={() => { setActiveTab('users'); setIsAdding(false); setEditingId(null); }}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold transition-all whitespace-nowrap uppercase tracking-widest text-[10px] ${activeTab === 'users' ? 'bg-[#F27D26] text-white shadow-lg shadow-[#F27D26]/20' : 'text-slate-400 hover:bg-white/5'}`}
                >
                  <Users size={18} /> Users
                </button>
                <button 
                  onClick={() => { setActiveTab('database'); setIsAdding(false); setEditingId(null); }}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold transition-all whitespace-nowrap uppercase tracking-widest text-[10px] ${activeTab === 'database' ? 'bg-[#F27D26] text-white shadow-lg shadow-[#F27D26]/20' : 'text-slate-400 hover:bg-white/5'}`}
                >
                  <List size={18} /> Database
                </button>
                <button 
                  onClick={() => { setActiveTab('payments'); setIsAdding(false); setEditingId(null); }}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold transition-all whitespace-nowrap uppercase tracking-widest text-[10px] ${activeTab === 'payments' ? 'bg-[#F27D26] text-white shadow-lg shadow-[#F27D26]/20' : 'text-slate-400 hover:bg-white/5'}`}
                >
                  <CreditCard size={18} /> Payments
                </button>
                <button 
                  onClick={() => { setActiveTab('settings'); setIsAdding(false); setEditingId(null); }}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold transition-all whitespace-nowrap uppercase tracking-widest text-[10px] ${activeTab === 'settings' ? 'bg-[#F27D26] text-white shadow-lg shadow-[#F27D26]/20' : 'text-slate-400 hover:bg-white/5'}`}
                >
                  <Settings size={18} /> Settings
                </button>
              </>
            )}
          </div>
        </div>

        {userRole === 'sub-admin' && !isMainAdmin && (
          <div className="mb-10 p-8 bg-[#F27D26]/5 border border-[#F27D26]/20 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-6 shadow-inner relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#F27D26]" />
            <div className="flex items-center gap-5">
              <div className="p-4 bg-[#F27D26]/20 rounded-2xl border border-[#F27D26]/30">
                <AlertTriangle className="text-[#F27D26]" size={32} />
              </div>
              <div>
                <p className="font-bold text-[#F27D26] text-xl tracking-tight">Sub-Admin Access</p>
                <p className="text-xs text-slate-400 font-medium italic">You are authorized to manage quotes and categories.</p>
              </div>
            </div>
            <button 
              onClick={handleSelfDemote}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all border border-white/5"
            >
              Relinquish Role
            </button>
          </div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-red-500/10 border border-red-500/30 rounded-[2rem] flex items-center justify-between shadow-2xl"
          >
            <div className="flex items-center gap-4">
              <AlertTriangle className="text-red-500" size={28} />
              <p className="text-red-400 text-sm font-black uppercase tracking-tight">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white transition-colors p-2">
              <X size={24} />
            </button>
          </motion.div>
        )}

        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-green-500/10 border border-green-500/30 rounded-[2rem] flex items-center justify-between shadow-2xl"
          >
            <div className="flex items-center gap-4">
              <Save className="text-green-500" size={28} />
              <p className="text-green-400 text-sm font-black uppercase tracking-tight">{success}</p>
            </div>
            <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-white transition-colors p-2">
              <X size={24} />
            </button>
          </motion.div>
        )}

        <div className="mb-12 p-6 bg-slate-900 rounded-3xl border border-slate-800 flex flex-wrap items-center gap-8 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full shadow-[0_0_15px_rgba(34,197,94,0.5)] ${user ? 'bg-green-500' : 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]'}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">System Status: {user ? 'Connected' : 'Disconnected'}</span>
          </div>
          {user && (
            <div className="flex items-center gap-4 border-l border-slate-800 pl-8">
              <User size={18} className="text-[#F27D26]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{user.email}</span>
            </div>
          )}
        </div>

      {activeTab === 'quotes' && (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 flex bg-[#151619] p-1 rounded-xl border border-white/5 overflow-x-auto no-scrollbar scroll-smooth">
                {Array.from(new Set(categories)).map((cat, index) => (
                  <button
                    key={`${cat}-${index}`}
                    onClick={() => setQuoteFilter(cat)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${quoteFilter === cat ? 'bg-[#F27D26] text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 w-full md:w-auto">
                {quotes.length > 0 && (
                  <button 
                    onClick={toggleSelectAll}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-xl font-bold transition-all border border-white/10"
                  >
                    {selectedQuoteIds.length === quotes.length ? <CheckSquare size={18} /> : <Square size={18} />}
                    {selectedQuoteIds.length === quotes.length ? 'Unselect All' : 'Select All'}
                  </button>
                )}
                {selectedQuoteIds.length > 0 && (
                  <div className="flex gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => setShowBulkActions(!showBulkActions)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-500/20 text-blue-400 px-4 py-3 rounded-xl font-bold border border-blue-500/20"
                    >
                      <MoreVertical size={18} />
                      Bulk Actions ({selectedQuoteIds.length})
                    </button>
                    <button 
                      onClick={handleBulkDelete}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-500/20 text-red-400 px-4 py-3 rounded-xl font-bold border border-red-500/20"
                    >
                      <Trash2 size={18} />
                      Delete Selected
                    </button>
                  </div>
                )}
                {quotes.length > 0 && (isMainAdmin || userRole === 'admin') && (
                  <button 
                    onClick={handleDeleteAllQuotes}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 md:py-3 rounded-xl font-bold transition-all shadow-lg ${deleteAllQuotesStep === 0 ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20' : deleteAllQuotesStep === 1 ? 'bg-red-500/40 text-white border border-red-500/50' : 'bg-red-600 text-white animate-pulse'}`}
                  >
                    <Trash2 size={20} />
                    {deleteAllQuotesStep === 0 ? 'Delete All' : deleteAllQuotesStep === 1 ? 'Are you sure?' : 'TAP TO DELETE ALL'}
                  </button>
                )}
                <button 
                  onClick={() => { setIsAdding(!isAdding); setEditingId(null); setQuoteFiles([]); }}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#F27D26] hover:bg-[#F27D26]/90 text-white px-6 py-4 md:py-3 rounded-xl font-bold transition-all shadow-lg shadow-[#F27D26]/20"
                >
                  {isAdding ? <X size={20} /> : <Plus size={20} />}
                  {isAdding ? 'Cancel' : 'Add Photo Quote'}
                </button>
              </div>
            </div>

            {showBulkActions && selectedQuoteIds.length > 0 && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="bg-[#F27D26]/5 border border-[#F27D26]/20 rounded-2xl p-4 mt-4 flex flex-col sm:flex-row items-center gap-4"
              >
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#F27D26] mb-1">Bulk Delete Quotes</p>
                  <p className="text-xs text-[#F27D26]/60">{selectedQuoteIds.length} quotes selected</p>
                </div>
                <div className="flex w-full sm:w-auto gap-2">
                  <button 
                    onClick={handleBulkDeleteQuotes}
                    className="bg-red-500/10 text-red-500 border border-red-500/20 px-4 py-2 rounded-xl font-bold text-sm hover:bg-red-500/20 transition-all"
                  >
                    Delete Selected
                  </button>
                </div>
              </motion.div>
            )}
        </div>
      )}

      {isAdding && (
        <div className="bg-slate-900 p-6 md:p-8 rounded-3xl mb-12 border border-slate-800 shadow-2xl">
          <h2 className="text-xl font-bold mb-6 text-white">{editingId ? 'Edit' : 'Add New'} Quote</h2>
          
          <form onSubmit={handleQuoteSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Category</label>
                <select 
                  value={quoteForm.category}
                  onChange={e => setQuoteForm({...quoteForm, category: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 focus:border-[#F27D26] outline-none transition-all text-white"
                >
                    {dbCategories.map(cat => (
                      <option key={`form-cat-${cat.id}`} value={cat.name}>{cat.name}</option>
                    ))}
                    {dbCategories.length === 0 && (
                      <>
                        <option key="default-mahadev" value="Mahadev">Mahadev</option>
                        <option key="default-ram" value="Ram">Ram</option>
                        <option key="default-krishna" value="Krishna">Krishna</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Upload Photos</label>
                  {!isIKConfigured ? (
                    <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold uppercase tracking-widest text-center">
                      ImageKit Not Configured. Please set Secrets.
                    </div>
                  ) : (
                    <>
                      <input
                        type="file"
                        id="quote-files"
                        multiple
                        className="hidden"
                        accept="image/*"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []) as File[];
                          if (files.length === 0) return;
                          
                          setIsUploading(true);
                          setError(null);
                          setUploadProgress({ current: 0, total: files.length });
                          
                          try {
                            const newImageUrls: string[] = [];
                            const newBrandingConfigs: any[] = [];

                            for (let i = 0; i < files.length; i++) {
                              const file = files[i];
                              console.log('File:', file.name, file.type, file.size);
                              setUploadProgress({ current: i + 1, total: files.length });
                              
                              const formData = new FormData();
                              formData.append('file', file);
                              formData.append('fileName', `quote_${Date.now()}_${file.name}`);
                              formData.append('publicKey', imagekitConfig.publicKey);
                              const sanitizedCategory = (quoteForm.category || 'Uncategorized').replace(/[^a-zA-Z0-9-_]/g, '_');
                              formData.append('folder', `quotes/${sanitizedCategory}`);
                              formData.append('useUniqueFileName', 'true');
                              
                              const authResponse = await imagekitConfig.authenticator();
                              formData.append('signature', authResponse.signature);
                              formData.append('expire', authResponse.expire.toString());
                              formData.append('token', authResponse.token);

                              const result = await new Promise<any>((resolve, reject) => {
                                const xhr = new XMLHttpRequest();
                                xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload');
                                
                                xhr.upload.onprogress = (event) => {
                                  if (event.lengthComputable) {
                                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                                    setFileUploadProgress(percentComplete);
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
                                console.log('Upload result:', result);
                                if (result.fileType === 'image') {
                                  newImageUrls.push(result.url);
                                }
                                newBrandingConfigs.push({ ...brandingConfig });
                              }
                            }
                            
                            setQuoteForm(prev => ({ 
                              ...prev, 
                              imageUrl: [prev.imageUrl, ...newImageUrls].filter(Boolean).join('\n')
                            }));
                            setBrandingConfigs(prev => [...prev, ...newBrandingConfigs]);
                            setSuccess(`${files.length} files uploaded successfully!`);
                          } catch (err: any) {
                            console.error('Quote Upload Error:', err);
                            setError(`Upload failed: ${err.message}`);
                          } finally {
                            setIsUploading(false);
                            setFileUploadProgress(0);
                            setUploadProgress(null);
                            e.target.value = '';
                          }
                        }}
                      />
                      <label 
                        htmlFor="quote-files"
                        className="flex items-center justify-center gap-3 w-full bg-slate-950 border-2 border-dashed border-slate-800 rounded-2xl p-6 hover:border-[#F27D26] cursor-pointer transition-all group"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="p-3 bg-[#F27D26]/10 rounded-full group-hover:scale-110 transition-transform">
                            <Upload size={24} className={isUploading ? "text-[#F27D26] animate-bounce" : "text-[#F27D26]"} />
                          </div>
                          <span className="text-sm font-bold text-[#F27D26]">
                            {isUploading 
                              ? `Uploading ${uploadProgress?.current}/${uploadProgress?.total} (${fileUploadProgress}%)` 
                              : 'Upload Multiple to ImageKit'}
                          </span>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Photos supported</p>
                        </div>
                      </label>
                    </>
                  )}
                </div>
                <div className="md:col-span-2 grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Photo URL(s) {editingId ? '' : '(One per line)'}
                    </label>
                    <textarea 
                      rows={editingId ? 2 : 4}
                      value={quoteForm.imageUrl}
                      onChange={e => setQuoteForm({...quoteForm, imageUrl: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 focus:border-[#F27D26] outline-none transition-all font-mono text-sm text-white"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              {/* Branding Configuration */}
              <div className="bg-slate-950/50 p-6 rounded-none md:rounded-3xl border-x-0 md:border border-slate-800 space-y-8">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Star className="text-[#F27D26]" size={18} />
                  Branding Configuration
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Preview Section */}
                  <div className="lg:col-span-1 space-y-4">
                    <div className="flex justify-between items-center px-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">Live Preview (Drag to Position)</label>
                      {(quoteForm.imageUrl?.split('\n').filter(u => u.trim()).length || 0) > 1 && (
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={() => setPreviewIndex(prev => Math.max(0, prev - 1))}
                            disabled={previewIndex === 0}
                            className="p-1 bg-slate-800 rounded-lg text-white disabled:opacity-30 hover:bg-slate-700 transition-colors"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span className="text-[10px] font-bold text-[#F27D26]">
                            {previewIndex + 1} / {(quoteForm.imageUrl?.split('\n').filter(u => u.trim()).length || 0)}
                          </span>
                          <button 
                            type="button"
                            onClick={() => setPreviewIndex(prev => Math.min((quoteForm.imageUrl?.split('\n').filter(u => u.trim()).length || 0) - 1, prev + 1))}
                            disabled={previewIndex >= (quoteForm.imageUrl?.split('\n').filter(u => u.trim()).length || 0) - 1}
                            className="p-1 bg-slate-800 rounded-lg text-white disabled:opacity-30 hover:bg-slate-700 transition-colors"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="w-[calc(100%+5rem)] -mx-10 md:mx-auto md:w-full h-auto bg-black rounded-none md:rounded-[2.5rem] overflow-hidden relative border-0 md:border-[8px] border-slate-800 shadow-2xl flex items-center justify-center">
                      {quoteForm.imageUrl ? (
                        (() => {
                          const imageUrls = (quoteForm.imageUrl || '').split('\n').map(u => u.trim()).filter(u => u !== '');
                          const currentUrl = imageUrls[previewIndex] || imageUrls[0];

                          return (
                            <img key={currentUrl} src={currentUrl} className="w-full h-auto object-contain" referrerPolicy="no-referrer" />
                          );
                        })()
                      ) : (
                        <div className="w-full aspect-square flex items-center justify-center text-slate-700">
                          <ImageIcon size={48} />
                        </div>
                      )}
                      <BrandingOverlay 
                        branding={brandingConfigs[previewIndex] || brandingConfig} 
                        userData={currentUserData} 
                        isVideo={false}
                        onUpdate={(updates) => handleBrandingUpdate({ ...updates, position: 'custom' })}
                      />
                      {console.log('Preview Index:', previewIndex, 'Branding Configs:', brandingConfigs)}
                    </div>
                  </div>

                  {/* Controls Section */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="space-y-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Customize User Photo</h4>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-xs font-bold text-slate-400">Size:</label>
                          <span className="text-xs text-slate-400">{(brandingConfigs[previewIndex] || brandingConfig).imageSize}%</span>
                        </div>
                        <input 
                          type="range"
                          min="20"
                          max="300"
                          value={(brandingConfigs[previewIndex] || brandingConfig).imageSize}
                          onChange={e => handleBrandingUpdate({ imageSize: parseInt(e.target.value) })}
                          className="w-full accent-[#F27D26]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400">Shape:</label>
                          <select 
                            value={(brandingConfigs[previewIndex] || brandingConfig).imageStyle}
                            onChange={e => handleBrandingUpdate({ imageStyle: e.target.value as any })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:border-[#F27D26] outline-none text-sm text-white"
                          >
                            <option value="circle">Circle</option>
                            <option value="square">Square</option>
                            <option value="rounded">Rounded Square</option>
                            <option value="hexagon">Hexagon</option>
                            <option value="star">Star</option>
                            <option value="diamond">Diamond</option>
                            <option value="shield">Shield</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => handleBrandingUpdate({ showName: !(brandingConfigs[previewIndex] || brandingConfig).showName })}
                          className={`flex-1 font-bold py-4 rounded-xl transition-colors text-sm shadow-lg ${(brandingConfigs[previewIndex] || brandingConfig).showName ? 'bg-[#F27D26] text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                        >
                          {(brandingConfigs[previewIndex] || brandingConfig).showName ? 'Hide Name' : 'Show Name'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBrandingUpdate({ showPhone: !(brandingConfigs[previewIndex] || brandingConfig).showPhone })}
                          className={`flex-1 font-bold py-4 rounded-xl transition-colors text-sm shadow-lg ${(brandingConfigs[previewIndex] || brandingConfig).showPhone ? 'bg-[#F27D26] text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                        >
                          {(brandingConfigs[previewIndex] || brandingConfig).showPhone ? 'Hide Phone' : 'Show Phone'}
                        </button>
                      </div>

                      {((brandingConfigs[previewIndex] || brandingConfig).showName || (brandingConfigs[previewIndex] || brandingConfig).showPhone) && (
                        <div className="space-y-6 p-6 bg-slate-900/50 rounded-2xl border border-slate-800 animate-fade-in">
                          <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Text Color:</label>
                            <div className="flex gap-3">
                              <input 
                                type="color"
                                value={(brandingConfigs[previewIndex] || brandingConfig).textColor}
                                onChange={e => handleBrandingUpdate({ textColor: e.target.value })}
                                className="w-12 h-12 bg-transparent border-none cursor-pointer rounded-lg"
                              />
                              <input 
                                type="text"
                                value={(brandingConfigs[previewIndex] || brandingConfig).textColor}
                                onChange={e => handleBrandingUpdate({ textColor: e.target.value })}
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:border-[#F27D26] outline-none text-sm text-white font-mono"
                              />
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Name Outline Color:</label>
                              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={!!(brandingConfigs[previewIndex] || brandingConfig).textOutlineColor}
                                  onChange={e => handleBrandingUpdate({ textOutlineColor: e.target.checked ? '#000000' : '' })}
                                  className="accent-[#F27D26]"
                                />
                                Enable Outline
                              </label>
                            </div>
                            {!!(brandingConfigs[previewIndex] || brandingConfig).textOutlineColor && (
                              <div className="flex gap-3">
                                <input 
                                  type="color"
                                  value={(brandingConfigs[previewIndex] || brandingConfig).textOutlineColor || '#000000'}
                                  onChange={e => handleBrandingUpdate({ textOutlineColor: e.target.value })}
                                  className="w-12 h-12 bg-transparent border-none cursor-pointer rounded-lg"
                                />
                                <input 
                                  type="text"
                                  value={(brandingConfigs[previewIndex] || brandingConfig).textOutlineColor || '#000000'}
                                  onChange={e => handleBrandingUpdate({ textOutlineColor: e.target.value })}
                                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:border-[#F27D26] outline-none text-sm text-white font-mono"
                                />
                              </div>
                            )}
                          </div>

                          <div className="space-y-3 pt-2">
                            <div className="flex justify-between">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Font Size:</label>
                              <span className="text-xs font-bold text-[#F27D26]">{(brandingConfigs[previewIndex] || brandingConfig).textSize}px</span>
                            </div>
                            <input 
                              type="range"
                              min="8"
                              max="100"
                              value={(brandingConfigs[previewIndex] || brandingConfig).textSize}
                              onChange={e => {
                                const val = parseInt(e.target.value);
                                if (brandingConfigs.length > 0) {
                                  const newConfigs = [...brandingConfigs];
                                  newConfigs[previewIndex] = { ...newConfigs[previewIndex], textSize: val };
                                  setBrandingConfigs(newConfigs);
                                } else {
                                  setBrandingConfig({...brandingConfig, textSize: val});
                                }
                              }}
                              className="w-full accent-[#F27D26]"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isUploading}
                className="w-full bg-[#F27D26] hover:bg-[#F27D26]/90 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-[#F27D26]/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isUploading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Uploading...</span>
                  </div>
                ) : (
                  <>
                    <Save size={20} /> 
                    {editingId ? 'Update Photo Quote' : `Save ${quoteForm.imageUrl?.split('\n').filter(u => u.trim()).length + quoteFiles.length || 0} Photo Quote(s)`}
                  </>
                )}
              </button>
            </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <div className="w-12 h-12 border-4 border-[#F27D26] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Loading Dashboard Data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeTab === 'quotes' ? (
          filteredQuotes.map(quote => (
            <div key={`quote-${quote.id}`} className={`bg-slate-900 rounded-3xl border transition-all group relative overflow-hidden flex flex-col ${selectedQuoteIds.includes(quote.id!) ? 'border-[#F27D26] ring-2 ring-[#F27D26]/20' : 'border-slate-800 hover:border-[#F27D26]/30'}`}>
              <div className="relative h-48 overflow-hidden">
                <div className="absolute top-2 left-2 z-30">
                  <button 
                    onClick={() => toggleSelectQuote(quote.id!)}
                    className={`p-2 rounded-lg transition-all ${selectedQuoteIds.includes(quote.id!) ? 'bg-[#F27D26] text-white' : 'bg-black/40 text-white/40 hover:bg-black/60'}`}
                  >
                    {selectedQuoteIds.includes(quote.id!) ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                </div>
                {quote.imageUrl ? (
                  <img src={quote.imageUrl} alt={quote.category} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center">
                    <ImageIcon className="text-white/10" size={48} />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-2 z-20">
                  <button 
                    onClick={() => quote.imageUrl && handleDownload(quote.imageUrl, `quote_${quote.id}.jpg`)}
                    disabled={!quote.imageUrl}
                    className={`p-2.5 bg-black/60 backdrop-blur-md rounded-xl text-white transition-all shadow-lg ${!quote.imageUrl ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/80'}`}
                  >
                    <Download size={18} />
                  </button>
                  {(isMainAdmin || userRole === 'admin' || quote.createdBy === user?.uid) && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => startEditQuote(quote)} 
                        disabled={userRole === 'sub-admin' && quote.createdBy !== user?.uid && !isMainAdmin}
                        className={`p-2.5 bg-black/60 backdrop-blur-md rounded-xl text-blue-400 transition-all shadow-lg ${userRole === 'sub-admin' && quote.createdBy !== user?.uid && !isMainAdmin ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/80'}`}
                        title={userRole === 'sub-admin' && quote.createdBy !== user?.uid && !isMainAdmin ? "Only Admin can edit this" : "Edit"}
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete('quotes', quote.id!)} 
                        disabled={userRole === 'sub-admin' && quote.createdBy !== user?.uid && !isMainAdmin}
                        className={`p-2.5 bg-black/60 backdrop-blur-md rounded-xl text-red-400 transition-all shadow-lg ${userRole === 'sub-admin' && quote.createdBy !== user?.uid && !isMainAdmin ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/80'}`}
                        title={userRole === 'sub-admin' && quote.createdBy !== user?.uid && !isMainAdmin ? "Only Admin can delete this" : "Delete"}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 flex flex-col gap-2 bg-slate-900">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{quote.category}</span>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    <span className="flex items-center gap-1"><Download size={12} /> {quote.downloadsCount || 0}</span>
                    <span className="flex items-center gap-1"><Share2 size={12} /> {quote.viewsCount || 0}</span>
                  </div>
                </div>
                {quote.text && <p className="text-xs text-slate-400 truncate max-w-[150px]">{quote.text}</p>}
                {quote.createdBy && (
                  <div className="flex items-center gap-2 mt-1 p-2 bg-white/5 rounded-xl border border-white/5">
                    <User size={12} className="text-[#F27D26]" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Added By</span>
                      <span className="text-[11px] text-white font-medium">
                        {quote.createdBy === user?.uid ? 'You (Main Admin)' : (usersList.find(u => u.uid === quote.createdBy)?.displayName || usersList.find(u => u.uid === quote.createdBy)?.email || 'Sub-Admin')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : activeTab === 'categories' ? (
          <div className="col-span-full space-y-8">
            {/* Category Form */}
            <div id="category-form" className="bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#F27D26]/5 blur-[100px] -z-10" />
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-white">
                <Tag size={24} className="text-[#F27D26]" />
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h2>
              <form onSubmit={handleCategorySubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Category Name</label>
                    <input 
                      type="text"
                      required
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      placeholder="e.g. Mahadev, Krishna..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 focus:border-[#F27D26] outline-none transition-all text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Image URL or Upload</label>
                    <div className="flex flex-col gap-2">
                      <input 
                        type="text"
                        value={newCategoryImageUrl}
                        onChange={e => setNewCategoryImageUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 focus:border-[#F27D26] outline-none transition-all text-white"
                      />
                      <div className="relative">
                        <input 
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setIsUploading(true);
                            setError(null);
                            try {
                              const formData = new FormData();
                              formData.append('file', file);
                              formData.append('fileName', `cat_${Date.now()}_${file.name}`);
                              formData.append('publicKey', imagekitConfig.publicKey);
                              formData.append('folder', 'categories');
                              formData.append('useUniqueFileName', 'true');
                              
                              const authResponse = await imagekitConfig.authenticator();
                              formData.append('signature', authResponse.signature);
                              formData.append('expire', authResponse.expire.toString());
                              formData.append('token', authResponse.token);

                              const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
                                method: 'POST',
                                body: formData
                              });
                              
                              if (!response.ok) throw new Error('Upload failed');
                              const result = await response.json();
                              setNewCategoryImageUrl(result.url);
                              setSuccess("Category image uploaded successfully!");
                            } catch (err: any) {
                              setError(`Upload failed: ${err.message}`);
                            } finally {
                              setIsUploading(false);
                            }
                          }}
                          className="hidden"
                          id="cat-file-upload"
                        />
                        <label 
                          htmlFor="cat-file-upload"
                          className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl cursor-pointer transition-all border border-slate-700"
                        >
                          <UploadCloud size={18} />
                          <span>{isUploading ? 'Uploading...' : 'Upload Image'}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Start Time (Active From)</label>
                    <input 
                      type="time"
                      value={newCategoryStartTime}
                      onChange={e => setNewCategoryStartTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 focus:border-[#F27D26] outline-none transition-all text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">End Time (Active Until)</label>
                    <input 
                      type="time"
                      value={newCategoryEndTime}
                      onChange={e => setNewCategoryEndTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 focus:border-[#F27D26] outline-none transition-all text-white"
                    />
                  </div>
                  <div className="flex items-center gap-3 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                    <button
                      type="button"
                      onClick={() => {
                        setNewCategoryIsMain(!newCategoryIsMain);
                        if (!newCategoryIsMain) setNewCategoryParentId(''); // Reset parent if becoming main
                      }}
                      className={`w-12 h-6 rounded-full transition-all relative ${newCategoryIsMain ? 'bg-[#F27D26]' : 'bg-slate-800'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newCategoryIsMain ? 'left-7' : 'left-1'}`} />
                    </button>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">Is Main Category?</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Main categories can have sub-categories</span>
                    </div>
                  </div>

                  {!newCategoryIsMain && (
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Select Parent Category</label>
                      <select 
                        value={newCategoryParentId}
                        onChange={e => setNewCategoryParentId(e.target.value)}
                        required={!newCategoryIsMain}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 focus:border-[#F27D26] outline-none transition-all text-white"
                      >
                        <option value="">Select a Main Category</option>
                        {dbCategories.filter(c => c.isMain && c.id !== editingCategory?.id).map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-500 mt-2 italic">Sub-categories will appear inside the popup of their parent.</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-4">
                  <button 
                    type="submit"
                    className="flex-1 bg-[#F27D26] hover:bg-[#F27D26]/90 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-[#F27D26]/20"
                  >
                    {editingCategory ? 'Update Category' : 'Add Category'}
                  </button>
                  {editingCategory && (
                    <button 
                      type="button"
                      onClick={() => { setEditingCategory(null); setNewCategoryName(''); setNewCategoryImageUrl(''); setNewCategoryStartTime(''); setNewCategoryEndTime(''); }}
                      className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Bulk Update Category (Moved from Quotes) */}
            {selectedQuoteIds.length > 0 && (
              <div className="bg-[#F27D26]/5 border border-[#F27D26]/20 rounded-3xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-lg font-bold text-[#F27D26]">Bulk Move Quotes</h3>
                  <p className="text-sm text-[#F27D26]/60">Change category for {selectedQuoteIds.length} selected quotes from the Quotes tab</p>
                </div>
                <div className="flex w-full md:w-auto gap-4">
                  <select 
                    value={bulkCategory}
                    onChange={e => setBulkCategory(e.target.value)}
                    className="flex-1 md:w-64 bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-[#F27D26]"
                  >
                    <option value="">Select Target Category...</option>
                    {dbCategories.map(cat => (
                      <option key={`bulk-cat-move-${cat.id}`} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                  <button 
                    onClick={handleBulkUpdateCategory}
                    disabled={!bulkCategory}
                    className="bg-[#F27D26] hover:bg-[#F27D26]/90 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg shadow-[#F27D26]/20 disabled:opacity-50"
                  >
                    Move Now
                  </button>
                </div>
              </div>
            )}

            {/* Category List */}
            <div className="space-y-12">
              {/* Main Categories Section */}
              <div className="bg-slate-900 rounded-3xl p-6 md:p-10 border border-slate-800 shadow-2xl">
                <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
                  <div>
                    <h2 className="text-3xl font-bold flex items-center gap-4 tracking-tight text-white">
                      <Star className="text-[#F27D26]" size={32} />
                      Main Categories
                    </h2>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">These categories show a popup with sub-categories</p>
                  </div>
                  <div className="bg-[#F27D26]/10 px-6 py-3 rounded-2xl border border-[#F27D26]/20 text-[10px] font-bold text-[#F27D26] uppercase tracking-widest">
                    {sortedCategories.filter(c => c.isMain).length} Main
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedCategories.filter(c => c.isMain).map(cat => {
                    const active = isCategoryActive(cat);
                    return (
                      <div key={`main-cat-${cat.id}`} className={`bg-slate-950 p-6 rounded-[2.5rem] border transition-all group ${active ? 'border-green-500/30 bg-green-500/5' : 'border-slate-800 hover:border-white/10'}`}>
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              {cat.imageUrl ? (
                                <img src={cat.imageUrl} className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-800 group-hover:border-[#F27D26] transition-all" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border-2 border-slate-800">
                                  <Tag size={24} className="text-white/20" />
                                </div>
                              )}
                              {active && (
                                <div className="absolute -top-2 -right-2 w-5 h-5 bg-green-500 rounded-full border-4 border-slate-950 animate-pulse" />
                              )}
                            </div>
                            <div>
                              <h3 className="font-bold text-white text-lg tracking-tight">{cat.name}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${active ? 'bg-green-500/20 text-green-500' : 'bg-slate-800 text-slate-500'}`}>
                                  {active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => startEditCategory(cat)} 
                              className="p-2.5 bg-white/5 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 rounded-xl transition-all"
                              title="Edit"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDelete('categories', cat.id!)} 
                              className="p-2.5 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-xl transition-all"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Schedule</span>
                            <span className="text-[11px] text-white font-medium">{cat.startTime || '00:00'} - {cat.endTime || '00:00'}</span>
                          </div>
                          
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Order</span>
                              <input 
                                type="number"
                                value={isNaN(cat.order) ? 0 : (cat.order || 0)}
                                onChange={(e) => handleUpdateCategoryOrder(cat.id!, parseInt(e.target.value) || 0)}
                                className="w-full bg-transparent text-right text-xs text-white font-bold outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sub-Categories Section */}
              <div className="bg-slate-900 rounded-3xl p-6 md:p-10 border border-slate-800 shadow-2xl">
                <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
                  <div>
                    <h2 className="text-3xl font-bold flex items-center gap-4 tracking-tight text-white">
                      <List className="text-[#F27D26]" size={32} />
                      Sub-Categories
                    </h2>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">These appear inside the popup of their parent category</p>
                  </div>
                  <div className="bg-[#F27D26]/10 px-6 py-3 rounded-2xl border border-[#F27D26]/20 text-[10px] font-bold text-[#F27D26] uppercase tracking-widest">
                    {sortedCategories.filter(c => c.parentCategoryId).length} Sub
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedCategories.filter(c => c.parentCategoryId).map(cat => {
                    const active = isCategoryActive(cat);
                    const parent = dbCategories.find(p => p.id === cat.parentCategoryId);
                    return (
                      <div key={`sub-cat-${cat.id}`} className={`bg-slate-950 p-6 rounded-[2.5rem] border transition-all group ${active ? 'border-green-500/30 bg-green-500/5' : 'border-slate-800 hover:border-white/10'}`}>
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              {cat.imageUrl ? (
                                <img src={cat.imageUrl} className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-800 group-hover:border-[#F27D26] transition-all" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border-2 border-slate-800">
                                  <Tag size={24} className="text-white/20" />
                                </div>
                              )}
                              {active && (
                                <div className="absolute -top-2 -right-2 w-5 h-5 bg-green-500 rounded-full border-4 border-slate-950 animate-pulse" />
                              )}
                            </div>
                            <div>
                              <h3 className="font-bold text-white text-lg tracking-tight">{cat.name}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${active ? 'bg-green-500/20 text-green-500' : 'bg-slate-800 text-slate-500'}`}>
                                  {active ? 'Active' : 'Inactive'}
                                </span>
                                {parent && (
                                  <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400">
                                    Parent: {parent.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => startEditCategory(cat)} 
                              className="p-2.5 bg-white/5 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 rounded-xl transition-all"
                              title="Edit"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDelete('categories', cat.id!)} 
                              className="p-2.5 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-xl transition-all"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Schedule</span>
                            <span className="text-[11px] text-white font-medium">{cat.startTime || '00:00'} - {cat.endTime || '00:00'}</span>
                          </div>
                          
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Order</span>
                              <input 
                                type="number"
                                value={isNaN(cat.order) ? 0 : (cat.order || 0)}
                                onChange={(e) => handleUpdateCategoryOrder(cat.id!, parseInt(e.target.value) || 0)}
                                className="w-full bg-transparent text-right text-xs text-white font-bold outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Other Categories (Neither Main nor Sub) */}
              {sortedCategories.filter(c => !c.isMain && !c.parentCategoryId).length > 0 && (
                <div className="bg-slate-900 rounded-3xl p-6 md:p-10 border border-slate-800 shadow-2xl">
                  <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
                    <div>
                      <h2 className="text-3xl font-bold flex items-center gap-4 tracking-tight text-white">
                        <Tag className="text-[#F27D26]" size={32} />
                        Other Categories
                      </h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Standard top-level categories</p>
                    </div>
                    <div className="bg-[#F27D26]/10 px-6 py-3 rounded-2xl border border-[#F27D26]/20 text-[10px] font-bold text-[#F27D26] uppercase tracking-widest">
                      {sortedCategories.filter(c => !c.isMain && !c.parentCategoryId).length} Other
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedCategories.filter(c => !c.isMain && !c.parentCategoryId).map(cat => {
                      const active = isCategoryActive(cat);
                      return (
                        <div key={`other-cat-${cat.id}`} className={`bg-slate-950 p-6 rounded-[2.5rem] border transition-all group ${active ? 'border-green-500/30 bg-green-500/5' : 'border-slate-800 hover:border-white/10'}`}>
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                              <div className="relative">
                                {cat.imageUrl ? (
                                  <img src={cat.imageUrl} className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-800 group-hover:border-[#F27D26] transition-all" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border-2 border-slate-800">
                                    <Tag size={24} className="text-white/20" />
                                  </div>
                                )}
                                {active && (
                                  <div className="absolute -top-2 -right-2 w-5 h-5 bg-green-500 rounded-full border-4 border-slate-950 animate-pulse" />
                                )}
                              </div>
                              <div>
                                <h3 className="font-bold text-white text-lg tracking-tight">{cat.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${active ? 'bg-green-500/20 text-green-500' : 'bg-slate-800 text-slate-500'}`}>
                                    {active ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => startEditCategory(cat)} 
                                className="p-2.5 bg-white/5 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 rounded-xl transition-all"
                                title="Edit"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button 
                                onClick={() => handleDelete('categories', cat.id!)} 
                                className="p-2.5 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-xl transition-all"
                                title="Delete"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Schedule</span>
                              <span className="text-[11px] text-white font-medium">{cat.startTime || '00:00'} - {cat.endTime || '00:00'}</span>
                            </div>
                            
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Order</span>
                                <input 
                                  type="number"
                                  value={isNaN(cat.order) ? 0 : (cat.order || 0)}
                                  onChange={(e) => handleUpdateCategoryOrder(cat.id!, parseInt(e.target.value) || 0)}
                                  className="w-full bg-transparent text-right text-xs text-white font-bold outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'users' ? (
          <div className="col-span-full space-y-8">
            {isMainAdmin && (
              <div className="bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-800 shadow-2xl">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-white">
                  <User size={24} className="text-[#F27D26]" />
                  Add Sub-Admin by Email
                </h2>
                <form onSubmit={handleAddSubAdminByEmail} className="flex flex-col sm:flex-row gap-4">
                  <input 
                    type="email"
                    required
                    value={subAdminEmail}
                    onChange={e => setSubAdminEmail(e.target.value)}
                    placeholder="Enter user's Gmail ID..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 focus:border-[#F27D26] outline-none transition-all text-white"
                  />
                  <button 
                    type="submit"
                    className="bg-[#F27D26] hover:bg-[#F27D26]/90 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg shadow-[#F27D26]/20"
                  >
                    Grant Sub-Admin Access
                  </button>
                </form>
              </div>
            )}

            <div className="bg-slate-900 rounded-3xl p-6 md:p-10 border border-slate-800 shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#F27D26]/5 blur-[100px] -z-10" />
              <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
                <div>
                  <h2 className="text-3xl font-bold flex items-center gap-4 tracking-tight text-white">
                    <Users className="text-[#F27D26]" size={32} />
                    User Directory
                  </h2>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Manage application users and roles</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-[#F27D26]/10 px-6 py-3 rounded-2xl border border-[#F27D26]/20 text-[10px] font-bold text-[#F27D26] uppercase tracking-widest">
                    {usersList.length} Users Found
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                      <th className="pb-6 pl-4">User</th>
                      <th className="pb-6">Email Address</th>
                      <th className="pb-6">Phone Number</th>
                      <th className="pb-6">Role</th>
                      <th className="pb-6">Usage (D/S)</th>
                      <th className="pb-6">Credits (D/S)</th>
                      <th className="pb-6 text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {usersList.map((u) => {
                      return (
                        <tr key={`user-${u.id}`} className="group hover:bg-white/5 transition-all duration-300">
                          <td className="py-6 pl-4">
                            <div className="flex items-center gap-4">
                              <div className="relative">
                                <img 
                                  src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}&background=random`} 
                                  alt={u.displayName}
                                  className="w-14 h-14 rounded-2xl border-2 border-slate-800 group-hover:border-[#F27D26] transition-all duration-300 object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                {u.role === 'sub-admin' && (
                                  <div className="absolute -top-2 -right-2 bg-[#F27D26] text-white p-1 rounded-lg shadow-lg">
                                    <Star size={10} fill="currentColor" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-base text-white tracking-tight">{u.displayName}</p>
                                <p className="text-[9px] text-slate-500 font-mono tracking-tighter opacity-50">{u.uid}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-6">
                            <span className="text-sm font-medium text-slate-300">{u.email}</span>
                          </td>
                          <td className="py-6">
                            <span className={`text-xs font-bold uppercase tracking-widest ${u.phoneNumber ? 'text-[#F27D26]' : 'text-slate-600 italic'}`}>
                              {u.phoneNumber || 'Not Provided'}
                            </span>
                          </td>
                          <td className="py-6">
                            {isMainAdmin ? (
                              <select 
                                value={u.role || 'user'}
                                onChange={(e) => handleUpdateRole(u.uid, e.target.value)}
                                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#F27D26] outline-none focus:border-[#F27D26] transition-all cursor-pointer"
                              >
                                <option value="user">User</option>
                                <option value="sub-admin">Sub Admin</option>
                              </select>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{u.role || 'user'}</span>
                            )}
                          </td>
                          <td className="py-6">
                            <div className="flex flex-col gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              <span>D: {u.downloadsCount || 0}</span>
                              <span>S: {u.sharesCount || 0}</span>
                            </div>
                          </td>
                          <td className="py-6">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest w-4">D:</span>
                                <input 
                                  type="number" 
                                  value={u.downloadCredits ?? 0} 
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                    if (!isNaN(val)) handleUpdateCredits(u.uid, 'downloadCredits', val);
                                  }}
                                  className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-[#F27D26]"
                                  disabled={!isMainAdmin}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest w-4">S:</span>
                                <input 
                                  type="number" 
                                  value={u.shareCredits ?? 0} 
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                    if (!isNaN(val)) handleUpdateCredits(u.uid, 'shareCredits', val);
                                  }}
                                  className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-[#F27D26]"
                                  disabled={!isMainAdmin}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-6 text-right pr-4">
                            <div className="flex items-center justify-end gap-3">
                              {isMainAdmin && (
                                <>
                                  <button 
                                    onClick={() => handleToggleBlock(u.uid, u.blocked)}
                                    className={`px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${u.blocked ? 'bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20'}`}
                                  >
                                    {u.blocked ? 'Unblock' : 'Block'}
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteUser(u.uid, u.id!)}
                                    className="p-3 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all md:opacity-0 md:group-hover:opacity-100"
                                  >
                                    <Trash2 size={20} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {usersList.length === 0 && (
                <div className="text-center py-20">
                  <Users size={48} className="mx-auto text-white/10 mb-4" />
                  <p className="text-[#8E9299]">No users found in the system.</p>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'database' ? (
          <div className="col-span-full space-y-8">
            <div className="bg-slate-900 rounded-3xl p-6 md:p-10 border border-slate-800 shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#F27D26]/5 blur-[100px] -z-10" />
              <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
                <div>
                  <h2 className="text-3xl font-bold flex items-center gap-4 tracking-tight text-white">
                    <List className="text-[#F27D26]" size={32} />
                    ImageKit Database
                  </h2>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Manage files and bulk uploads</p>
                </div>
                <div className="flex items-center gap-4 overflow-x-auto pb-2 md:pb-0 no-scrollbar max-w-full">
                  <input 
                    type="file"
                    id="db-bulk-upload"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []) as File[];
                      if (files.length === 0) return;
                      
                      setIkLoading(true);
                      setError(null);
                      try {
                        for (const file of files) {
                          const formData = new FormData();
                          formData.append('file', file);
                          formData.append('fileName', `${Date.now()}_${file.name}`);
                          formData.append('publicKey', imagekitConfig.publicKey);
                          formData.append('folder', ikFolder);
                          formData.append('useUniqueFileName', 'true');
                          
                          const authResponse = await imagekitConfig.authenticator();
                          formData.append('signature', authResponse.signature);
                          formData.append('expire', authResponse.expire.toString());
                          formData.append('token', authResponse.token);

                          await fetch('https://upload.imagekit.io/api/v1/files/upload', {
                            method: 'POST',
                            body: formData
                          });
                        }
                        setSuccess(`${files.length} files uploaded to ${ikFolder}`);
                        fetchIkFiles();
                      } catch (err: any) {
                        setError(`Upload failed: ${err.message}`);
                      } finally {
                        setIkLoading(false);
                        e.target.value = '';
                      }
                    }}
                  />
                  <label 
                    htmlFor="db-bulk-upload"
                    className="flex-shrink-0 flex items-center gap-2 bg-[#F27D26] hover:bg-[#F27D26]/90 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-[#F27D26]/20 cursor-pointer text-xs uppercase tracking-widest"
                  >
                    <Upload size={16} /> Bulk Upload
                  </label>
                  <select 
                    value={ikFolder}
                    onChange={(e) => setIkFolder(e.target.value)}
                    className="flex-shrink-0 bg-slate-950 border border-slate-800 rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-widest text-[#F27D26] outline-none focus:border-[#F27D26] transition-all cursor-pointer min-w-[200px]"
                  >
                    <option key="folder-quotes" value="quotes">Quotes Folder</option>
                    {dbCategories.map(cat => (
                      <option key={`folder-${cat.id}`} value={`quotes/${cat.name}`}>{cat.name} Quotes</option>
                    ))}
                    <option key="folder-categories" value="categories">Categories Folder</option>
                    <option key="folder-profiles" value="profiles">Profiles Folder</option>
                    <option key="folder-root" value="">Root Folder</option>
                  </select>
                  <button 
                    onClick={fetchIkFiles}
                    className="flex-shrink-0 p-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/5"
                  >
                    <Flame size={20} className={ikLoading ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

                <div className="flex flex-col md:flex-row gap-6 mb-8">
                  <div className="flex-1 relative">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="text"
                      value={ikSearch}
                      onChange={(e) => setIkSearch(e.target.value)}
                      placeholder="Search files by name..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 focus:border-[#F27D26] outline-none transition-all text-white text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => {
                        const filteredFiles = ikFiles.filter(f => f.name.toLowerCase().includes(ikSearch.toLowerCase()));
                        const filteredIds = filteredFiles.map(f => f.fileId);
                        const allSelected = filteredIds.every(id => ikSelectedFiles.includes(id));
                        
                        if (allSelected) {
                          setIkSelectedFiles(prev => prev.filter(id => !filteredIds.includes(id)));
                        } else {
                          setIkSelectedFiles(prev => Array.from(new Set([...prev, ...filteredIds])));
                        }
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-6 py-4 rounded-2xl transition-all border border-slate-700 flex items-center gap-2 text-sm"
                    >
                      {ikFiles.filter(f => f.name.toLowerCase().includes(ikSearch.toLowerCase())).every(f => ikSelectedFiles.includes(f.fileId)) && ikFiles.filter(f => f.name.toLowerCase().includes(ikSearch.toLowerCase())).length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                      {ikFiles.filter(f => f.name.toLowerCase().includes(ikSearch.toLowerCase())).every(f => ikSelectedFiles.includes(f.fileId)) && ikFiles.filter(f => f.name.toLowerCase().includes(ikSearch.toLowerCase())).length > 0 ? 'Deselect All' : 'Select All'}
                    </button>
                    {ikSelectedFiles.length > 0 && (
                      <button 
                        onClick={() => setShowIkDeleteConfirm(true)}
                        className="bg-red-500 hover:bg-red-600 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg shadow-red-500/20 flex items-center gap-3"
                      >
                        <Trash2 size={20} />
                        Delete {ikSelectedFiles.length} Selected
                      </button>
                    )}
                  </div>
                </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                {ikFiles
                  .filter(f => f.name.toLowerCase().includes(ikSearch.toLowerCase()))
                  .map((file, index) => (
                    <div 
                      key={`${file.fileId}-${index}`}
                      className={`group relative bg-slate-950 rounded-2xl border transition-all duration-300 overflow-hidden ${ikSelectedFiles.includes(file.fileId) ? 'border-[#F27D26] ring-2 ring-[#F27D26]/20' : 'border-slate-800 hover:border-slate-700'}`}
                    >
                      <div className="aspect-square relative overflow-hidden bg-black flex items-center justify-center">
                        {file.fileType === 'image' ? (
                          <img 
                            src={file.thumbnailUrl || file.url} 
                            alt={file.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                          />
                        ) : (
                          <ImageIcon size={40} className="text-slate-700" />
                        )}
                        
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <button 
                            onClick={() => copyToClipboard(file.url)}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all"
                            title="Copy Link"
                          >
                            <Share2 size={18} />
                          </button>
                          <a 
                            href={file.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all"
                            title="View Full"
                          >
                            <Download size={18} />
                          </a>
                        </div>

                        <button 
                          onClick={() => {
                            setIkSelectedFiles(prev => 
                              prev.includes(file.fileId) 
                                ? prev.filter(id => id !== file.fileId) 
                                : [...prev, file.fileId]
                            );
                          }}
                          className={`absolute top-3 left-3 p-1.5 rounded-lg transition-all ${ikSelectedFiles.includes(file.fileId) ? 'bg-[#F27D26] text-white' : 'bg-black/40 text-white/40 hover:text-white'}`}
                        >
                          {ikSelectedFiles.includes(file.fileId) ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-tighter flex-1" title={file.name}>
                            {file.name}
                          </p>
                          <button 
                            onClick={() => copyToClipboard(file.url)}
                            className="p-1.5 bg-[#F27D26]/10 hover:bg-[#F27D26]/20 rounded-lg text-[#F27D26] transition-all"
                            title="Copy Link"
                          >
                            <Share2 size={12} />
                          </button>
                        </div>
                        <p className="text-[9px] text-slate-600 font-mono mt-1">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                  ))}
              </div>

              {ikFiles.length === 0 && !ikLoading && (
                <div className="text-center py-32">
                  <UploadCloud size={64} className="mx-auto text-slate-800 mb-6" />
                  <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-sm">No files found in this folder</p>
                </div>
              )}

              {ikLoading && (
                <div className="text-center py-32">
                  <div className="w-12 h-12 border-4 border-[#F27D26] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                  <p className="text-[#F27D26] font-bold uppercase tracking-widest text-xs">Accessing Database...</p>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'payments' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Payment Settings */}
              <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-white">
                  <Settings className="text-[#F27D26]" />
                  Payment Settings
                </h2>
                <form onSubmit={handleUpdatePaymentSettings} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Subscription Price (INR)</label>
                    <input 
                      type="number"
                      value={isNaN(paymentSettings.subscriptionPrice) ? '' : paymentSettings.subscriptionPrice}
                      onChange={e => setPaymentSettings({...paymentSettings, subscriptionPrice: parseInt(e.target.value)})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 focus:border-[#F27D26] outline-none transition-all text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Free Downloads Limit</label>
                    <input 
                      type="number"
                      value={isNaN(paymentSettings.freeDownloadsLimit) ? '' : paymentSettings.freeDownloadsLimit}
                      onChange={e => setPaymentSettings({...paymentSettings, freeDownloadsLimit: parseInt(e.target.value)})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 focus:border-[#F27D26] outline-none transition-all text-white"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-[#F27D26] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#F27D26]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Save Settings
                  </button>
                </form>
              </div>

              {/* Grant Free Subscription */}
              <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-white">
                  <Mail className="text-[#F27D26]" />
                  Grant Free Subscription
                </h2>
                <p className="text-slate-400 text-sm mb-6">Enter a user's email to give them a lifetime free subscription.</p>
                <form onSubmit={handleGrantFreeSubscription} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">User Email</label>
                    <input 
                      type="email"
                      placeholder="user@example.com"
                      value={freeSubEmail}
                      onChange={e => setFreeSubEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 focus:border-[#F27D26] outline-none transition-all text-white"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-white/10 text-white py-4 rounded-2xl font-bold hover:bg-white/20 transition-all"
                  >
                    Grant Subscription
                  </button>
                </form>
              </div>
            </div>

            {/* Subscriptions List */}
            <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-white">
                <CreditCard className="text-[#F27D26]" />
                Recent Subscriptions ({subscriptions.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="pb-4 font-bold text-slate-400 text-sm uppercase tracking-wider">User</th>
                      <th className="pb-4 font-bold text-slate-400 text-sm uppercase tracking-wider">Amount</th>
                      <th className="pb-4 font-bold text-slate-400 text-sm uppercase tracking-wider">Order ID</th>
                      <th className="pb-4 font-bold text-slate-400 text-sm uppercase tracking-wider">Date</th>
                      <th className="pb-4 font-bold text-slate-400 text-sm uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {subscriptions.map((sub) => (
                      <tr key={`sub-${sub.id}`} className="hover:bg-white/5 transition-colors">
                        <td className="py-4">
                          <div className="text-white font-medium">{sub.email}</div>
                          <div className="text-xs text-slate-500">{sub.uid}</div>
                        </td>
                        <td className="py-4 text-white font-bold">₹{sub.amount}</td>
                        <td className="py-4 text-xs text-slate-400 font-mono">{sub.orderId}</td>
                        <td className="py-4 text-slate-400 text-sm">
                          {new Date(sub.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            sub.status === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            {sub.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {subscriptions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500">
                          No subscriptions found yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'settings' ? (
          <div className="col-span-full space-y-8">
            <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-white">
                <Settings className="text-[#F27D26]" />
                API Configuration
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-white font-bold">ImageKit API</h3>
                  <input type="text" value={maskKey(ikPublicKey)} disabled className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-mono" />
                  <input type="text" placeholder="New Public Key" onChange={e => setIkPublicKey(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white" />
                  <input type="text" value={maskKey(ikUrlEndpoint)} disabled className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-mono" />
                  <input type="text" placeholder="New URL Endpoint" onChange={e => setIkUrlEndpoint(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white" />
                </div>
                <div className="space-y-4">
                  <h3 className="text-white font-bold">Razorpay API</h3>
                  <input type="text" value={maskKey(razorpayKeyId)} disabled className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-mono" />
                  <input type="text" placeholder="New Key ID" onChange={e => setRazorpayKeyId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white" />
                  <input type="text" value={maskKey(razorpaySecret)} disabled className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-mono" />
                  <input type="text" placeholder="New Secret" onChange={e => setRazorpaySecret(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white" />
                </div>
              </div>
              <button 
                onClick={handleUpdateSettings}
                className="mt-8 w-full bg-[#F27D26] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#F27D26]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {confirmCount > 0 ? `Confirm Update (${3 - confirmCount} left)` : 'Update API Keys'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      )}
      {/* ImageKit Delete Confirmation Modal */}
      <AnimatePresence>
        {showIkDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIkDeleteConfirm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-[50px] -z-10" />
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center text-red-500">
                  <AlertTriangle size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Confirm Deletion</h3>
                  <p className="text-slate-400">Are you sure you want to delete <span className="text-white font-bold">{ikSelectedFiles.length}</span> files from ImageKit? This action cannot be undone.</p>
                </div>
                <div className="flex gap-4 w-full">
                  <button 
                    onClick={() => setShowIkDeleteConfirm(false)}
                    className="flex-1 px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleIkBulkDelete}
                    className="flex-1 px-6 py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-500/20"
                  >
                    Delete Now
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  </div>
);
};
