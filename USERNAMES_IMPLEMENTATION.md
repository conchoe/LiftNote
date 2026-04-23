# Unique Usernames Implementation Guide

## Overview
This implementation adds a unique username system to your Expo app, integrated with Supabase authentication. Users set their username when they first sign up, and can edit it later from their account settings.

---

## What Was Implemented

### 1. **Database Schema** (`supabase/schema.sql`)
Your `profiles` table already exists. Add these to make usernames unique:

```sql
-- Add unique constraint to usernames
ALTER TABLE public.profiles ADD CONSTRAINT username_unique UNIQUE(username);

-- Add index for faster lookups
CREATE INDEX idx_profiles_username ON public.profiles(username);
```

**Table columns:**
- `id` (UUID, primary key, references auth.users)
- `username` (TEXT, NOT NULL, UNIQUE)
- `avatar_url` (TEXT, nullable)
- `current_streak` (INTEGER)
- `bio` (TEXT, nullable)
- `is_private` (BOOLEAN)
- `created_at` (TIMESTAMPTZ)

---

### 2. **TypeScript Types** (`lib/supabase-types.ts`)
Added a `Profile` type:

```typescript
export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  current_streak: number;
  bio: string | null;
  is_private: boolean;
  created_at: string;
};
```

---

### 3. **Username Utilities** (`lib/username.ts`)
Core validation and database functions:

#### `validateUsernameFormat(username: string)`
- Validates format (3-30 chars, alphanumeric + underscore + hyphen)
- Cannot start/end with underscore or hyphen
- Returns `{ ok: true }` or `{ ok: false, error: string }`

#### `checkUsernameAvailable(username: string)`
- Queries database to check if username is taken
- Returns `{ available: true }` or `{ available: false, error: string }`

#### `updateUsername(userId: string, newUsername: string)`
- Validates format & checks availability
- Updates database with new username
- Handles unique constraint violations
- Converts usernames to lowercase for case-insensitive lookups

#### `getProfileByUsername(username: string)`
- Helper to fetch a user's profile by username
- Used for friend searches & profiles

---

### 4. **Username Setup Screen** (`app/(auth)/username.tsx`)
**When displayed:** After sign-up/sign-in (before going to main app)

**Features:**
- Input field with live validation feedback
- "Check availability" button to verify username isn't taken
- Real-time format validation (shows checkmark if valid)
- Error/success messages
- Confirm button (only enabled if username is available)

**UI Flow:**
1. User enters username
2. Checks format (shows red/green indicator)
3. Clicks "Check availability"
4. If available, they see green success message
5. Clicks "Confirm username" to proceed to main app

---

### 5. **Account Screen Updates** (`app/(tabs)/account.tsx`)
Enhanced existing account screen with:

**New features:**
- Display current username with edit button (pencil icon)
- Inline editing with validation
- Cancel and confirm buttons for username changes
- Error messages for conflicts or validation failures

**Existing features preserved:**
- Email display
- Privacy toggle
- Trophy case (PRs)
- Sign out button

---

### 6. **Auth Navigation** (`app/_layout.tsx`)
Updated root navigation to route to username setup:

```typescript
if (!session && !inAuthGroup) {
  // Not logged in → show login screen
  router.replace("/(auth)/login");
} else if (session && inAuthGroup && !isUsernameScreen) {
  // Just signed up → show username setup
  router.replace("/(auth)/username");
} else if (session && !inAuthGroup) {
  // Logged in with username → show main tabs
  router.replace("/(tabs)");
}
```

---

## How It Works: User Journey

### First Time Sign-Up
1. User opens app
2. Clicks "Create account" on login screen
3. Enters email & password
4. After sign-up, routed to **username setup screen**
5. Enters desired username
6. Clicks "Check availability" → gets availability result
7. Clicks "Confirm username"
8. Routed to main app (tabs)

### Returning User
1. User opens app
2. Signs in with email & password
3. Automatically routed to main app (tabs)

### Editing Username Later
1. User goes to Account tab
2. Sees their current username with edit button
3. Clicks pencil icon to edit
4. Enters new username
5. Validation happens in real-time
6. Clicks checkmark to confirm
7. If new username is taken, error shown
8. If success, username updates immediately

---

## Key Design Decisions

### Uniqueness Enforcement
- **Database level:** UNIQUE constraint prevents duplicates even if multiple requests overlap
- **Application level:** Check availability before update, with error handling for race conditions

### Case Insensitivity
- Usernames converted to lowercase for storage
- Prevents "admin" and "Admin" from being different users
- Better UX (users don't have to remember exact casing)

### Format Validation
- 3-30 characters (good balance between meaningful & manageable)
- Alphanumeric + underscore + hyphen (common, readable)
- No special characters (simpler, cleaner)

### Availability Check Before Confirm
- UX: Users see "Check availability" → "Confirm username" workflow
- Prevents surprise errors on confirm
- Gives time to pick alternative if taken

---

## API Reference

### `lib/username.ts` Functions

```typescript
// Validate format
const result = validateUsernameFormat("john_doe");
if (!result.ok) console.log(result.error);

// Check if available in database
const check = await checkUsernameAvailable("john_doe");
if (check.available) {
  // Safe to use
} else {
  // Already taken: check.error tells why
}

// Update in database
const update = await updateUsername(userId, "john_doe");
if (update.ok) {
  // Success
} else {
  // Failed: update.error tells why
}

// Look up a profile
const profile = await getProfileByUsername("john_doe");
if (profile) {
  console.log(profile.bio, profile.current_streak);
}
```

---

## Error Handling

The implementation handles:
- ❌ Empty/blank usernames
- ❌ Too short (<3) or too long (>30)
- ❌ Invalid characters
- ❌ Starting/ending with special chars
- ❌ Username already taken
- ❌ Database connection errors
- ❌ Supabase configuration missing

Each error returns a user-friendly message.

---

## Next Steps (Future Features)

To extend this:

1. **Avatar upload:**
   - Add image picker in account screen
   - Store in Supabase Storage
   - Update `avatar_url` in profiles table

2. **Bio/Profile editing:**
   - Add bio text field in account screen
   - Update profiles table

3. **Search by username:**
   - Use `getProfileByUsername()` to search
   - Display in friend search screen

4. **Display usernames everywhere:**
   - Show `@username` on activity feed
   - Show on friend profiles
   - Show on marketplace split creators

5. **Mention system:**
   - Use `@username` in comments/messages
   - Link to user profiles

---

## Files Modified/Created

**Created:**
- `lib/username.ts` - Validation & database functions
- `app/(auth)/username.tsx` - Username setup screen

**Modified:**
- `lib/supabase-types.ts` - Added Profile type
- `app/_layout.tsx` - Added username setup routing
- `app/(tabs)/account.tsx` - Added username display & editing

**Database:**
- `supabase/schema.sql` - Add UNIQUE constraint & index

---

## Testing Checklist

- [ ] User can sign up and set username
- [ ] Cannot use username with <3 or >30 characters
- [ ] Cannot use special characters other than _ and -
- [ ] Cannot use username that's already taken
- [ ] Can edit username from account screen
- [ ] Usernames are case-insensitive (stored as lowercase)
- [ ] Old username can be reused after changing
- [ ] Error messages are clear and helpful
- [ ] "Check availability" works before confirming
- [ ] Offline app (without Supabase) still works

