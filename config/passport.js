require('dotenv').config();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('./database');

module.exports = function(passport) {
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      console.log('Google strategy callback initiated');
      console.log('Profile:', JSON.stringify(profile, null, 2));
      try {
        const result = await pool.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);
        
        if (result.rows.length > 0) {
          console.log('Existing user found');
          done(null, result.rows[0]);
        } else {
          console.log('Creating new user');
          const newUser = await pool.query(
            'INSERT INTO users (google_id, email, name) VALUES ($1, $2, $3) RETURNING *',
            [profile.id, profile.emails[0].value, profile.displayName]
          );
          
          done(null, newUser.rows[0]);
        }
      } catch (error) {
        console.error('Error in Google authentication:', error);
        done(error, null);
      }
    }
  ));

  // Serialización y deserialización del usuario
  passport.serializeUser((user, done) => {
    console.log('Serializing user:', user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    console.log('Deserializing user:', id);
    try {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      done(null, result.rows[0]);
    } catch (error) {
      console.error('Error in deserialization:', error);
      done(error, null);
    }
  });
};