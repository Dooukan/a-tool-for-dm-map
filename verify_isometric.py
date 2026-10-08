import os
from playwright.sync_api import sync_playwright

os.makedirs("/home/jules/verification/videos", exist_ok=True)
os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

def run_cuj(page):
    page.goto("http://localhost:5173")
    page.wait_for_timeout(1000)

    # 1. Capture 2D Flat View
    page.screenshot(path="/home/jules/verification/screenshots/verification_2d_flat.png")
    page.wait_for_timeout(500)

    # 2. Switch to 2D Isometric View
    iso_btn = page.get_by_role("button", name="2D İzometrik")
    iso_btn.click()
    page.wait_for_timeout(1000)

    # 3. Capture 2D Isometric View
    page.screenshot(path="/home/jules/verification/screenshots/verification_2d_isometric.png")
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
