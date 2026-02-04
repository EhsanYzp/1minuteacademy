import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserStats } from '../services/progress';
import { getContentSource } from '../services/_contentSource';
import './Header.css';

function Header() {
  const { user, isSupabaseConfigured } = useAuth();
  const [stats, setStats] = useState({ xp: 0, streak: 0 });
  const contentSource = getContentSource();

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!isSupabaseConfigured || !user) return;
      try {
        const s = await getUserStats();
        if (mounted) setStats({ xp: s.xp ?? 0, streak: s.streak ?? 0 });
      } catch {
        // ignore header stats errors
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [isSupabaseConfigured, user]);

  return (
    <motion.header 
      className="header"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
    >
      <Link to="/" className="logo">
        <motion.span 
          className="logo-icon"
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          ⏱️
        </motion.span>
        <span className="logo-text">
          <span className="logo-number">1</span>
          <span className="logo-minute">Minute</span>
          <span className="logo-academy">Academy</span>
        </span>
      </Link>

      {contentSource === 'local' && (
        <div className="env-badge" title="Topics come from content/topics/** (no Supabase)">
          LOCAL PREVIEW
        </div>
      )}
      
      <nav className="nav">
        {user ? (
          <>
            <motion.div 
              className="nav-item streak"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Daily streak"
            >
              🔥 {stats.streak} Day Streak
            </motion.div>
            <motion.div 
              className="nav-item points"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Total XP"
            >
              ⭐ {stats.xp} XP
            </motion.div>
          </>
        ) : (
          <Link to="/login" className="nav-item points" style={{ textDecoration: 'none' }}>
            Sign in
          </Link>
        )}
      </nav>
    </motion.header>
  );
}

export default Header;
