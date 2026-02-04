import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import './Header.css';

function Header() {
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
      
      <nav className="nav">
        <motion.div 
          className="nav-item streak"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          🔥 3 Day Streak
        </motion.div>
        <motion.div 
          className="nav-item points"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          ⭐ 150 XP
        </motion.div>
      </nav>
    </motion.header>
  );
}

export default Header;
