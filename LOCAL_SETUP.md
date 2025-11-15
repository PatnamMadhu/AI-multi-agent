# Local Setup Guide

This guide explains how to run the AI Workflow Capture System on your local machine.

## Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **OpenAI API Key**

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <project-directory>
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the project root:

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Session Secret (generate a random string)
SESSION_SECRET=your_random_session_secret_here

# Node Environment
NODE_ENV=development
```

**To generate a session secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Note:** The application uses in-memory storage and does not require a database.

### 4. Install Puppeteer Dependencies

Puppeteer requires certain system dependencies for headless Chrome:

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  lsb-release \
  wget \
  xdg-utils
```

**macOS:**
```bash
# Puppeteer should work out of the box on macOS
# If issues occur, ensure Xcode Command Line Tools are installed:
xcode-select --install
```

**Windows:**
Puppeteer should work out of the box on Windows. If you encounter issues, ensure you have the latest Visual C++ redistributables installed.

### 5. Start the Application

**Development Mode:**
```bash
npm run dev
```

This starts both the backend (Express) and frontend (Vite) servers.

The application will be available at:
- **Frontend:** http://localhost:5000
- **Backend API:** http://localhost:5000/api

### 6. Verify Installation

1. Open http://localhost:5000 in your browser
2. Check the health endpoint: http://localhost:5000/api/health
3. You should see a response indicating if the OpenAI API key is configured

## Usage

### Basic Workflow Capture

1. Enter a natural language question (e.g., "How do I create a project in Linear?")
2. The target URL is auto-detected, or you can specify it manually
3. Choose authentication preference:
   - **Auto-detect:** System checks login state and documents both scenarios
   - **I'm already logged in:** Import browser cookies to use existing session
   - **I need to sign in:** Focuses on documenting the login flow
   - **I need to sign up:** Focuses on documenting the signup flow
4. Click "Capture Workflow"
5. View the generated screenshots with step descriptions

### Cookie Import Feature

When selecting "I'm already logged in":

1. Install a browser cookie export extension (e.g., "EditThisCookie" or "Cookie-Editor")
2. Navigate to the website you're logged into
3. Export cookies as JSON
4. Click "Import Session Cookies" in the UI
5. Paste the exported cookies
6. Click "Parse Cookies"
7. Submit your workflow

**Supported Cookie Formats:**

JSON Array:
```json
[{"name":"session_id","value":"abc123","domain":".example.com","path":"/"}]
```

Cookie String:
```
session_id=abc123; domain=.example.com; path=/
```

### OAuth Authentication Support

The system automatically handles OAuth/SSO logins for popular providers:

**Supported OAuth Providers:**
- Google ("Continue with Google", "Sign in with Google")
- GitHub ("Continue with GitHub", "Sign in with GitHub")
- Microsoft ("Continue with Microsoft")
- Apple ("Continue with Apple")

**How It Works:**
1. System detects OAuth buttons automatically
2. Clicks the OAuth button
3. Waits for OAuth popup window to appear
4. Popup completes authentication (auto-confirms if you have an active session)
5. Popup closes automatically
6. Main workflow continues

**OAuth Cookie Reuse:**
If you import Google/GitHub/Microsoft cookies along with app cookies, the OAuth popup will auto-confirm without requiring credential entry. This enables one Google account to authenticate across multiple apps.

**Example with OAuth:**
```
Question: "How do I create a project in Linear?"
Auth: "I'm already logged in"
Cookies: [Linear app cookies + Google OAuth cookies]
Result: System clicks "Continue with Google" → popup auto-confirms → workflow continues
```

## Troubleshooting

### Puppeteer Issues

**Error: "Failed to launch chrome"**
- Ensure system dependencies are installed (see step 4)
- On Linux, you may need to run with `--no-sandbox` flag (already configured)

**Blank screenshots or timeout errors**
- Some websites block headless browsers
- Try increasing timeout values in `server/services/browser.ts`
- Check if the target website has anti-bot protections

### OpenAI API Issues

**Error: "OpenAI API key not configured"**
- Verify your `.env` file has `OPENAI_API_KEY` set
- Restart the application after adding the key

**Rate limit errors**
- OpenAI API has rate limits based on your plan
- Wait a few moments and try again
- Consider upgrading your OpenAI plan if needed

### Port Conflicts

**Error: "Port 5000 already in use"**
- Another application is using port 5000
- Stop the conflicting application or change the port in `server/index.ts`

## Development

### Project Structure

```
├── client/              # Frontend React application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   └── lib/         # Utilities and query client
├── server/              # Backend Express application
│   ├── routes.ts        # API endpoints
│   └── services/        # Business logic services
│       ├── workflow.ts  # Workflow orchestrator
│       ├── openai.ts    # OpenAI integration
│       ├── browser.ts   # Puppeteer automation
│       └── cache.ts     # LRU cache service
├── shared/              # Shared types and schemas
│   └── schema.ts        # Zod validation schemas
└── package.json
```

### Available Scripts

```bash
# Development
npm run dev              # Start dev server (frontend + backend)

# Type Checking
npm run check            # Run TypeScript type checking

# Build
npm run build            # Build for production
```

### Technology Stack

- **Frontend:** React, TypeScript, Vite, TailwindCSS, shadcn/ui
- **Backend:** Node.js, Express, TypeScript
- **AI:** OpenAI GPT-4.1-mini
- **Automation:** Puppeteer
- **Storage:** In-memory (LRU cache)
- **Validation:** Zod
- **State Management:** TanStack Query

## Production Deployment

For production deployment:

1. Build the application:
   ```bash
   npm run build
   ```

2. Set `NODE_ENV=production` in your environment

3. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start npm --name "workflow-capture" -- start
   ```

4. Set up a reverse proxy (nginx, Caddy) to handle SSL/TLS

## Security Considerations

- **Never commit `.env` file** to version control
- **Rotate session secrets** periodically
- **Use HTTPS** in production
- **Cookie security:** Imported cookies are only transmitted in "already-logged-in" mode
- **API keys:** Store securely and use environment variables

## Support

For issues or questions:
- Check the troubleshooting section above
- Review logs in the terminal
- Inspect browser console for frontend errors

## License

[Your License Here]
