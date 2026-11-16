import { expect, test } from '@playwright/test'

test('crew reaches rescue through private chart guidance and recovers radio settings', async ({
  browser,
}) => {
  test.setTimeout(60_000)
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
    await expect(
      equipment.getByRole('heading', { name: 'Radio controls' }),
    ).toBeVisible()
    await expect(
      control.getByRole('heading', { name: 'Transmission chart' }),
    ).toBeVisible()
    await expect(
      equipment.getByRole('region', { name: 'Rescue channel' }),
    ).toHaveCount(0)
    await expect(
      control.getByRole('button', { name: 'Apply settings' }),
    ).toHaveCount(0)
    await equipment
      .getByRole('button', { name: 'Transmit applied settings' })
      .click()
    for (const page of [equipment, control])
      await expect(page.getByRole('alert')).toContainText('No acknowledgment')
    await equipment
      .getByLabel('Frequency', { exact: true })
      .selectOption('6800')
    await equipment
      .getByLabel('Antenna direction', { exact: true })
      .selectOption('east')
    await equipment.getByLabel('Signal code', { exact: true }).fill('2691')
    await equipment.getByRole('button', { name: 'Apply settings' }).click()
    await expect(equipment.getByLabel('Applied radio settings')).toContainText(
      '2691',
    )
    await equipment.getByRole('button', { name: 'Reset radio' }).click()
    await expect(
      equipment.getByLabel('Signal code', { exact: true }),
    ).toHaveValue('')
    const rescue = control.getByRole('region', { name: 'Rescue channel' })
    await expect(rescue).toContainText('5.6 MHz')
    await expect(rescue).toContainText('west')
    await expect(rescue).toContainText('7314')
    await equipment
      .getByLabel('Frequency', { exact: true })
      .selectOption('5600')
    await equipment
      .getByLabel('Antenna direction', { exact: true })
      .selectOption('west')
    await equipment.getByLabel('Signal code', { exact: true }).fill('7314')
    await equipment.getByLabel('Signal code', { exact: true }).press('Enter')
    await expect(equipment.getByLabel('Applied radio settings')).toContainText(
      '7314',
    )
    await equipment.reload()
    await expect(
      equipment.getByLabel('Frequency', { exact: true }),
    ).toHaveValue('5600')
    await expect(
      equipment.getByLabel('Antenna direction', { exact: true }),
    ).toHaveValue('west')
    await expect(
      equipment.getByLabel('Signal code', { exact: true }),
    ).toHaveValue('7314')
    await control.reload()
    await expect(
      control.getByRole('region', { name: 'Rescue channel' }),
    ).toBeVisible()
    await equipment
      .getByRole('button', { name: 'Transmit applied settings' })
      .click()
    for (const page of [equipment, control])
      await expect(
        page.getByRole('heading', { name: 'Third system restored.' }),
      ).toBeVisible()
    await expect(
      equipment.getByRole('button', { name: 'Reset radio' }),
    ).toBeDisabled()
    await control.reload()
    await expect(
      control.getByRole('heading', { name: 'Third system restored.' }),
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
