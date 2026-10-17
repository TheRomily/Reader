import { expect } from "@playwright/test";

export async function spreadGeometry(page) {
  return page.locator(".reader-page").evaluateAll((nodes) =>
    nodes.map((node) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { index: Number(node.dataset.pageIndex), x, y, width, height };
    }),
  );
}

// Counting two images cannot detect a spread wrapping into a vertical stack.
export async function assertSpread(page, rtl = false) {
  await expect(page.locator(".reader-page")).toHaveCount(2);
  await expect
    .poll(async () => {
      const boxes = await spreadGeometry(page);
      if (
        boxes.length !== 2 ||
        boxes.some((box) => box.width <= 0 || box.height <= 0)
      )
        return false;
      const [first, second] = boxes;
      const [left, right] = rtl ? [second, first] : [first, second];
      return (
        Math.abs(first.y - second.y) <= 1 &&
        left.x + left.width <= right.x + 1 &&
        Math.abs(right.x - left.x - left.width - 4) <= 1
      );
    })
    .toBe(true);
  return spreadGeometry(page);
}
