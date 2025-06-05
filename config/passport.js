require('dotenv').config();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('./database');
const jwt = require('jsonwebtoken');

module.exports = function (passport) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    passReqToCallback: true
  },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        console.log('Google profile:', JSON.stringify(profile, null, 2)); // Log detallado del perfil

        if (!profile.id || !profile.emails || !profile.emails[0].value) {
          return done(new Error('Información de perfil de Google incompleta'), null);
        }

        const existingUser = await pool.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);
        
        if (existingUser.rows.length) {
          const user = existingUser.rows[0];
          return done(null, { user, accessToken });
        }

        const newUser = await pool.query(
          'INSERT INTO users (google_id, email, name, role) VALUES ($1, $2, $3, $4) RETURNING *',
          [profile.id, profile.emails[0].value, profile.displayName, 'customer']
        );

        done(null, { user: newUser.rows[0], accessToken });
      } catch (error) {
        console.error('Error in Google strategy:', error);
        done(error, null);
      }
    }
  ));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      done(null, user.rows[0]);
    } catch (error) {
      done(error, null);
    }
  });
};