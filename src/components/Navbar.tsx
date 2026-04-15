import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { auth, googleProvider, signInWithPopup, signOut } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { LogIn, LayoutDashboard, Quote, User, LogOut, ChevronDown, Info, FileText, Shield, Settings, Sun, Moon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useTheme } from '../ThemeContext';

import { useCategories } from '../CategoryContext';

export const Navbar: React.FC = () => {
  const [user] = useAuthState(auth);
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const { selectedCategory, setSelectedCategory, categories, mainCategories, subCategories, getParentCategory } = useCategories();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMainCat, setActiveMainCat] = useState<any | null>(null);
  const [showSubPopup, setShowSubPopup] = useState(false);
  const subPopupRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (subPopupRef.current && !subPopupRef.current.contains(event.target as Node)) {
        setShowSubPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCategoryClick = (catName: string) => {
    const catObj = mainCategories.find(c => c.name === catName);
    if (catObj?.isMain) {
      setActiveMainCat(catObj);
      setShowSubPopup(true);
    } else {
      setSelectedCategory(catName);
      setShowSubPopup(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setUserRole('user');
      setIsMainAdmin(false);
      return;
    }
    setIsMainAdmin(user.email?.toLowerCase() === 'ig.mukesh12@gmail.com');
    
    const unsubRole = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setUserRole(doc.data().role || 'user');
      }
    });
    return () => unsubRole();
  }, [user]);

  const canAccessAdmin = isMainAdmin || userRole === 'admin' || userRole === 'sub-admin';

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setIsMenuOpen(false);
    } catch (error: any) {
      if (error.code !== 'auth/cancelled-popup-request') {
        console.error("Login failed:", error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsMenuOpen(false);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const isQuotesPage = location.pathname === '/quotes';
  const displayedCategories = isExpanded ? categories : categories.slice(0, 9);

  return (
    <nav className="sticky top-0 left-0 right-0 bg-white dark:bg-[#151619]/95 backdrop-blur-2xl border-b border-gray-200 dark:border-white/5 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-14 md:h-16">
          <Link 
            to="/quotes" 
            className="flex items-center gap-2"
          >
            <span className="text-xl md:text-2xl font-black tracking-tighter gradient-text">MukeshApps</span>
          </Link>

          <div className="flex items-center gap-1 md:gap-4">
            <Link 
              to="/quotes" 
              className={`hidden md:flex items-center gap-1 px-3 py-2 rounded-2xl transition-all ${isActive('/quotes') ? 'text-[#F27D26] bg-[#F27D26]/10' : 'text-gray-500 dark:text-[#8E9299] hover:text-black dark:hover:text-white'}`}
            >
              <Quote size={20} />
              <span className="text-sm font-bold uppercase">Quotes</span>
            </Link>

            <div className="relative" ref={menuRef}>
              <div className="flex items-center gap-2">
                <button 
                  id="profile-btn"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-2xl transition-all ${isActive('/profile') || isMenuOpen ? 'text-[#F27D26] bg-[#F27D26]/10' : 'text-gray-500 dark:text-[#8E9299] hover:text-black dark:hover:text-white'}`}
                >
                  {user?.photoURL && user.photoURL !== '' ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || 'User'} 
                      className="w-8 h-8 md:w-6 md:h-6 rounded-full border border-gray-200 dark:border-white/10"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User size={24} className="md:w-5 md:h-5" />
                  )}
                  <span className="text-sm font-bold uppercase hidden md:inline">Profile</span>
                  <ChevronDown size={14} className={`hidden md:inline transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#151619] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden py-2 z-[60]"
                  >
                    {user ? (
                      <>
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-white/5">
                          <p className="text-sm font-bold text-black dark:text-white truncate">{user.displayName}</p>
                          <p className="text-[10px] text-gray-500 dark:text-[#8E9299] truncate">{user.email}</p>
                        </div>
                        <Link 
                          to="/profile" 
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-500 dark:text-[#8E9299] hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <User size={18} />
                          प्रोफ़ाइल सेटिंग्स
                        </Link>
                        {canAccessAdmin && (
                          <Link 
                            to="/admin" 
                            onClick={() => setIsMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 text-sm text-[#F27D26] hover:bg-[#F27D26]/10 transition-colors"
                          >
                            <Settings size={18} />
                            Admin Panel
                          </Link>
                        )}
                        <div className="border-t border-gray-200 dark:border-white/5 my-1"></div>
                        <Link 
                          to="/profile?tab=about" 
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-500 dark:text-[#8E9299] hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <Info size={18} />
                          About Us
                        </Link>
                        <Link 
                          to="/terms" 
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-500 dark:text-[#8E9299] hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <FileText size={18} />
                          Terms & Conditions
                        </Link>
                        <Link 
                          to="/privacy" 
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-500 dark:text-[#8E9299] hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <Shield size={18} />
                          Privacy Policy
                        </Link>
                        <div className="border-t border-gray-200 dark:border-white/5 my-1"></div>
                        <button 
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <LogOut size={18} />
                          Logout
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          id="login-btn"
                          onClick={handleLogin}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-black dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <LogIn size={18} />
                          Login with Google
                        </button>
                        <div className="border-t border-gray-200 dark:border-white/5 my-1"></div>
                        <Link 
                          to="/profile?tab=about" 
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-500 dark:text-[#8E9299] hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <Info size={18} />
                          About Us
                        </Link>
                        <Link 
                          to="/terms" 
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-500 dark:text-[#8E9299] hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <FileText size={18} />
                          Terms & Conditions
                        </Link>
                        <Link 
                          to="/privacy" 
                          onClick={() => setIsMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-500 dark:text-[#8E9299] hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <Shield size={18} />
                          Privacy Policy
                        </Link>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Categories Section - Only on Quotes page */}
        {isQuotesPage && (
          <div className="pb-2 pt-0.5 px-1 w-full">
            <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-1.5 justify-center w-full">
              {(isExpanded ? categories : categories.slice(0, 7)).map((cat, index) => (
                <button
                  key={`${cat}-${index}`}
                  onClick={() => handleCategoryClick(cat)}
                  className={`px-1 py-1.5 rounded-lg transition-all text-[12px] font-bold tracking-wide border font-laila text-center truncate ${
                    selectedCategory === cat || getParentCategory(selectedCategory)?.name === cat
                      ? 'bg-[#F27D26] text-white border-[#F27D26] shadow-lg shadow-[#F27D26]/20' 
                      : 'bg-gray-100 dark:bg-[#151619] text-gray-500 dark:text-[#8E9299] border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
              {categories.length > 7 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="px-1 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5 text-[#F27D26] text-[11px] font-black uppercase tracking-wider hover:bg-gray-200 dark:hover:bg-white/10 hover:border-[#F27D26]/30 transition-all flex items-center justify-center gap-0.5"
                >
                  {isExpanded ? 'कम' : 'अधिक'}
                </button>
              )}
            </div>
          </div>
        )}
        {/* Sub-category Popup */}
        <AnimatePresence>
          {showSubPopup && activeMainCat && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                ref={subPopupRef}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white dark:bg-[#151619] w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl border border-gray-200 dark:border-white/10"
              >
                <div className="p-6 border-b border-gray-200 dark:border-white/5 flex items-center justify-between bg-gray-50 dark:bg-white/5">
                  <h3 className="text-xl font-black tracking-tighter text-[#F27D26] font-laila">{activeMainCat.name}</h3>
                  <button 
                    onClick={() => setShowSubPopup(false)}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-6 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto no-scrollbar">
                  {subCategories(activeMainCat.id).map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => {
                        setSelectedCategory(sub.name);
                        setShowSubPopup(false);
                      }}
                      className={`p-4 rounded-2xl border transition-all font-laila text-center ${selectedCategory === sub.name ? 'bg-[#F27D26] text-white border-[#F27D26] shadow-lg shadow-[#F27D26]/20' : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-[#8E9299] border-gray-200 dark:border-white/5 hover:border-[#F27D26]/30'}`}
                    >
                      <span className="text-sm font-bold">{sub.name}</span>
                    </button>
                  ))}
                  {subCategories(activeMainCat.id).length === 0 && (
                    <div className="col-span-2 text-center py-8 text-gray-500 dark:text-[#8E9299]">
                      No sub-categories found.
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
};
