import { describe, expect, it } from "vitest";
import { diffFollowers, makeSnapshot, type Follower } from "./followerChanges";

const follower = (id: string, followedAt = "2024-01-01T00:00:00Z"): Follower => ({
  id,
  login: `user${id}`,
  name: `User${id}`,
  followedAt,
});

describe("diffFollowers", () => {
  it("reports new followers and unfollows against the snapshot", () => {
    const snapshot = makeSnapshot([follower("1"), follower("2")], false);

    const changes = diffFollowers(snapshot, [follower("3"), follower("1")], false);

    expect(changes.gained.map((f) => f.id)).toEqual(["3"]);
    expect(changes.lost).toEqual([{ id: "2", login: "user2", name: "User2" }]);
    expect(changes.lostKnown).toBe(true);
  });

  it("reports nothing when the list is unchanged", () => {
    const list = [follower("1"), follower("2")];

    const changes = diffFollowers(makeSnapshot(list, false), list, false);

    expect(changes).toEqual({ gained: [], lost: [], lostKnown: true });
  });

  it("skips unfollows when the current list is truncated", () => {
    const snapshot = makeSnapshot([follower("1"), follower("2")], false);

    const changes = diffFollowers(snapshot, [follower("1")], true);

    expect(changes.lost).toEqual([]);
    expect(changes.lostKnown).toBe(false);
  });

  it("only counts followers after a truncated snapshot as new", () => {
    const at = Date.parse("2024-06-01T00:00:00Z");
    const snapshot = makeSnapshot([follower("1")], true, at);

    const changes = diffFollowers(
      snapshot,
      [
        follower("9", "2024-06-02T00:00:00Z"),
        follower("1"),
        // Older than the snapshot but beyond its cap — not actually new.
        follower("5", "2023-01-01T00:00:00Z"),
      ],
      false,
    );

    expect(changes.gained.map((f) => f.id)).toEqual(["9"]);
  });
});
