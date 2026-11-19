import { connection } from "next/server";
import { now } from "@/lib/clock";
import { queryCourts } from "@/lib/courts";
import { parseFilters } from "@/lib/filters";
import { FilterForm } from "./FilterForm";
import { FINDER_LAYOUT } from "./FinderSkeleton";
import { Results } from "./Results";

export async function FinderBody({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  await connection();

  const filters = parseFilters(params);
  const { rows, count } = queryCourts(filters, now());

  return (
    <div className={FINDER_LAYOUT}>
      <FilterForm filters={filters} />
      <Results rows={rows} count={count} day={filters.day} />
    </div>
  );
}
