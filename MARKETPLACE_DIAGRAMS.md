# Marketplace System Diagram

## High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                   MARKETPLACE TAB                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────────── TRENDING SPLITS ─────────────────┐ │
│  │ [Card] [Card] [Card] [Card]                        │ │
│  │ (Horizontal scroll - sorted by like velocity)      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌────────────────── ALL-TIME GREATS ────────────────┐ │
│  │ ┌──────────────────────────────────────────────┐ │ │
│  │ │ [Split Name]                          ❤️ 42 │ │ │
│  │ │ [Description...]                       📥   │ │ │
│  │ └──────────────────────────────────────────────┘ │ │
│  │ ┌──────────────────────────────────────────────┐ │ │
│  │ │ [Split Name]                          ❤️ 38 │ │ │
│  │ │ [Description...]                       📥   │ │ │
│  │ └──────────────────────────────────────────────┘ │ │
│  │ [... 5 total splits ...]                         │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Data Flow: Load & Display

```
┌────────────────────────────────────────────────────────────┐
│ Component Mount: marketplace.tsx useEffect                 │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ Check: Supabase configured?                                │
│ - If NO → show offline message                             │
│ - If YES → proceed                                         │
└────────────────────────────────────────────────────────────┘
                           ↓
         ┌─────────────────┼─────────────────┐
         ↓                 ↓                 ↓
    Query 1:           Query 2:          Query 3:
    All splits      Likes (7 days)    User's likes
    from DB         from DB           (if logged in)
         │                 │                 │
         └─────────────────┼─────────────────┘
                           ↓
    ┌─────────────────────────────────────────┐
    │ State Updates:                          │
    │ - setSplits(parsed rows)                │
    │ - setRecentLikes(last 7 days)          │
    │ - setLikedIds(user's liked IDs)        │
    │ - setLoading(false)                     │
    └─────────────────────────────────────────┘
                           ↓
    ┌─────────────────────────────────────────┐
    │ useMemo Computations:                   │
    │ - Trending = sort by like velocity      │
    │ - AllTimeGreats = top 5 by total likes  │
    └─────────────────────────────────────────┘
                           ↓
    ┌─────────────────────────────────────────┐
    │ Render:                                 │
    │ 1. Trending section (FlatList horiz)    │
    │ 2. All-Time Greats section (vertical)   │
    │ 3. Each card with like + download btns  │
    └─────────────────────────────────────────┘
```

---

## Like Button Flow

```
USER TAPS HEART ICON
         ↓
    onToggleLike()
         ↓
┌──────────────────────────────────┐
│ 1. OPTIMISTIC UPDATE             │
│ - Immediately update UI          │
│ - Show new like count            │
│ - Change heart to filled         │
│ - Play haptic                    │
└──────────────────────────────────┘
         ↓
┌──────────────────────────────────┐
│ 2. CHECK AUTH                    │
│ - User logged in?                │
│ - NO → revert + alert            │
│ - YES → proceed                  │
└──────────────────────────────────┘
         ↓
      ┌──┴──┐
   LIKE?    UNLIKE?
    │         │
    ↓         ↓
 INSERT    DELETE
 from      from
  likes    likes
    │         │
    └──┬──────┘
       ↓
┌──────────────────────────────────┐
│ 3. SERVER RESPONSE               │
│ - Error? → revert UI + alert     │
│ - Success? → keep UI + refresh   │
└──────────────────────────────────┘
       ↓
 Re-run load()
       ↓
 Other users see
 updated count
```

---

## Import Button Flow

```
USER TAPS "DOWNLOAD TO MY TRAINER"
         ↓
    onDownload(split)
         ↓
parseMarketplaceStructureJson()
         ↓
┌──────────────────────────────┐
│ Validate structure_json:     │
│ - Has slots array?           │
│ - Has exercise info?         │
│ - Is valid JSON?             │
│ - Return NULL if invalid ✗   │
└──────────────────────────────┘
         ↓
   ✓ Valid?
    /      \
   YES      NO
   │        └→ Show error alert
   ↓
┌──────────────────────────────────┐
│ Parse & Transform:               │
│ 1. For each slot:                │
│    - Keep workout name           │
│    - Map exercise names/IDs      │
│    - Create NEW fresh IDs        │
│    - Create Exercise objects     │
│ 2. Pad slots to 7                │
└──────────────────────────────────┘
         ↓
importSplitBundle()
(from workout-store context)
         ↓
┌──────────────────────────────────┐
│ Add to Local Splits:             │
│ - Generate new split ID          │
│ - Name: "{original} (imported)"  │
│ - Save to AsyncStorage           │
└──────────────────────────────────┘
         ↓
┌──────────────────────────────────┐
│ Success Feedback:                │
│ - Haptic notification ✓          │
│ - Alert message                  │
│ - "Open Log tab & pick split"    │
└──────────────────────────────────┘
```

---

## Realtime Update Architecture

```
┌─────────────────────────────────────────┐
│ On Component Mount:                     │
│ supabase.channel("marketplace-splits")  │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ Listen for "UPDATE" events on splits    │
│ table                                   │
└─────────────────────────────────────────┘
         ↓
ANY USER LIKES A SPLIT
         ↓
┌─────────────────────────────────────────┐
│ 1. Insert into likes table ✓            │
│ 2. Update splits.likes_count ✓          │
│ 3. Trigger UPDATE event ✓               │
└─────────────────────────────────────────┘
         ↓
ALL CONNECTED CLIENTS
receive the event
         ↓
┌─────────────────────────────────────────┐
│ Call load() to refresh data             │
│ - Fetch updated splits                  │
│ - Fetch updated likes                   │
│ - Re-compute trending                   │
│ - UI updates automatically              │
└─────────────────────────────────────────┘
```

---

## Trending Score Calculation

```
For each split:

likes_count = 42
created_at = "2 days ago"

days = 2
denom = (2 + 2) ^ 1.8  = 4 ^ 1.8 ≈ 6.96
score = 42 / 6.96 ≈ 6.0

For a split with:
likes_count = 200
created_at = "30 days ago"

days = 30
denom = (30 + 2) ^ 1.8 = 32 ^ 1.8 ≈ 5824
score = 200 / 5824 ≈ 0.034

Result: New split with few likes ranks higher
        because it's trending NOW (like Hacker News)
```

---

## State Management Flow

```
┌─────────────────────────────────┐
│ Local State in marketplace.tsx   │
├─────────────────────────────────┤
│ [splits]                        │ ← All splits from DB
│ [recentLikes]                   │ ← Likes from past 7 days
│ [likedIds]                      │ ← User's liked split IDs
│ [optimistic]                    │ ← Pending likes/unlikes
│ [loading]                       │ ← Loading indicator
│ [error]                         │ ← Error message
└─────────────────────────────────┘
         ↓
    useMemo()
    mergeDisplay()
         ↓
┌─────────────────────────────────┐
│ Computed Display Values         │
├─────────────────────────────────┤
│ trending                        │ ← Sorted by velocity
│ allTimeGreats                   │ ← Top 5 by likes
│ For each card:                  │
│   - liked: boolean              │
│   - likes_count: number         │
│   - velocity: number            │
└─────────────────────────────────┘
         ↓
    renderSplitCard()
         ↓
┌─────────────────────────────────┐
│ Rendered UI                     │
└─────────────────────────────────┘
```

---

## Error Handling Paths

```
Supabase Not Configured
         ↓
    Show: "Cloud offline" message
    
        ↓
        
Query Fails (network error)
         ↓
    Show: Error banner + retry button
    
        ↓
        
Like Insert Fails
         ↓
    Revert optimistic UI
    Show: "Like failed" alert
    
        ↓
        
Structure JSON Invalid
         ↓
    Show: "Cannot import" alert
    Suggest: "Invalid structure_json"
    
        ↓
        
User Not Logged In
         ↓
    Like attempt resets
    Show: "Sign in to like" alert
```

---

## Performance Optimizations

✅ **Implemented**
- Optimistic UI (no loading delay)
- Realtime subscriptions (no manual refresh)
- useMemo for expensive sorts
- FlatList for horizontal trending scroll

⚠️ **Could Add**
- Pagination (load splits in batches)
- Cache trending scores
- Debounce like requests
- Infinite scroll for all-time section

