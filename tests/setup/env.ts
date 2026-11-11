// email.server.ts calls dotenv.config(), which would load a developer's
// EMAIL_DEV_REDIRECT from .env and reroute every test email. dotenv never
// overwrites a key that already exists, so an empty value keeps it off.
process.env.EMAIL_DEV_REDIRECT = "";
