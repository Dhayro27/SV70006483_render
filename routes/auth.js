const express = require('express');
const passport = require('passport');
const router = express.Router();

// Google OAuth routes
router.get('/google',
  (req, res, next) => {
    console.log('Initiating Google authentication');
    next();
  },
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

router.get('/google/callback', 
  (req, res, next) => {
    console.log('Google callback received');
    next();
  },
  passport.authenticate('google', { 
    failureRedirect: '/login',
    failureFlash: true
  }),
  (req, res) => {
    console.log('Google authentication successful');
    res.redirect('/');
  }
);

router.get('/logout', (req, res) => {
  console.log('Logging out user');
  req.logout((err) => {
    if (err) { 
      console.error('Error during logout:', err);
      return next(err); 
    }
    res.redirect('/');
  });
});

module.exports = router;