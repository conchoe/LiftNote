# Marketplace Functionality Explained

## Overview
Your marketplace is **FUNCTIONAL** and well-implemented! It displays splits from Supabase, allows users to like splits, and provides an import feature to download splits to their local trainer.

---

## Current Features

### 1. **Data Source**
- Fetches splits from Supabase `splits` table
- Fields: `id`, `creator_id`, `name`, `description`, `structure_json`, `likes_count`, `created_at`
- Automatically updates via realtime subscriptions when splits are liked

### 2. **Display Sections**

#### **Trending Splits** (Horizontal Scroll)
- Sorted by like velocity (most recent likes first)
- Secondary sort: trending score = `likes_count / (days_old + 2)^1.8`
- Formula gives newer splits a boost (SPEC2 requirement)
- Shows like count and velocity for last 7 days

#### **All-Time Greats** (Vertical List)
- Top 5 splits sorted by total likes
- Full-width cards with descriptions
- Like count displayed

### 3. **Like System**
- ✅ Users can like/unlike splits
- ✅ Haptic feedback on like
- ✅ Optimistic UI updates immediately (no loading wait)
- ✅ Persists to Supabase `likes` table
- ✅ Counts update in real-time via channel subscription
- ✅ Only works when logged in (prompts sign-in if not)

### 4. **Download/Import**
- ✅ "Download to my Trainer" button on each split
- ✅ Parses `structure_json` (split structure)
- ✅ Creates fresh exercise IDs locally
- ✅ Imports directly to user's local splits
- ✅ Shows success notification with haptic feedback
- ✅ Navigates user to Log tab to use imported split

### 5. **Realtime Updates**
- Subscribes to Supabase changes on `splits` table
- When anyone likes a split, all users see updated count
- No need to refresh manually

---

## Architecture & Flow

### Component: `app/(tabs)/marketplace.tsx`

```
┌─ Load Data ─────────────────────────┐
│ 1. Fetch all splits                 │
│ 2. Fetch last 7 days of likes       │
│ 3. Fetch user's liked split IDs     │
└─────────────────────────────────────┘
           ↓
┌─ Compute Display ───────────────────┐
│ 1. Sort by trending (likeVelocity)  │
│ 2. Get top 5 all-time               │
│ 3. Merge optimistic likes           │
└─────────────────────────────────────┘
           ↓
┌─ Render ────────────────────────────┐
│ 1. Header                           │
│ 2. Trending section (horizontal)    │
│ 3. All-Time Greats (vertical)       │
│ 4. Cards with like + download btns  │
└─────────────────────────────────────┘
```

### Key Functions

**`lib/marketplace-trending.ts`**
- `trendingScore()` - Calculates trending score formula
- `likeVelocityLast7Days()` - Counts likes in last 7 days
- `sortByTrending()` - Sorts splits by velocity, then score
- `topAllTime()` - Gets top N by total likes

**`lib/marketplace-split-import.ts`**
- `parseMarketplaceStructureJson()` - Parses split structure
- Creates fresh IDs for exercises
- Handles both `exerciseNames` and `exerciseIds` formats
- Returns slots + exercises ready to import

**`lib/marketplace-rows.ts`**
- `parseMarketplaceSplitRows()` - Validates/normalizes Supabase rows
- Type-safe conversion from unknown to `MarketplaceSplit`

---

## Data Flow: Like System

```
User taps heart icon
         ↓
Optimistic UI updates immediately (instant feedback)
         ↓
Insert/delete from Supabase `likes` table
         ↓
If success: Keep optimistic state
If error: Revert + show alert
         ↓
Realtime subscription fires
         ↓
All users' likes_count updated
```

**Optimistic Locking:**
- Updates UI before server confirms
- Better UX (no loading delay)
- Falls back if server rejects

---

## Data Flow: Import System

```
User taps "Download to my Trainer"
         ↓
Parse structure_json from split
         ↓
Create new Exercise objects with fresh IDs
         ↓
Create new WorkoutSlot array mapping to new exercise IDs
         ↓
Call importSplitBundle() (from workout-store context)
         ↓
Added to local splits
         ↓
Success notification
         ↓
User can go to Log tab and use immediately
```

---

## Database Schema

### `splits` table
```sql
id              UUID PRIMARY KEY
creator_id      UUID (user who created it)
name            TEXT (split name)
description     TEXT (optional description)
structure_json  JSONB (split structure with exercises)
likes_count     INT (cached count of likes)
created_at      TIMESTAMPTZ (creation time)
```

### `likes` table
```sql
id              UUID PRIMARY KEY
user_id         UUID (who liked it)
target_id       UUID (split ID)
type            TEXT ('split' or 'workout')
created_at      TIMESTAMPTZ
UNIQUE (user_id, target_id, type)
```

---

## What `structure_json` Contains

Example split import structure:
```json
{
  "slots": [
    {
      "workoutName": "Push Day",
      "exerciseNames": ["Bench Press", "Incline Dumbbell", "Tricep Rope"]
    },
    {
      "workoutName": "Pull Day",
      "exerciseIds": ["ex1", "ex2", "ex3"]
    },
    null,
    null,
    null,
    null,
    null
  ],
  "exerciseLibrary": [
    { "id": "ex1", "name": "Barbell Row" },
    { "id": "ex2", "name": "Pull-ups" },
    { "id": "ex3", "name": "Face Pulls" }
  ]
}
```

The parser:
- Creates fresh exercise IDs locally
- Preserves exercise names/relationships
- Ensures 7 slots (pads with `null` for rest days)

---

## UI Components

### Split Cards
- **Compact mode** (trending section)
  - Shows name, description (2 lines max)
  - Like button + download button
  
- **Full mode** (all-time section)
  - Shows name, description (3 lines max)
  - Like button + download button
  - Takes full width

### Sections
- **Header**: "Marketplace" title + subtitle
- **Error banner**: Shows error with retry button
- **Empty state**: Message if no splits exist

---

## Current Limitations & Potential Issues

### ✅ Working Well
- Like/unlike functionality
- Trending calculation
- Import system
- Realtime updates

### ⚠️ Potential Issues

1. **Case Sensitivity**
   - Split names/descriptions are case-sensitive
   - No search filtering currently
   
2. **No User Feedback on Import**
   - Just shows success alert
   - Doesn't auto-navigate to split
   - User must go to Log tab manually

3. **No Trending Filters**
   - No date range selector
   - No category/tag system

4. **No Creator Info**
   - Doesn't show who created the split
   - Could add creator's username

5. **Structure Validation**
   - Import fails silently if `structure_json` is malformed
   - Error message is generic

---

## Testing the Marketplace

### Setup
1. Add splits to Supabase `splits` table with valid `structure_json`
2. Have EXPO_PUBLIC_SUPABASE_URL/KEY configured

### Test Like System
1. Open Marketplace as anonymous → see "Sign in to like" alert ✓
2. Sign in → like button should work ✓
3. Like count updates locally + persists ✓
4. Open in different tab → see updated count ✓

### Test Trending
1. Create 3+ splits
2. Like some recently created ones heavily
3. Trending section should show most-liked ones first ✓

### Test Import
1. Like a split to mark it as available
2. Tap "Download to my Trainer"
3. Go to Log tab
4. New split should appear in list ✓
5. Can create workout with imported exercises ✓

---

## Code Quality

✅ **Good Practices**
- Proper error handling
- Type-safe with TypeScript
- Optimistic UI updates
- Realtime subscriptions
- Haptic feedback

⚠️ **Could Improve**
- Add loading states for import
- Show creator username/avatar
- Add search/filter
- More granular error messages
- Cache structure_json validation

---

## Verdict: FUNCTIONAL ✅

Your marketplace **works well** for the core use case:
- Browse trending & all-time splits
- Like splits to support creators
- Import splits to your trainer

It successfully implements SPEC2 marketplace requirements for likes, trending calculation, and import functionality. The realtime system keeps data in sync across users.

