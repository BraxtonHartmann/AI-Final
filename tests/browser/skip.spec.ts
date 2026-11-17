import { readPowerProcedure } from './powerProcedure'
import { expect, test } from '@playwright/test'

test('development tools move both players directly to any puzzle after roles are chosen', async ({
  browser,
}) => {
  const first = await browser.newContext()
  const second = await browser.newContext()
  try {
    const equipment = await first.newPage()
    const control = await second.newPage()
    await Promise.all([equipment.goto('/'), control.goto('/')])
    await equipment.getByRole('button', { name: 'Create a room' }).click()
    await expect(
      equipment.getByRole('button', { name: 'Skip to puzzle', exact: true }),
    ).toBeDisabled()
    await control
      .getByLabel('Room code')
      .fill(await equipment.locator('.room-code').innerText())
    await control.getByRole('button', { name: 'Join room' }).click()
    await equipment.getByRole('button', { name: 'Equipment operator' }).click()
    await control.getByRole('button', { name: 'Control room analyst' }).click()
    for (const [target, heading] of [
      ['pressure', 'Drain the airlock.'],
      ['transmitter', 'Send a distress signal.'],
      ['hatch', 'Release the hatch.'],
      ['power', 'Restore the power.'],
    ]) {
      await equipment
        .getByLabel('Testing tools · skip to puzzle')
        .selectOption(target)
      await equipment
        .getByRole('button', { name: 'Skip to puzzle', exact: true })
        .click()
      for (const page of [equipment, control])
        await expect(
          page.getByRole('heading', { name: heading, exact: true }),
        ).toBeVisible()
    }
    const [firstSymbol] = await readPowerProcedure(control)
    await equipment
      .getByRole('button', { name: `${firstSymbol} switch` })
      .click()
    await expect(
      equipment.getByRole('button', { name: `${firstSymbol} switch` }),
    ).toHaveAttribute('aria-pressed', 'true')
  } finally {
    await Promise.all([first.close(), second.close()])
  }
})
