import type { Page } from '@playwright/test'

export async function readPowerProcedure(analyst: Page) {
  await analyst.getByLabel('Power instruction blocks').waitFor()
  return analyst
    .locator('.instruction-step [role="img"]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('aria-label')!),
    )
}

export async function solvePower(
  page: Page,
  analyst: Page,
  fromIndex = 0,
  toIndex = 12,
) {
  const labels = await readPowerProcedure(analyst)
  for (const label of labels.slice(fromIndex, toIndex)) {
    await page
      .getByRole('button', { name: `${label} switch`, exact: true })
      .click()
  }
}
