import { test, expect } from '@playwright/test'

test.describe('Zero Trace smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('landing renders the main CTA shell', async ({ page }) => {
    await expect(page.getByText('ZERO TRACE')).toBeVisible()
    await expect(page.getByPlaceholder('닉네임')).toBeVisible()
    await expect(page.getByRole('button', { name: '죽으러 가기' })).toBeVisible()
    await expect(page.getByRole('button', { name: '사망 도감' })).toBeVisible()
    await expect(page.getByRole('button', { name: '랭킹' })).toBeVisible()
  })

  test('nickname field autofills with a generated handle', async ({ page }) => {
    await expect(page.getByPlaceholder('닉네임')).toHaveValue(/^#\d{4}\s.+/, { timeout: 5000 })
  })

  test('collection modal opens from the landing screen', async ({ page }) => {
    await page.getByRole('button', { name: '사망 도감' }).click()

    await expect(page.getByText('사망 도감')).toBeVisible()
    await expect(page.getByText('END 99')).toBeVisible()
    await expect(page.getByText('진짜 엔딩 (아마도)')).toBeVisible()

    await page.getByRole('button', { name: '닫기' }).click()
    await expect(page.getByText('ZERO TRACE')).toBeVisible()
  })

  test('starting a run shows the live HUD', async ({ page }) => {
    await page.getByRole('button', { name: '죽으러 가기' }).click()

    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.getByText(/LV 1/)).toBeVisible()
    await expect(page.getByText(/도전 1회/)).toBeVisible()
    await expect(page.getByText(/기록 \d+\/12/)).toBeVisible()
    await expect(page.getByText(/(30|60)s/)).toBeVisible()
  })

  test('leaderboard modal opens even without seeded score data', async ({ page }) => {
    await page.getByRole('button', { name: '랭킹' }).click()

    await expect(page.getByText('생존 랭킹')).toBeVisible()
    await expect(page.getByText(/최고 생존|아직 아무도 안 죽었습니다/)).toBeVisible()
  })
})
