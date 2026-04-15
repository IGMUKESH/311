import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, orderBy, handleFirestoreError } from '../firebase';
import { Quote, OperationType } from '../types';
import { QuoteCard } from './QuoteCard';
import { SEO } from './SEO';

import { useCategories } from '../CategoryContext';

export const Home: React.FC = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedCategory, categories } = useCategories();
  const [sortedIds, setSortedIds] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);

  // Scroll to top when category changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setVisibleCount(10);
  }, [selectedCategory]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 500) {
        setVisibleCount(prev => prev + 10);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'quotes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const quotesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Quote[];
      
      const uniqueQuotes = Array.from(new Map(quotesData.map(q => [q.id, q])).values());
      setQuotes(uniqueQuotes);
      
      // Update sorted IDs whenever quotes change to ensure new quotes appear
      const newSorted = Array.from(new Set(uniqueQuotes.sort((a, b) => {
        const scoreA = (a.likesCount || 0) + (a.viewsCount || 0) + (a.downloadsCount || 0);
        const scoreB = (b.likesCount || 0) + (b.viewsCount || 0) + (b.downloadsCount || 0);
        return scoreB - scoreA;
      }).map(q => q.id!)));
      
      setSortedIds(newSorted);
      
      if (loading) {
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'quotes');
    });
    return unsubscribe;
  }, []);

  // Re-sort when category changes
  useEffect(() => {
    if (quotes.length === 0) return;
    
    const newSorted = Array.from(new Set([...quotes].sort((a, b) => {
      const scoreA = (a.likesCount || 0) + (a.viewsCount || 0) + (a.downloadsCount || 0);
      const scoreB = (b.likesCount || 0) + (b.viewsCount || 0) + (b.downloadsCount || 0);
      return scoreB - scoreA;
    }).map(q => q.id!)));
    setSortedIds(newSorted);
  }, [selectedCategory]);

  const filteredQuotes = sortedIds
    .map(id => quotes.find(q => q.id === id))
    .filter((q): q is Quote => {
      if (!q) return false;
      const matchesCategory = selectedCategory === 'सभी' || 
                             (q.category?.trim().toLowerCase() === selectedCategory.trim().toLowerCase());
      return matchesCategory;
    })
    .slice(0, visibleCount);

  return (
    <div className="max-w-7xl mx-auto px-0 md:px-4 py-0 md:py-8 animate-fade-in">
      <SEO 
        title="Quotes" 
        description="Discover motivational quotes for your daily inspiration." 
        keywords="quotes, motivational quotes, community, photo quotes"
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <div className="w-16 h-16 border-4 border-[#F27D26] border-t-transparent rounded-full animate-spin mb-6" />
          <p className="text-[#8E9299] font-bold uppercase tracking-[0.3em] text-xs animate-pulse">Loading Quotes...</p>
        </div>
      ) : (
        <div className="md:block">
          {filteredQuotes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 md:gap-8">
              {filteredQuotes.map(quote => (
                <div key={`home-quote-${quote.id}`} className="flex flex-col h-auto min-h-[calc(100dvh-160px)] md:min-h-0 snap-start snap-always py-2 md:py-4">
                  <QuoteCard quote={quote} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-[#8E9299] text-lg">No quotes found matching your criteria.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
