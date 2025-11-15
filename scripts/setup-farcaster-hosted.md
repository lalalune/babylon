# 🌐 Setup Farcaster Hosted Manifest (Optional)

This guide shows you how to set up **Farcaster Hosted Manifests** for easier updates without redeploying.

**Note:** This is **OPTIONAL**. Your app works perfectly with self-hosted manifests!

---

## 📋 Prerequisites

- ✅ App deployed at `babylon.market`
- ✅ Farcaster account with developer mode enabled
- ✅ 5-10 minutes of time

---

## 🚀 Step-by-Step Guide

### Step 1: Visit Developer Tools

Go to: https://farcaster.xyz/~/developers/mini-apps/manifest

### Step 2: Login

Login with your Farcaster account

### Step 3: Create New Manifest

Click "Create New Manifest" or "Add Manifest"

### Step 4: Fill in Details

Use these values (from your current manifest):

```
Domain: babylon.market
Name: Babylon
Subtitle: AI-Powered Prediction Markets
Description: In a world where everything is predicted, what really matters? Join Babylon, a multiplayer prediction market game with autonomous AI agents and continuous RL training.
Tagline: AI-Powered Prediction Markets
Category: social
Tags: prediction markets, ai agents, trading, social, game
```

### Step 5: Upload Assets

**Icon** (Required):
- Upload: `public/favicon.svg` or create 512x512 PNG
- Must be square
- Recommended: 512x512 or larger

**Splash Image** (Required):
- Upload: `public/assets/images/og-image.png`
- Recommended: 1200x630 or larger

**Hero Image** (Optional):
- Same as splash or create custom

**Screenshots** (Highly Recommended):
- Upload 3-5 images showing your app
- Recommended size: 1080x1920 (mobile screenshots)
- Show key features: feed, markets, trading, agents

### Step 6: Save and Get Manifest ID

After saving, you'll see:
```
Manifest ID: abc123xyz (example)
Hosted URL: https://api.farcaster.xyz/miniapps/hosted-manifest/abc123xyz
```

**SAVE THIS ID!** You'll need it in the next step.

### Step 7: Update next.config.mjs

Edit `/Users/shawwalters/babylon/next.config.mjs`:

```javascript
const nextConfig = {
  // ... existing config ...
  
  // OPTION A: Redirect (recommended)
  async redirects() {
    return [
      {
        source: '/.well-known/farcaster.json',
        destination: 'https://api.farcaster.xyz/miniapps/hosted-manifest/YOUR-MANIFEST-ID',
        permanent: false,
      },
    ]
  },
  
  // OR OPTION B: Rewrite (for caching)
  async rewrites() {
    return [
      {
        source: '/.well-known/farcaster.json',
        destination: 'https://api.farcaster.xyz/miniapps/hosted-manifest/YOUR-MANIFEST-ID',
      },
    ]
  },
}
```

**Important:** Replace `YOUR-MANIFEST-ID` with your actual ID!

### Step 8: Generate Account Association

Still in the Farcaster dashboard:

1. Click "Generate Account Association"
2. Sign the message with your Farcaster account
3. Copy the generated JSON:
   ```json
   {
     "header": "eyJ...",
     "payload": "eyJ...",
     "signature": "MHg..."
   }
   ```

### Step 9: Add to Your Manifest (Optional)

You can add this to your self-hosted file for reference, or just manage it in Farcaster dashboard.

If adding to `public/farcaster.json`:
```json
{
  "accountAssociation": {
    "header": "eyJ...",
    "payload": "eyJ...",
    "signature": "MHg..."
  },
  "miniapp": {
    // ... rest of config
  }
}
```

### Step 10: Deploy
```bash
git add next.config.mjs
git commit -m "feat: use Farcaster hosted manifest"
vercel deploy --prod
```

### Step 11: Verify
```bash
# Test manifest serving
curl https://babylon.market/.well-known/farcaster.json

# Should return manifest from Farcaster CDN
# Check response headers:
curl -I https://babylon.market/.well-known/farcaster.json
```

---

## 🎯 Benefits of Farcaster Hosting

### Update Without Deploying:
Change screenshots, description, tags, etc. in the Farcaster dashboard - takes effect immediately!

### Better Performance:
Served from Farcaster's CDN, faster for users worldwide.

### Easier Management:
Upload images via UI instead of code commits.

### Reliability:
Backed by Farcaster infrastructure.

---

## 🔄 Switching Back to Self-Hosted

If you ever want to switch back:

1. Remove `redirects` or `rewrites` from `next.config.mjs`
2. Restore the self-hosted rewrite:
   ```javascript
   async rewrites() {
     return [
       {
         source: '/.well-known/farcaster.json',
         destination: '/farcaster.json',
       },
     ]
   }
   ```
3. Redeploy

---

## 📊 Which Should I Choose?

### Start With: Self-Hosted ✅
- **Reason**: Already configured, deploy now!
- **Time**: 5 minutes to deploy
- **Benefit**: Launch today!

### Migrate To: Farcaster Hosted 🚀
- **When**: After launch, when ready
- **Reason**: Easier long-term maintenance
- **Time**: 10 minutes one-time setup

---

## 🎉 You're Ready Either Way!

**Both options are configured and ready:**
- ✅ Self-hosted works NOW
- ✅ Hosted setup instructions provided

**Deploy with confidence!** Your Mini App will work perfectly! 🚀

---

## 💡 Pro Tips

1. **Start self-hosted** - Launch quickly
2. **Gather feedback** - See what users think
3. **Create better screenshots** - Based on actual usage
4. **Migrate to hosted** - For easier updates
5. **Enjoy rewards** - Weekly payments based on DAU

---

**Current Status:** 100% Ready to Deploy (Self-Hosted) ✅

**Next Step:** `vercel deploy --prod` 🚀

