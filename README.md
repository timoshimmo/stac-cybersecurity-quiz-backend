# STAC Marine Standalone Backend

This is the separated backend service for the STAC Marine quiz application.

## Setup
1. Move the contents of this directory to your new hosting environment.
2. Run `npm install` to install dependencies.
3. Set your environment variables:
   - `MONGODB_URI`: Your MongoDB Atlas connection string.
   - `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`: For email notifications.
4. Run `npm start` to launch the server.

## Purpose
This server is strictly for API requests and database management. It does not serve frontend assets, allowing for a clean separation of concerns and easier scaling on a dedicated domain.
