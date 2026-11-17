import { expect, test } from '@playwright/test'

test('crew completes all four systems, re-arms after refresh, escapes, and agrees to replay', async ({
  browser,
}) => {
  test.setTimeout(90_000)
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
    for (const name of ['Tide', 'Anchor', 'Beacon'])
      await equipment.getByRole('button', { name: `${name} breaker` }).click()
    await control.getByRole('button', { name: 'Continue to airlock' }).click()
    await control.getByRole('button', { name: 'Intake valve' }).click()
    await control.getByRole('button', { name: 'Bypass valve' }).click()
    await control.getByRole('button', { name: 'Start drain pump' }).click()
    await equipment
      .getByRole('button', { name: 'Continue to transmitter' })
      .click()
    await equipment
      .getByLabel('Frequency', { exact: true })
      .selectOption('5600')
    await equipment
      .getByLabel('Antenna direction', { exact: true })
      .selectOption('west')
    await equipment.getByLabel('Signal code', { exact: true }).fill('7314')
    await equipment.getByRole('button', { name: 'Apply settings' }).click()
    await equipment
      .getByRole('button', { name: 'Transmit applied settings' })
      .click()
    await control.getByRole('button', { name: 'Continue to hatch' }).click()
    await expect(
      control.getByRole('heading', { name: 'Release keypad' }),
    ).toBeVisible()
    await expect(
      equipment.getByRole('heading', { name: 'Maintenance instructions' }),
    ).toBeVisible()
    await expect(control.getByLabel('Hatch symbol order')).toHaveCount(0)
    await expect(
      equipment.getByLabel('Release code', { exact: true }),
    ).toHaveCount(0)
    await expect(
      equipment.getByLabel('Hatch symbol order').locator('li'),
    ).toContainText(['Triangle', 'Wave', 'Anchor', 'Ring'])
    await control.getByLabel('Release code', { exact: true }).fill('0000')
    await control.getByRole('button', { name: 'Authorize release' }).click()
    for (const page of [equipment, control])
      await expect(page.getByRole('alert')).toContainText('Code rejected')
    await control.getByLabel('Release code', { exact: true }).fill('4826')
    await control.getByLabel('Release code', { exact: true }).press('Enter')
    await equipment
      .getByRole('button', { name: 'Arm Equipment side', exact: true })
      .click()
    await control.getByRole('button', { name: 'Reset keypad and arms' }).click()
    await expect(
      control.getByLabel('Release code', { exact: true }),
    ).toHaveValue('')
    await expect(
      equipment.getByRole('button', {
        name: 'Arm Equipment side',
        exact: true,
      }),
    ).toBeDisabled()
    await control.getByLabel('Release code', { exact: true }).fill('4826')
    await control.getByRole('button', { name: 'Authorize release' }).click()
    await expect(
      control.getByRole('button', { name: 'Release hatch', exact: true }),
    ).toBeDisabled()
    await equipment
      .getByRole('button', { name: 'Arm Equipment side', exact: true })
      .click()
    await control
      .getByRole('button', { name: 'Arm Control side', exact: true })
      .click()
    await expect(
      control.getByRole('button', { name: 'Release hatch', exact: true }),
    ).toBeEnabled()
    await equipment.reload()
    await expect(
      equipment.getByRole('button', {
        name: 'Arm Equipment side',
        exact: true,
      }),
    ).toBeEnabled()
    await expect(
      control.getByRole('button', { name: 'Release hatch', exact: true }),
    ).toBeDisabled()
    await equipment
      .getByRole('button', { name: 'Arm Equipment side', exact: true })
      .click()
    for (const page of [equipment, control]) {
      await page.setViewportSize({ width: 375, height: 812 })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
    }
    await control
      .getByRole('button', { name: 'Release hatch', exact: true })
      .click()
    for (const page of [equipment, control])
      await expect(
        page.getByRole('heading', { name: 'You escaped.' }),
      ).toBeVisible()
    await control.reload()
    await expect(
      control.getByRole('heading', { name: 'You escaped.' }),
    ).toBeVisible()
    await equipment
      .getByRole('button', { name: 'Play again', exact: true })
      .click()
    await expect(
      control.getByText('Replay requested', { exact: true }),
    ).toBeVisible()
    await equipment
      .getByRole('button', { name: 'Cancel replay request' })
      .click()
    await expect(
      control.getByText('Replay requested', { exact: true }),
    ).toHaveCount(0)
    await equipment
      .getByRole('button', { name: 'Play again', exact: true })
      .click()
    await control
      .getByRole('button', { name: 'Play again', exact: true })
      .click()
    for (const page of [equipment, control]) {
      await expect(page.getByRole('button', { name: 'Ready up' })).toBeVisible()
      await expect(page.locator('.room-code')).toHaveText(code)
    }
    await equipment.getByRole('button', { name: 'Ready up' }).click()
    await control.getByRole('button', { name: 'Ready up' }).click()
    await control.getByRole('button', { name: 'Enter station' }).click()
    await equipment.getByRole('button', { name: 'Tide breaker' }).click()
    await expect(
      equipment.getByRole('button', { name: 'Tide breaker' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(errors).toEqual([])
  } finally {
    await Promise.all([equipmentContext.close(), controlContext.close()])
  }
})
