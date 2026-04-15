import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, handleFirestoreError } from './firebase';
import { Category, OperationType } from './types';

interface CategoryContextType {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  categories: string[]; // Flat list of names for filtering
  dbCategories: Category[]; // Full category objects
  mainCategories: Category[]; // Only top-level categories
  subCategories: (parentId: string) => Category[]; // Helper to get sub-categories
  getParentCategory: (catName: string) => Category | undefined; // Helper to find parent by child name
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export const CategoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedCategory, setSelectedCategory] = useState('सभी');
  const [categories, setCategories] = useState<string[]>(['सभी']);
  const [dbCategories, setDbCategories] = useState<Category[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'categories'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const catsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      
      setDbCategories(catsData);

      const sortedCats = [...catsData].sort((a, b) => {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const isCategoryActive = (cat: any) => {
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
            // Overlap midnight (e.g., 22:00 to 02:00)
            return currentTime >= startTime || currentTime <= endTime;
          }
        };

        const activeA = isCategoryActive(a);
        const activeB = isCategoryActive(b);

        if (activeA && !activeB) return -1;
        if (!activeA && activeB) return 1;

        const orderA = a.order !== undefined ? Number(a.order) : 999;
        const orderB = b.order !== undefined ? Number(b.order) : 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });

      // For the flat list in the navbar, we only show categories that are NOT sub-categories
      const topLevelNames = sortedCats
        .filter(cat => !cat.parentCategoryId)
        .map(cat => cat.name);

      const uniqueCats = Array.from(new Set(topLevelNames.filter(cat => cat !== 'सभी')));
      setCategories(['सभी', ...uniqueCats]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'categories');
    });
    return unsubscribe;
  }, []);

  const mainCategories = dbCategories.filter(cat => !cat.parentCategoryId);
  const getSubCategories = (parentId: string) => dbCategories.filter(cat => cat.parentCategoryId === parentId);
  const getParentCategory = (catName: string) => {
    const cat = dbCategories.find(c => c.name === catName);
    if (!cat || !cat.parentCategoryId) return undefined;
    return dbCategories.find(p => p.id === cat.parentCategoryId);
  };

  return (
    <CategoryContext.Provider value={{ 
      selectedCategory, 
      setSelectedCategory, 
      categories, 
      dbCategories,
      mainCategories,
      subCategories: getSubCategories,
      getParentCategory
    }}>
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategories = () => {
  const context = useContext(CategoryContext);
  if (context === undefined) {
    throw new Error('useCategories must be used within a CategoryProvider');
  }
  return context;
};
