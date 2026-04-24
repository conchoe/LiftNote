/** Row shape for `public.profiles`. */
export type Profile = {
  id: string; // UUID of auth user
  username: string;
  avatar_url: string | null;
  current_streak: number;
  bio: string | null;
  is_private: boolean;
  created_at: string;
};

/** Row shape for `public.splits` (marketplace). */
export type MarketplaceSplit = {
  id: string;
  creator_id: string | null;
  /** Filled in the client from `profiles.username` for display */
  creator_display_name?: string | null;
  name: string;
  description: string | null;
  structure_json: unknown;
  likes_count: number;
  created_at: string;
};
