import { expect, test } from '@playwright/test'

test('two browsers join, choose roles, recover after refresh, and enter together', async ({
  browser,
}) => {
  const first = await browser.newContext()
  const second = await browser.newContext()
  const third = await browser.newContext()
  try {
    const a = await first.newPage()
    const b = await second.newPage()
    const c = await third.newPage()
    const errors: string[] = []
    for (const page of [a, b, c])
      page.on('pageerror', (error) => errors.push(error.message))
    await Promise.all([a.goto('/'), b.goto('/'), c.goto('/')])
    await a.getByRole('button', { name: 'Create a room' }).click()
    const code = await a.locator('.room-code').innerText()
    await expect(
      a.getByRole('button', { name: 'Enter station' }),
    ).toBeDisabled()
    await b.getByLabel('Room code').fill(code)
    await b.getByRole('button', { name: 'Join room' }).click()
    await expect(a.getByText('2 / 2 crew')).toBeVisible()
    await c.getByLabel('Room code').fill(code)
    await c.getByRole('button', { name: 'Join room' }).click()
    await expect(c.getByRole('alert')).toContainText('full')
    await a.getByRole('button', { name: 'Equipment operator' }).click()
    await expect(
      b.getByRole('button', { name: 'Equipment operator' }),
    ).toBeDisabled()
    await b.getByRole('button', { name: 'Control room analyst' }).click()
    await a.getByRole('button', { name: 'Ready up' }).click()
    await a.reload()
    await expect(a.locator('.room-code')).toHaveText(code)
    await expect(
      a.getByRole('button', { name: 'Equipment operator' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(a.getByRole('button', { name: 'Ready up' })).toBeEnabled()
    await expect(
      b.getByRole('button', { name: 'Enter station' }),
    ).toBeDisabled()
    await a.getByRole('button', { name: 'Ready up' }).click()
    await b.getByRole('button', { name: 'Ready up' }).click()
    await a.getByRole('button', { name: 'Enter station' }).click()
    await expect(
      a.getByRole('heading', { name: "You're in position." }),
    ).toBeVisible()
    await expect(
      b.getByRole('heading', { name: "You're in position." }),
    ).toBeVisible()
    await a.getByRole('button', { name: 'Leave room' }).click()
    await expect(a.getByRole('button', { name: 'Create a room' })).toBeVisible()
    await expect(b.getByRole('button', { name: 'Ready up' })).toBeVisible()
    expect(errors).toEqual([])
  } finally {
    await Promise.all([first.close(), second.close(), third.close()])
  }
})

test('entry form supports keyboard input and a narrow viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: 'Create a room' }),
  ).toBeEnabled()
  await page.getByLabel('Room code').fill('ZZZZZZ')
  await page.getByLabel('Room code').press('Enter')
  await expect(page.getByRole('alert')).toContainText('unavailable')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})
