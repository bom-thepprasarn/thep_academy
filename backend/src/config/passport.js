const passport        = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { Strategy: LocalStrategy }           = require('passport-local');
const { Strategy: GoogleStrategy }          = require('passport-google-oauth20');
const { Strategy: FacebookStrategy }        = require('passport-facebook');
const bcrypt = require('bcryptjs');
const db     = require('./database');

// ─── Local (email/password) ─────────────────────────────────────
passport.use(new LocalStrategy(
  { usernameField: 'email', passwordField: 'password' },
  async (email, password, done) => {
    try {
      const { rows } = await db.query(
        'SELECT * FROM users WHERE email = $1 AND status = $2',
        [email.toLowerCase(), 'active']
      );
      const user = rows[0];
      if (!user) return done(null, false, { message: 'Email not found' });
      if (!user.password_hash) return done(null, false, { message: 'Please use OAuth to login' });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return done(null, false, { message: 'Incorrect password' });

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// ─── JWT ────────────────────────────────────────────────────────
passport.use(new JwtStrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey:    process.env.JWT_SECRET,
  },
  async (payload, done) => {
    try {
      const { rows } = await db.query(
        'SELECT id, name, email, role, status, avatar_url FROM users WHERE id = $1',
        [payload.sub]
      );
      const user = rows[0];
      if (!user || user.status !== 'active') return done(null, false);
      return done(null, user);
    } catch (err) {
      return done(err, false);
    }
  }
));

// ─── Google OAuth ───────────────────────────────────────────────
passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL,
    scope:        ['profile', 'email'],
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email     = profile.emails?.[0]?.value;
      const googleId  = profile.id;
      const name      = profile.displayName;
      const avatarUrl = profile.photos?.[0]?.value;

      if (!email) return done(null, false, { message: 'No email from Google' });

      // Find existing user by google_id or email
      let { rows } = await db.query(
        'SELECT * FROM users WHERE google_id = $1 OR email = $2',
        [googleId, email]
      );
      let user = rows[0];

      if (user) {
        // Update google_id if not set, and refresh avatar
        if (!user.google_id) {
          await db.query(
            'UPDATE users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2), updated_at = NOW() WHERE id = $3',
            [googleId, avatarUrl, user.id]
          );
        }
        await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
      } else {
        // Create new user
        const result = await db.query(
          `INSERT INTO users (name, email, google_id, avatar_url, login_method, status)
           VALUES ($1, $2, $3, $4, 'google', 'active')
           RETURNING *`,
          [name, email, googleId, avatarUrl]
        );
        user = result.rows[0];
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// ─── Facebook OAuth ─────────────────────────────────────────────
passport.use(new FacebookStrategy(
  {
    clientID:     process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL:  process.env.FACEBOOK_CALLBACK_URL,
    profileFields: ['id', 'displayName', 'emails', 'photos'],
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email      = profile.emails?.[0]?.value;
      const facebookId = profile.id;
      const name       = profile.displayName;
      const avatarUrl  = profile.photos?.[0]?.value;

      let query;
      if (email) {
        query = await db.query(
          'SELECT * FROM users WHERE facebook_id = $1 OR email = $2',
          [facebookId, email]
        );
      } else {
        query = await db.query(
          'SELECT * FROM users WHERE facebook_id = $1',
          [facebookId]
        );
      }

      let user = query.rows[0];

      if (user) {
        if (!user.facebook_id) {
          await db.query(
            'UPDATE users SET facebook_id = $1, avatar_url = COALESCE(avatar_url, $2), updated_at = NOW() WHERE id = $3',
            [facebookId, avatarUrl, user.id]
          );
        }
        await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
      } else {
        const result = await db.query(
          `INSERT INTO users (name, email, facebook_id, avatar_url, login_method, status)
           VALUES ($1, $2, $3, $4, 'facebook', 'active')
           RETURNING *`,
          [name, email || null, facebookId, avatarUrl]
        );
        user = result.rows[0];
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

module.exports = passport;
