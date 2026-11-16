import { expect, test } from '@playwright/test'

test('operators and analysts solve power together, recover from a trip, and retain progress on refresh', async ({
  browser,
}) => {
  const operatorContext = await browser.newContext()
  const analystContext = await browser.newContext()
  try {
    const operator = await operatorContext.newPage()
    const analyst = await analystContext.newPage()
    const errors: string[] = []
    for (const page of [operator, analyst])
      page.on('pageerror', (error) => errors.push(error.message))
    await Promise.all([operator.goto('/'), analyst.goto('/')])
    await operator.getByRole('button', { name: 'Create a room' }).click()
    const code = await operator.locator('.room-code').innerText()
    await analyst.getByLabel('Room code').fill(code)
    await analyst.getByRole('button', { name: 'Join room' }).click()
    await operator.getByRole('button', { name: 'Equipment operator' }).click()
    await analyst.getByRole('button', { name: 'Control room analyst' }).click()
    await operator.getByRole('button', { name: 'Ready up' }).click()
    await analyst.getByRole('button', { name: 'Ready up' }).click()
    await analyst.getByRole('button', { name: 'Enter station' }).click()
    await expect(
      operator.getByRole('heading', { name: 'Breaker panel' }),
    ).toBeVisible()
    await expect(
      analyst.getByRole('heading', { name: 'Wiring diagram' }),
    ).toBeVisible()
    await expect(operator.getByLabel('Safe activation order')).toHaveCount(0)
    await expect(
      analyst.getByRole('button', { name: 'Tide breaker' }),
    ).toHaveCount(0)
    await expect(
      analyst.getByLabel('Safe activation order').locator('li'),
    ).toHaveText([
      '≈TideAwaiting power',
      '⊥AnchorAwaiting power',
      '△BeaconAwaiting power',
    ])
    await operator.getByRole('button', { name: 'Coil breaker' }).focus()
    await operator.getByRole('button', { name: 'Coil breaker' }).press('Enter')
    await expect(operator.getByRole('alert')).toContainText('Circuit tripped')
    await expect(analyst.getByRole('alert')).toContainText('Circuit tripped')
    await expect(
      operator.getByRole('button', { name: 'Tide breaker' }),
    ).toBeDisabled()
    await operator.getByRole('button', { name: 'Reset panel' }).click()
    await operator.getByRole('button', { name: 'Tide breaker' }).click()
    await expect(
      analyst.getByLabel('Safe activation order').locator('li').first(),
    ).toContainText('Energized')
    await operator.reload()
    await expect(
      operator.getByRole('button', { name: 'Tide breaker' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await operator.getByRole('button', { name: 'Anchor breaker' }).click()
    await operator.getByRole('button', { name: 'Beacon breaker' }).click()
    for (const page of [operator, analyst]) {
      await expect(
        page.getByRole('heading', { name: 'First system restored.' }),
      ).toBeVisible()
      await expect(page.locator('.power-indicator')).toHaveText('Online')
    }
    await expect(
      operator.getByRole('button', { name: 'Reset panel' }),
    ).toBeDisabled()
    await analyst.reload()
    await expect(
      analyst.getByRole('heading', { name: 'First system restored.' }),
    ).toBeVisible()
    await operator.setViewportSize({ width: 375, height: 812 })
    await analyst.setViewportSize({ width: 375, height: 812 })
    for (const page of [operator, analyst]) {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
    }
    expect(errors).toEqual([])
  } finally {
    await Promise.all([operatorContext.close(), analystContext.close()])
  }
})
