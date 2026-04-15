import React, { useState, useEffect } from 'react';
import { db, auth, collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, handleFirestoreError } from '../firebase';
import { Comment, OperationType } from '../types';
import { useAuthState } from 'react-firebase-hooks/auth';
import { MessageCircle, Send, Trash2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CommentSectionProps {
  quoteId: string;
  forceShow?: boolean;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ quoteId, forceShow }) => {
  const [user] = useAuthState(auth);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (forceShow !== undefined) {
      setShowComments(forceShow);
    }
  }, [forceShow]);

  useEffect(() => {
    const q = query(
      collection(db, 'quotes', quoteId, 'comments'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Comment[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `quotes/${quoteId}/comments`);
    });
    return unsubscribe;
  }, [quoteId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'quotes', quoteId, 'comments'), {
        uid: user.uid,
        displayName: user.displayName || 'Anonymous',
        photoURL: user.photoURL || '',
        text: newComment.trim(),
        createdAt: new Date().toISOString()
      });
      setNewComment('');
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, 'quotes', quoteId, 'comments', commentId));
      setConfirmDelete(null);
    } catch (error) {
      console.error("Error deleting comment:", error);
      setConfirmDelete(null);
    }
  };

  return (
    <AnimatePresence>
      {showComments && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 border-t border-white/5 pt-4 overflow-hidden"
        >
          <AnimatePresence>
            {confirmDelete && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white dark:bg-[#151619] border border-gray-200 dark:border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-black dark:text-white"
                >
                  <h3 className="text-lg font-bold mb-2">Delete Comment?</h3>
                  <p className="text-gray-500 dark:text-[#8E9299] text-sm mb-6">Are you sure you want to remove this comment? This action cannot be undone.</p>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleDelete(confirmDelete)}
                      className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all"
                    >
                      Delete
                    </button>
                    <button 
                      onClick={() => setConfirmDelete(null)}
                      className="flex-1 py-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-white font-bold rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {user ? (
            <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
              <input 
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm focus:border-[#F27D26] outline-none transition-all text-black dark:text-white"
              />
              <button 
                type="submit"
                disabled={!newComment.trim() || isSubmitting}
                className="bg-[#F27D26] text-white p-2 rounded-xl disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
              >
                <Send size={18} />
              </button>
            </form>
          ) : (
            <p className="text-xs text-[#8E9299] mb-6 italic">Please login to comment.</p>
          )}

          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
            <div className="flex items-center gap-2 text-[#F27D26] text-xs font-bold uppercase tracking-widest mb-2">
              <MessageCircle size={14} />
              {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
            </div>
            {comments.map((comment) => (
              <div key={`comment-${comment.id}`} className="flex gap-3 group">
                <img 
                  src={comment.photoURL || `https://ui-avatars.com/api/?name=${comment.displayName}&background=random`} 
                  alt={comment.displayName}
                  className="w-8 h-8 rounded-full border border-white/10 flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1">
                  <div className="bg-gray-100 dark:bg-white/5 rounded-2xl p-3 relative">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-[#F27D26]">{comment.displayName}</span>
                      {user?.uid === comment.uid && (
                        <button 
                          onClick={() => setConfirmDelete(comment.id!)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{comment.text}</p>
                  </div>
                  <span className="text-[10px] text-[#8E9299] mt-1 ml-2">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-center text-[#8E9299] text-sm py-4">No comments yet. Be the first!</p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
