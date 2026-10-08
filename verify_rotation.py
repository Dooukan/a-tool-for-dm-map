import os
from playwright.sync_api import sync_playwright

os.makedirs("/home/jules/verification/videos", exist_ok=True)
os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

def run_cuj(page):
    page.goto("http://localhost:5173")
    page.wait_for_timeout(1000)

    # 1. Switch to Isometric Mode
    page.get_by_role("button", name="2D İzometrik").click()
    page.wait_for_timeout(1000)

    # 2. Rotate Isometric Map +45 deg
    page.get_by_role("button", name="+45°").click()
    page.wait_for_timeout(800)

    # 3. Rotate Isometric Map +45 deg again (90 deg total)
    page.get_by_role("button", name="+45°").click()
    page.wait_for_timeout(1000)

    # Capture Screenshot
    page.screenshot(path="/home/jules/verification/screenshots/verification_isometric_rotated.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
