import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()
    page.goto('http://localhost:5173')
    page.wait_for_selector('button:has-text("2D İzometrik")')

    # Click 2D Isometric view
    page.click('button:has-text("2D İzometrik")')
    time.sleep(1)

    # Take screenshot of isometric view
    page.screenshot(path='/home/jules/verification/screenshots/verification_isometric_prisms.png')
    print("Screenshot captured successfully!")
    browser.close()
