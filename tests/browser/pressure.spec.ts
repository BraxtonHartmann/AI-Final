import { solvePower } from './powerProcedure'
import { expect, test } from '@playwright/test'

test('crew swaps controls, balances pressure, and drains the airlock with recovery', async ({
  browser,
}) => {
  const equipmentContext = await browser.newContext()
  const controlContext = await browser.newContext()
  try {
    const equipment = await equipmentContext.newPage()
    const control = await controlContext.newPage()
    const errors: string[] = []
    for (const page of [equipment, control])
      page.on('pageerror', (error) => errors.push(error.message))
    await Promise.all([equipment.goto('/'), control.goto('/')])
    await equipment.getByRole('button', { name: 'Create a room' }).click()
    const code = await equipment.locator('.room-code').innerText()
    await control.getByLabel('Room code').fill(code)
    await control.getByRole('button', { name: 'Join room' }).click()
    await equipment.getByRole('button', { name: 'Equipment operator' }).click()
    await control.getByRole('button', { name: 'Control room analyst' }).click()
    await equipment.getByRole('button', { name: 'Ready up' }).click()
    await control.getByRole('button', { name: 'Ready up' }).click()
    await equipment.getByRole('button', { name: 'Enter station' }).click()
    await solvePower(equipment, control)
    await control.getByRole('button', { name: 'Continue to airlock' }).click()
    await expect(
      control.getByRole('heading', { name: 'Valve controls' }),
    ).toBeVisible()
    await expect(
      equipment.getByRole('heading', { name: 'Pressure gauges' }),
    ).toBeVisible()
    await expect(control.getByRole('meter')).toHaveCount(0)
    await expect(
      equipment.getByRole('button', { name: 'Intake valve' }),
    ).toHaveCount(0)
    await expect(equipment.getByLabel('Chamber A')).toHaveAttribute(
      'value',
      '80',
    )
    await expect(equipment.getByLabel('Chamber B')).toHaveAttribute(
      'value',
      '20',
    )
    await control.getByRole('button', { name: 'Start drain pump' }).click()
    await expect(control.getByRole('alert')).toContainText('interlock')
    await control.getByRole('button', { name: 'Return valve' }).click()
    await expect(equipment.getByLabel('Chamber A')).toHaveAttribute(
      'value',
      '95',
    )
    await control.getByRole('button', { name: 'Return valve' }).click()
    await expect(equipment.getByLabel('Chamber A')).toHaveAttribute(
      'value',
      '80',
    )
    await control.getByRole('button', { name: 'Intake valve' }).focus()
    await control.getByRole('button', { name: 'Intake valve' }).press('Space')
    await expect(equipment.getByLabel('Chamber A')).toHaveAttribute(
      'value',
      '60',
    )
    await control.getByRole('button', { name: 'Reset valves' }).click()
    await expect(equipment.getByLabel('Chamber A')).toHaveAttribute(
      'value',
      '80',
    )
    await expect(
      control.getByRole('button', { name: 'Intake valve' }),
    ).toHaveAttribute('aria-pressed', 'false')
    await control.getByRole('button', { name: 'Intake valve' }).click()
    await control.reload()
    await expect(
      control.getByRole('button', { name: 'Intake valve' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await equipment.reload()
    await expect(equipment.getByLabel('Chamber A')).toHaveAttribute(
      'value',
      '60',
    )
    await expect(equipment.getByLabel('Chamber B')).toHaveAttribute(
      'value',
      '30',
    )
    await control.getByRole('button', { name: 'Bypass valve' }).click()
    await expect(equipment.getByLabel('Chamber A')).toHaveAttribute(
      'value',
      '50',
    )
    await expect(equipment.getByLabel('Chamber B')).toHaveAttribute(
      'value',
      '50',
    )
    await control.getByRole('button', { name: 'Start drain pump' }).click()
    for (const page of [equipment, control])
      await expect(
        page.getByRole('heading', { name: 'Second system restored.' }),
      ).toBeVisible()
    await expect(
      control.getByRole('button', { name: 'Reset valves' }),
    ).toBeDisabled()
    await control.reload()
    await expect(
      control.getByRole('heading', { name: 'Second system restored.' }),
    ).toBeVisible()
    for (const page of [equipment, control]) {
      await page.setViewportSize({ width: 375, height: 812 })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
    }
    expect(errors).toEqual([])
  } finally {
    await Promise.all([equipmentContext.close(), controlContext.close()])
  }
})
