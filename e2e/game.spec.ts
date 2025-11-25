import { test, expect } from '@playwright/test'

test.describe('2DND Game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display title screen', async ({ page }) => {
    // Wait for Phaser to initialize
    await page.waitForTimeout(1000)

    // Check that canvas is present
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
  })

  test('should have game container', async ({ page }) => {
    const container = page.locator('#game-container')
    await expect(container).toBeVisible()
  })

  test('should respond to keyboard input', async ({ page }) => {
    // Wait for game to load
    await page.waitForTimeout(2000)

    // Press arrow keys to navigate menu
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowUp')

    // Game should still be running
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
  })

  test('should start new game on Enter', async ({ page }) => {
    // Wait for game to fully load
    await page.waitForTimeout(2000)

    // Press Enter to start new game
    await page.keyboard.press('Enter')

    // Wait for scene transition
    await page.waitForTimeout(500)

    // Canvas should still be visible after scene change
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
  })

  test('should handle window resize', async ({ page }) => {
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()

    // Resize window
    await page.setViewportSize({ width: 800, height: 600 })
    await page.waitForTimeout(200)

    // Canvas should still be visible
    await expect(canvas).toBeVisible()
  })
})
