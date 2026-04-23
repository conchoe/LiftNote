# Quick Start: Unique Usernames

## TL;DR - What You Get

✅ Users create/edit unique usernames when signing up  
✅ Validation: 3-30 chars, alphanumeric + underscore/hyphen  
✅ Database enforces uniqueness  
✅ Edit username anytime from Account tab  

---

## Setup (5 minutes)

### 1. Database
Run in Supabase SQL editor:
```sql
ALTER TABLE public.profiles ADD CONSTRAINT username_unique UNIQUE(username);
CREATE INDEX idx_profiles_username ON public.profiles(username);
```

### 2. Test It
- Sign up with email/password
- Set a username
- Go to Account tab → edit username
- Try using a username that's taken (should fail)
- Done!

---

## Architecture

```
User Signs Up
    ↓
Login Screen → Username Setup Screen
    ↓
Enters username
    ↓
Clicks "Check Availability"
    ↓
Queries profiles table (via lib/username.ts)
    ↓
If available → shows green checkmark
If taken → shows red error
    ↓
Clicks "Confirm Username"
    ↓
Saved to database
    ↓
Routes to main app (tabs)
```

---

## Code Examples

### Check if username is available
```typescript
import { checkUsernameAvailable } from "@/lib/username";

const result = await checkUsernameAvailable("john_doe");
if (result.available) {
  console.log("Username is free!");
} else {
  console.log("Already taken:", result.error);
}
```

### Update username
```typescript
import { updateUsername } from "@/lib/username";

const result = await updateUsername(userId, "jane_smith");
if (result.ok) {
  console.log("Username updated!");
} else {
  console.log("Error:", result.error);
}
```

### Get profile by username
```typescript
import { getProfileByUsername } from "@/lib/username";

const profile = await getProfileByUsername("john_doe");
if (profile) {
  console.log(`Found ${profile.username}, streak: ${profile.current_streak}`);
}
```

---

## What's New in Each File

| File | Changes |
|------|---------|
| `lib/username.ts` | ✨ NEW - Validation & DB helpers |
| `app/(auth)/username.tsx` | ✨ NEW - Setup screen |
| `lib/supabase-types.ts` | Added Profile type |
| `app/_layout.tsx` | Routes to username screen after signup |
| `app/(tabs)/account.tsx` | Added username display & editing UI |

---

## Customization

### Change username length
Edit `lib/username.ts`:
```typescript
if (trimmed.length < 5) { // was 3
  return { ok: false, error: "Min 5 chars" };
}
```

### Allow more characters
Edit regex in `lib/username.ts`:
```typescript
if (!/^[a-zA-Z0-9_\-\.]+$/.test(trimmed)) { // add \. for dots
```

### Change appearance
Edit styles in `app/(auth)/username.tsx` or `app/(tabs)/account.tsx`

---

## Troubleshooting

**"Username not found" on profile lookup?**
- Make sure you're using lowercase
- Check if user exists in `profiles` table
- Verify Supabase RLS policies allow reads

**"Already taken" but I just created it?**
- Someone else might have taken it simultaneously
- Try a different username
- Or wait a moment and try again

**Edit button doesn't appear?**
- Ensure user is logged in (`authEnabled` is true)
- Check `profileLoaded` state in console
- Verify Supabase connection

---

## Future Ideas

- Add `@username` mentions in chat/comments
- Display usernames on friend profiles
- Search friends by `@username`
- Show username badges in leaderboards
- Username verification/badges
- Custom profile pages: `/profile/username`

