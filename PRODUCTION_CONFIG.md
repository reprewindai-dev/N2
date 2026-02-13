# 🔒 FROZEN PRODUCTION CONFIGURATION
**Last Updated:** February 13, 2026  
**Status:** ✅ WORKING 100% - DO NOT MODIFY WITHOUT APPROVAL

---

## ⚠️ CRITICAL: DO NOT CHANGE THESE SETTINGS

### Porkbun DNS Records
**Location:** Porkbun → Domain Management → shortformfactory.com → DNS

| Type | Host | Answer | TTL |
|------|------|--------|-----|
| A | @ (or shortformfactory.com) | `76.76.21.21` | 600 |
| CNAME | www | `a8dc0f4e841cc9e3.vercel-dns-017.com` | 600 |
| TXT | _vercel | `vc-domain-verify=shortformfactory.com,f3345c4abf89303efecf` | 600 |
| TXT | _vercel | `vc-domain-verify=www.shortformfactory.com,be02b0a8524f5b3f3721` | 600 |

**DO NOT:**
- Change the A record IP (must stay `76.76.21.21`)
- Change the www CNAME target
- Enable URL Forwarding / Web Redirect in Porkbun
- Add additional A records for @ that point elsewhere

---

### Vercel Domain Settings
**Location:** Vercel → Project → Settings → Domains

**Configuration:**
- **Primary Domain:** `shortformfactory.com` (non-www) ✅
- **Redirect to Primary:** ON ✅
- **Domains assigned:** Both `shortformfactory.com` and `www.shortformfactory.com`

**DO NOT:**
- Change Primary domain to www
- Turn off "Redirect to Primary Domain"
- Remove either domain
- Add conflicting redirect rules

---

## ✅ Expected Behavior (Verified Working)

### Live Site Redirects
- `https://shortformfactory.com/` → **200 OK** (loads directly)
- `https://www.shortformfactory.com/` → **308 Permanent Redirect** → `https://shortformfactory.com/`

### iMessage/Social Previews
- **Banner Image:** Shows `og-banner.png` (1200×630)
- **Title:** "ShortFormFactory - Done-For-You Short-Form Video Editing"
- **Description:** Service description displays correctly
- **Status:** ✅ Working 100%

---

## 📁 Critical Files in Repository

### `vercel.json`
- Contains caching headers for performance
- Contains `.html` → clean route redirects
- **DOES NOT** contain www → non-www redirect (handled by Vercel domain settings)

### `index.html`
- Contains Open Graph meta tags
- Points to `https://shortformfactory.com/assets/og-banner.png`
- Contains canonical URL: `https://shortformfactory.com/`

### `assets/og-banner.png`
- 1200×630 PNG (386,642 bytes)
- Used for social media previews

### `robots.txt` & `sitemap.xml`
- SEO optimization files
- Sitemap points to all clean routes

---

## 🛠️ What Was Fixed (History)

1. **Redirect Loop Eliminated**
   - Removed conflicting www→non-www redirect from `vercel.json`
   - Set Vercel Primary domain to apex with redirect-to-primary ON
   - Fixed DNS A record to point to Vercel (`76.76.21.21`)

2. **SEO & Social Previews**
   - Added Open Graph and Twitter Card meta tags
   - Added `og-banner.png` for social previews
   - Added `robots.txt` and `sitemap.xml`

3. **Performance**
   - Deferred JavaScript loading
   - Added aggressive caching headers for static assets

---

## 🚨 If Something Breaks

### Symptoms of Redirect Loop
- "Too many redirects" error
- Site won't load in browser or iMessage

### How to Check
Run in terminal:
```bash
curl -I https://shortformfactory.com/ --max-redirs 10 -L
curl -I https://www.shortformfactory.com/ --max-redirs 10 -L
```

Expected output:
- Apex: `HTTP/1.1 200 OK`
- www: `HTTP/1.1 308 Permanent Redirect` → `Location: https://shortformfactory.com/`

### If Broken
1. Check Vercel → Domains → Primary is set to `shortformfactory.com`
2. Check Porkbun DNS → A record is `76.76.21.21`
3. Check Porkbun → No URL Forwarding enabled
4. Refer to this document for correct settings

---

## 📝 Notes
- **Canonical domain:** `https://shortformfactory.com` (non-www)
- **GitHub repo:** `reprewindai-dev/shortformfactorywebsite`
- **Vercel project:** Connected to main branch
- **Last verified working:** February 13, 2026 at 5:00 PM EST
