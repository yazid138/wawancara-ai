export const buildCategoryOptions = (
  categories: Array<{ label: string; score: number, id: number }>,
) =>
  categories.map((category) => ({
    label: category.label,
    score: category.score,
    id: category.id,
  }));
