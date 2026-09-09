import { NextResponse } from "next/server";

import { sql } from "@/lib/db/neon";

import {
  runBacktest,
} from "@/lib/ai/BacktestingEngine";

const VALID_RESULTS = [
  "corn",
  "pepper",
  "tomato",
  "carrot",
  "shrimp",
  "fish",
  "cow",
  "chick",
] as const;

type ValidResult =
  (typeof VALID_RESULTS)[number];

function isValidResult(
  value: unknown,
): value is ValidResult {
  return (
    typeof value === "string" &&
    VALID_RESULTS.includes(
      value as ValidResult,
    )
  );
}

export async function GET() {
  try {
    const rows = await sql`
      SELECT
        result,
        created_at
      FROM greedycat_results
      ORDER BY created_at ASC
    `;

    const sequence =
      rows
        .map(
          (row) => row.result,
        )
        .filter(isValidResult);

    const result =
      runBacktest(sequence);

    return NextResponse.json({
      success: true,
      samples: sequence.length,
      result,
    });
  } catch (error) {
    console.error(
      "GreedyCat backtest failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to run backtest",
      },
      { status: 500 },
    );
  }
}
