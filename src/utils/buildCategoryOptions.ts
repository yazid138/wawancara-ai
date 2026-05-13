export const buildCategoryOptions = (
  categories: Array<{ label: string; score: number }>,
) =>
  categories.map((category) => ({
    label: category.label,
    score: category.score,
  }));
