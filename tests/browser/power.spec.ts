import { breakers } from '../../shared/protocol'
import { expect, test } from '@playwright/test'
import { solvePower, readPowerProcedure } from './powerProcedure'

test('symbol-only power uses two private blocks, on/off loops, a completion lamp, and refresh recovery', async ({
  browser,
}) => {
  const first = await browser.newContext()
  const second = await browser.newContext()
  try {
    const operator = await first.newPage()
    const analyst = await second.newPage()
    await Promise.all([operator.goto('/'), analyst.goto('/')])
    await operator.getByRole('button', { name: 'Create a room' }).click()
    await analyst
      .getByLabel('Room code')
      .fill(await operator.locator('.room-code').innerText())
    await analyst.getByRole('button', { name: 'Join room' }).click()
    await operator.getByRole('button', { name: 'Equipment operator' }).click()
    await analyst.getByRole('button', { name: 'Control room analyst' }).click()
    await operator.getByRole('button', { name: 'Ready up' }).click()
    await analyst.getByRole('button', { name: 'Ready up' }).click()
    await operator.getByRole('button', { name: 'Enter station' }).click()
    await expect(
      operator
        .getByRole('group', { name: 'Breaker switches' })
        .getByRole('button'),
    ).toHaveCount(8)
    await expect(operator.getByLabel('Power instruction blocks')).toHaveCount(0)
    await expect(
      analyst.getByLabel('Power instruction blocks').locator('section'),
    ).toHaveCount(2)
    await expect(
      analyst.getByRole('button', { name: 'Triangle switch' }),
    ).toHaveCount(0)
    await expect(operator.locator('.breaker-grid')).not.toContainText(
      /Triangle|Waves|Circle|Diamond|Square|Star|Lightning|Perpendicular/,
    )
    const labels = await readPowerProcedure(analyst)
    const unused = breakers.find((breaker) => !labels.includes(breaker.label))!
    await operator
      .getByRole('button', { name: `${unused.label} switch` })
      .press('Enter')
    await expect(operator.getByRole('alert')).toContainText('Circuit tripped')
    await operator.getByRole('button', { name: 'Reset panel' }).click()
    expect(await readPowerProcedure(analyst)).toEqual(labels)
    await solvePower(operator, analyst, 0, 3)
    await expect(
      operator.getByRole('button', { name: `${labels[0]} switch` }),
    ).toHaveAttribute('aria-pressed', 'false')
    await expect(
      operator.getByLabel('Power lamp: red, awaiting sequence'),
    ).toBeVisible()
    await operator.reload()
    expect(await readPowerProcedure(analyst)).toEqual(labels)
    await expect(
      operator.getByRole('button', { name: `${labels[0]} switch` }),
    ).toHaveAttribute('aria-pressed', 'false')
    await expect(
      operator.getByRole('button', { name: `${labels[1]} switch` }),
    ).toHaveAttribute('aria-pressed', 'true')
    await solvePower(operator, analyst, 3, 6)
    await expect(
      analyst.getByLabel('Auxiliary startup: complete', { exact: true }),
    ).toBeVisible()
    await expect(
      analyst.getByLabel('Airlock transfer: pending', { exact: true }),
    ).toBeVisible()
    await operator
      .getByRole('button', { name: `${unused.label} switch` })
      .click()
    await expect(
      analyst.getByLabel('Auxiliary startup: pending', { exact: true }),
    ).toBeVisible()
    await operator.getByRole('button', { name: 'Reset panel' }).click()
    await solvePower(operator, analyst)
    await expect(
      analyst.getByLabel('Auxiliary startup: complete', { exact: true }),
    ).toBeVisible()
    await expect(
      analyst.getByLabel('Airlock transfer: complete', { exact: true }),
    ).toBeVisible()
    for (const page of [operator, analyst]) {
      await expect(
        page.getByLabel('Power lamp: green, power restored'),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'First system restored.' }),
      ).toBeVisible()
      const header = page.locator('.site-header')
      await expect(
        header.getByRole('button', { name: 'Leave room' }),
      ).toBeVisible()
      const connection = await header.locator('.connection').boundingBox()
      const leave = await header
        .getByRole('button', { name: 'Leave room' })
        .boundingBox()
      expect(
        connection && leave && leave.y >= connection.y + connection.height,
      ).toBeTruthy()
      await page.setViewportSize({ width: 375, height: 812 })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
    }
  } finally {
    await Promise.all([first.close(), second.close()])
  }
})
