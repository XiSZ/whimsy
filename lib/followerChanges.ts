export interface Follower {
  id: string;
  login: string;
  name: string;
  followedAt: string;
}

// What the Followers tab last showed as "seen": id → [login, name], so
// people who unfollowed can still be named afterwards.
export interface FollowerSnapshot {
  at: number;
  truncated: boolean;
  followers: Record<string, [string, string]>;
}

export interface FollowerChanges {
  gained: Follower[];
  lost: Array<Pick<Follower, "id" | "login" | "name">>;
  // false when the current list is cut short, so unfollows can't be told
  // apart from followers beyond the cap.
  lostKnown: boolean;
}

export function makeSnapshot(
  followers: Follower[],
  truncated: boolean,
  at = Date.now(),
): FollowerSnapshot {
  return {
    at,
    truncated,
    followers: Object.fromEntries(
      followers.map((follower) => [follower.id, [follower.login, follower.name]]),
    ),
  };
}

export function diffFollowers(
  snapshot: FollowerSnapshot,
  current: Follower[],
  truncated: boolean,
): FollowerChanges {
  // A capped snapshot never saw the oldest followers, so someone missing
  // from it is only new if they followed after it was taken.
  const gained = current.filter(
    (follower) =>
      !(follower.id in snapshot.followers) &&
      (!snapshot.truncated || Date.parse(follower.followedAt) >= snapshot.at),
  );

  if (truncated) return { gained, lost: [], lostKnown: false };

  const currentIds = new Set(current.map((follower) => follower.id));
  const lost = Object.entries(snapshot.followers)
    .filter(([id]) => !currentIds.has(id))
    .map(([id, [login, name]]) => ({ id, login, name }));

  return { gained, lost, lostKnown: true };
}
