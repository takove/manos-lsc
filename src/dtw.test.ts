import { describe, expect, test } from "vitest";
import { dtw } from "./dtw";

describe("DTW distances and correspondence", () => {
  test("self distance is zero with a monotone diagonal path", () => {
    expect(
      dtw(
        [
          [0, 0],
          [1, 2],
          [2, 3],
        ],
        [
          [0, 0],
          [1, 2],
          [2, 3],
        ],
      ),
    ).toEqual({
      distance: 0,
      normalizedDistance: 0,
      path: [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
    });
  });
  test("a held frame aligns without a motion penalty", () => {
    expect(dtw([[0], [1], [2]], [[0], [1], [1], [2]])).toEqual({
      distance: 0,
      normalizedDistance: 0,
      path: [
        [0, 0],
        [1, 1],
        [1, 2],
        [2, 3],
      ],
    });
  });
  test("reversing a directed trajectory has a positive distance", () => {
    expect(dtw([[0], [1], [2]], [[2], [1], [0]]).distance).toBe(4);
  });
  test("known scalar distance and rectangular boundaries", () => {
    expect(dtw([[1]], [[3], [4]])).toEqual({
      distance: 5,
      normalizedDistance: 1,
      path: [
        [0, 0],
        [0, 1],
      ],
    });
    expect(dtw([[3], [4]], [[1]]).path).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });
  test("cost is symmetric and path spans input endpoints", () => {
    const a = [
        [0, 0],
        [2, 1],
        [3, 0],
      ],
      b = [
        [1, 0],
        [3, 2],
      ];
    const forward = dtw(a, b),
      backward = dtw(b, a);
    expect(forward.distance).toBe(backward.distance);
    expect(forward.path[0]).toEqual([0, 0]);
    expect(forward.path.at(-1)).toEqual([2, 1]);
  });
  test.each([
    [[], [[1]]],
    [[[1]], []],
    [[[]], [[]]],
    [[[1]], [[1, 2]]],
    [[[1], [2, 3]], [[1]]],
    [[[NaN]], [[1]]],
    [[[Infinity]], [[1]]],
    [[[1]], [[Number.MAX_VALUE]]],
    [[[1]], [[undefined]]],
    [[Array(1)], [[1]]],
    [Array(2), [[1]]],
    [null, [[1]]],
    [[[1]], null],
  ])("invalid/overflowing input returns no plausible path (%#)", (a, b) => {
    expect(dtw(a as number[][], b as number[][])).toEqual({
      distance: Infinity,
      normalizedDistance: 1,
      path: [],
    });
  });
});
