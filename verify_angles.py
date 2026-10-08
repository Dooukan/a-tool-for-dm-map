import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()
    page.goto('http://localhost:5173')
    page.wait_for_selector('button:has-text("2D İzometrik")')

    # Switch to 2D Isometric
    page.click('button:has-text("2D İzometrik")')
    time.sleep(1)
    page.screenshot(path='/home/jules/verification/screenshots/iso_0deg.png')

    # Rotate +45
    page.click('button:has-text("+45°")')
    time.sleep(1)
    page.screenshot(path='/home/jules/verification/screenshots/iso_45deg.png')

    # Rotate +45 again to make 90
    page.click('button:has-text("+45°")')
    time.sleep(1)
    page.screenshot(path='/home/jules/verification/screenshots/iso_90deg.png')

    print("Screenshots captured successfully!")
    browser.close()
