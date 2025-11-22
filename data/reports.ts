
import { TestReport, TestType, TestSubType } from '../types';

export const INITIAL_REPORTS: TestReport[] = [
    {
      "id": "test-2025-06-15",
      "testDate": "2025-06-15",
      "testName": "WTA-5",
      "type": TestType.ChapterTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 9, "rank": 2879, "correct": 3, "wrong": 6, "unanswered": 8, "partial": 1 },
      "physics": { "marks": 10, "rank": 2518, "correct": 3, "wrong": 6, "unanswered": 8, "partial": 1 },
      "chemistry": { "marks": 3, "rank": 3202, "correct": 1, "wrong": 4, "unanswered": 12, "partial": 1 },
      "total": { "marks": 22, "rank": 2741, "correct": 7, "wrong": 16, "unanswered": 28, "partial": 3 }
    },
    {
      "id": "test-2025-06-22",
      "testDate": "2025-06-22",
      "testName": "WTA-6",
      "type": TestType.ChapterTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 4, "rank": 3188, "correct": 2, "wrong": 9, "unanswered": 5, "partial": 2 },
      "physics": { "marks": 8, "rank": 2615, "correct": 2, "wrong": 4, "unanswered": 11, "partial": 1 },
      "chemistry": { "marks": 15, "rank": 2708, "correct": 4, "wrong": 4, "unanswered": 8, "partial": 2 },
      "total": { "marks": 27, "rank": 2741, "correct": 8, "wrong": 17, "unanswered": 24, "partial": 5 }
    },
    {
      "id": "test-2025-06-29",
      "testDate": "2025-06-29",
      "testName": "WTA-7",
      "type": TestType.ChapterTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 12, "rank": 2915, "correct": 5, "wrong": 6, "unanswered": 6, "partial": 2 },
      "physics": { "marks": 14, "rank": 2337, "correct": 3, "wrong": 7, "unanswered": 7, "partial": 2 },
      "chemistry": { "marks": 14, "rank": 2953, "correct": 2, "wrong": 6, "unanswered": 7, "partial": 4 },
      "total": { "marks": 40, "rank": 2618, "correct": 10, "wrong": 19, "unanswered": 20, "partial": 8 }
    },
    {
      "id": "test-2025-07-13",
      "testDate": "2025-07-13",
      "testName": "WTA-9",
      "type": TestType.ChapterTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 2, "rank": 5375, "correct": 1, "wrong": 7, "unanswered": 8, "partial": 1 },
      "physics": { "marks": 6, "rank": 4060, "correct": 3, "wrong": 9, "unanswered": 4, "partial": 1 },
      "chemistry": { "marks": 8, "rank": 3431, "correct": 2, "wrong": 7, "unanswered": 7, "partial": 1 },
      "total": { "marks": 16, "rank": 4623, "correct": 6, "wrong": 23, "unanswered": 19, "partial": 3 }
    },
    {
      "id": "test-2025-07-20",
      "testDate": "2025-07-20",
      "testName": "WTA-10",
      "type": TestType.ChapterTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 23, "rank": 1502, "correct": 7, "wrong": 5, "unanswered": 4, "partial": 2 },
      "physics": { "marks": 18, "rank": 2293, "correct": 5, "wrong": 2, "unanswered": 10, "partial": 1 },
      "chemistry": { "marks": 11, "rank": 1945, "correct": 3, "wrong": 7, "unanswered": 4, "partial": 4 },
      "total": { "marks": 52, "rank": 1778, "correct": 15, "wrong": 14, "unanswered": 18, "partial": 7 }
    },
    {
      "id": "test-2025-08-03",
      "testDate": "2025-08-03",
      "testName": "WTA-11",
      "type": TestType.ChapterTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 6, "rank": 3296, "correct": 2, "wrong": 3, "unanswered": 13, "partial": 0 },
      "physics": { "marks": 9, "rank": 3465, "correct": 4, "wrong": 6, "unanswered": 7, "partial": 1 },
      "chemistry": { "marks": 6, "rank": 4102, "correct": 2, "wrong": 6, "unanswered": 10, "partial": 0 },
      "total": { "marks": 21, "rank": 3668, "correct": 8, "wrong": 15, "unanswered": 30, "partial": 1 }
    },
    {
      "id": "test-2025-08-17a",
      "testDate": "2025-08-17",
      "testName": "WTA-12",
      "type": TestType.ChapterTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 4, "rank": 3660, "correct": 1, "wrong": 7, "unanswered": 9, "partial": 1 },
      "physics": { "marks": 3, "rank": 3318, "correct": 1, "wrong": 8, "unanswered": 9, "partial": 0 },
      "chemistry": { "marks": 15, "rank": 750, "correct": 4, "wrong": 8, "unanswered": 5, "partial": 1 },
      "total": { "marks": 22, "rank": 2273, "correct": 6, "wrong": 23, "unanswered": 23, "partial": 2 }
    },
    {
      "id": "test-2025-08-17b",
      "testDate": "2025-08-17",
      "testName": "WTA-13",
      "type": TestType.ChapterTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 9, "rank": 3184, "correct": 2, "wrong": 9, "unanswered": 5, "partial": 2 },
      "physics": { "marks": -6, "rank": 5243, "correct": 0, "wrong": 11, "unanswered": 7, "partial": 0 },
      "chemistry": { "marks": 12, "rank": 2711, "correct": 3, "wrong": 8, "unanswered": 6, "partial": 1 },
      "total": { "marks": 15, "rank": 4021, "correct": 5, "wrong": 28, "unanswered": 18, "partial": 3 }
    },
    {
      "id": "test-2025-08-24a",
      "testDate": "2025-08-24",
      "testName": "CTA-13",
      "type": TestType.PartTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": -5, "rank": 4505, "correct": 0, "wrong": 7, "unanswered": 11, "partial": 0 },
      "physics": { "marks": 17, "rank": 899, "correct": 4, "wrong": 2, "unanswered": 11, "partial": 1 },
      "chemistry": { "marks": 1, "rank": 4274, "correct": 1, "wrong": 4, "unanswered": 13, "partial": 0 },
      "total": { "marks": 13, "rank": 3465, "correct": 5, "wrong": 13, "unanswered": 35, "partial": 1 }
    },
    {
      "id": "test-2025-08-24b",
      "testDate": "2025-08-24",
      "testName": "WTA-14",
      "type": TestType.ChapterTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 15, "rank": 2980, "correct": 6, "wrong": 8, "unanswered": 2, "partial": 2 },
      "physics": { "marks": 6, "rank": 3728, "correct": 2, "wrong": 4, "unanswered": 12, "partial": 0 },
      "chemistry": { "marks": 18, "rank": 1726, "correct": 6, "wrong": 4, "unanswered": 4, "partial": 4 },
      "total": { "marks": 39, "rank": 2293, "correct": 14, "wrong": 16, "unanswered": 18, "partial": 6 }
    },
    {
      "id": "test-2025-09-08",
      "testDate": "2025-09-08",
      "testName": "CTA-16",
      "type": TestType.PartTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 5, "rank": 2802, "correct": 2, "wrong": 7, "unanswered": 9, "partial": 0 },
      "physics": { "marks": -2, "rank": 3790, "correct": 0, "wrong": 7, "unanswered": 11, "partial": 0 },
      "chemistry": { "marks": 2, "rank": 3043, "correct": 1, "wrong": 6, "unanswered": 11, "partial": 0 },
      "total": { "marks": 5, "rank": 3608, "correct": 3, "wrong": 20, "unanswered": 31, "partial": 0 }
    },
    {
      "id": "test-2025-09-14a",
      "testDate": "2025-09-14",
      "testName": "WTA-17",
      "type": TestType.ChapterTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 5, "rank": 4377, "correct": 1, "wrong": 7, "unanswered": 8, "partial": 2 },
      "physics": { "marks": 2, "rank": 4494, "correct": 1, "wrong": 8, "unanswered": 8, "partial": 1 },
      "chemistry": { "marks": 21, "rank": 1773, "correct": 5, "wrong": 7, "unanswered": 2, "partial": 4 },
      "total": { "marks": 28, "rank": 3606, "correct": 7, "wrong": 22, "unanswered": 18, "partial": 7 }
    },
    {
      "id": "test-2025-09-14b",
      "testDate": "2025-09-14",
      "testName": "CTA-17",
      "type": TestType.PartTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 7, "rank": 2946, "correct": 2, "wrong": 6, "unanswered": 9, "partial": 1 },
      "physics": { "marks": 2, "rank": 4226, "correct": 1, "wrong": 8, "unanswered": 8, "partial": 1 },
      "chemistry": { "marks": 6, "rank": 2828, "correct": 2, "wrong": 10, "unanswered": 3, "partial": 3 },
      "total": { "marks": 15, "rank": 3699, "correct": 5, "wrong": 24, "unanswered": 20, "partial": 5 }
    },
    {
      "id": "test-2025-09-21a",
      "testDate": "2025-09-21",
      "testName": "WTA-18",
      "type": TestType.ChapterTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 0, "rank": 4719, "correct": 1, "wrong": 3, "unanswered": 14, "partial": 0 },
      "physics": { "marks": 5, "rank": 4402, "correct": 1, "wrong": 2, "unanswered": 14, "partial": 1 },
      "chemistry": { "marks": 15, "rank": 3975, "correct": 2, "wrong": 1, "unanswered": 11, "partial": 4 },
      "total": { "marks": 20, "rank": 4627, "correct": 4, "wrong": 6, "unanswered": 39, "partial": 5 }
    },
    {
      "id": "test-2025-09-21b",
      "testDate": "2025-09-21",
      "testName": "CTA-18",
      "type": TestType.PartTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 5, "rank": 3414, "correct": 1, "wrong": 0, "unanswered": 16, "partial": 1 },
      "physics": { "marks": 14, "rank": 1030, "correct": 4, "wrong": 1, "unanswered": 10, "partial": 3 },
      "chemistry": { "marks": 21, "rank": 940, "correct": 5, "wrong": 0, "unanswered": 10, "partial": 3 },
      "total": { "marks": 40, "rank": 1477, "correct": 10, "wrong": 1, "unanswered": 36, "partial": 7 }
    },
    {
      "id": "test-2025-10-11",
      "testDate": "2025-10-11",
      "testName": "EGM - 2",
      "type": TestType.FullSyllabusMock,
      "subType": TestSubType.JEEMains,
      "physics": { "marks": 29, "rank": 8, "correct": 8, "wrong": 3, "unanswered": 14, "partial": 0 },
      "chemistry": { "marks": 26, "rank": 22, "correct": 7, "wrong": 2, "unanswered": 16, "partial": 0 },
      "maths": { "marks": 23, "rank": 7, "correct": 7, "wrong": 5, "unanswered": 13, "partial": 0 },
      "total": { "marks": 78, "rank": 10, "correct": 22, "wrong": 10, "unanswered": 43, "partial": 0 }
    },
    {
      "id": "test-2025-10-12",
      "testDate": "2025-10-12",
      "testName": "WTA-20",
      "type": TestType.ChapterTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 3, "rank": 3812, "correct": 1, "wrong": 1, "unanswered": 14, "partial": 2 },
      "physics": { "marks": 8, "rank": 2700, "correct": 2, "wrong": 1, "unanswered": 13, "partial": 2 },
      "chemistry": { "marks": 16, "rank": 2243, "correct": 4, "wrong": 1, "unanswered": 9, "partial": 4 },
      "total": { "marks": 27, "rank": 2761, "correct": 7, "wrong": 3, "unanswered": 36, "partial": 8 }
    },
    {
      "id": "test-2025-10-18",
      "testDate": "2025-10-18",
      "testName": "CTA-20",
      "type": TestType.PartTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 12, "rank": 849, "correct": 4, "wrong": 0, "unanswered": 13, "partial": 1 },
      "physics": { "marks": 8, "rank": 2404, "correct": 2, "wrong": 0, "unanswered": 15, "partial": 1 },
      "chemistry": { "marks": 8, "rank": 1840, "correct": 2, "wrong": 0, "unanswered": 13, "partial": 3 },
      "total": { "marks": 28, "rank": 1403, "correct": 8, "wrong": 0, "unanswered": 41, "partial": 5 }
    },
    {
      "id": "test-2025-10-19",
      "testDate": "2025-10-19",
      "testName": "WTA-21",
      "type": TestType.ChapterTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 25, "rank": 1474, "correct": 7, "wrong": 0, "unanswered": 10, "partial": 1 },
      "physics": { "marks": 8, "rank": 2490, "correct": 2, "wrong": 1, "unanswered": 14, "partial": 1 },
      "chemistry": { "marks": 13, "rank": 1959, "correct": 5, "wrong": 3, "unanswered": 10, "partial": 0 },
      "total": { "marks": 46, "rank": 1686, "correct": 14, "wrong": 4, "unanswered": 34, "partial": 2 }
    },
    {
      "id": "test-2025-10-25",
      "testDate": "2025-10-25",
      "testName": "CTA-21",
      "type": TestType.PartTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 8, "rank": 2288, "correct": 2, "wrong": 0, "unanswered": 15, "partial": 1 },
      "physics": { "marks": 9, "rank": 1079, "correct": 2, "wrong": 0, "unanswered": 14, "partial": 2 },
      "chemistry": { "marks": 22, "rank": 334, "correct": 5, "wrong": 0, "unanswered": 11, "partial": 2 },
      "total": { "marks": 39, "rank": 901, "correct": 9, "wrong": 0, "unanswered": 40, "partial": 5 }
    },
    {
      "id": "test-2025-10-26",
      "testDate": "2025-10-26",
      "testName": "WTA-22",
      "type": TestType.ChapterTest,
      "subType": TestSubType.JEEAdvanced,
      "maths": { "marks": 8, "rank": 0, "correct": 2, "wrong": 2, "unanswered": 13, "partial": 2 },
      "physics": { "marks": 5, "rank": 0, "correct": 3, "wrong": 2, "unanswered": 14, "partial": 0 },
      "chemistry": { "marks": 30, "rank": 0, "correct": 11, "wrong": 4, "unanswered": 5, "partial": 2 },
      "total": { "marks": 43, "rank": 0, "correct": 16, "wrong": 8, "unanswered": 32, "partial": 4 }
    }
];
