"""Take a phone-sized screenshot of each project so Trailhead can show how it looks now.

Run from the repo root:
    python3 trailhead/tools/shoot.py            # every project with a page in this repo
    python3 trailhead/tools/shoot.py wolf vye   # just these project ids

Needs Python's playwright and Pillow. It serves the repo on a local port, opens each
project's page at phone size (sideways if its entry has "shot": "landscape"), waits
for it to settle, and writes
trailhead/shots/<id>.webp plus trailhead/shots.js. Projects hosted elsewhere (a full
https:// url) are skipped unless --remote is passed.
"""
import datetime, io, json, pathlib, subprocess, sys, time
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
TH = ROOT / "trailhead"
PORT = 8791

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    remote = "--remote" in sys.argv
    projects = json.loads((TH / "projects.json").read_text(encoding="utf-8"))["projects"]
    shots_js = TH / "shots.js"
    shots = {}
    if shots_js.exists():
        txt = shots_js.read_text(encoding="utf-8")
        shots = json.loads(txt[txt.index("{"): txt.rindex("}") + 1])
    (TH / "shots").mkdir(exist_ok=True)
    today = datetime.date.today().isoformat()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", str(ROOT)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            for p in projects:
                if args and p["id"] not in args:
                    continue
                url = p.get("url") or ""
                if not url or (url.startswith("http") and not remote):
                    continue
                full = url if url.startswith("http") else f"http://localhost:{PORT}/{url}"
                wide = p.get("shot") == "landscape"
                page = browser.new_page(viewport={"width": 760, "height": 390} if wide else {"width": 390, "height": 700}, device_scale_factor=2)
                try:
                    page.goto(full, wait_until="load", timeout=20000)
                    page.wait_for_timeout(3000)
                    png = page.screenshot()
                except Exception as e:
                    print("skipped", p["id"], str(e)[:80]); page.close(); continue
                page.close()
                im = Image.open(io.BytesIO(png)).convert("RGB")
                if len(im.resize((16, 16)).getcolors(256) or [0] * 9) < 3:
                    print("skipped", p["id"], "(blank page)"); continue
                im.save(TH / "shots" / f"{p['id']}.webp", "WEBP", quality=62, method=6)
                shots[p["id"]] = {"src": f"shots/{p['id']}.webp?v={today}", "on": today}
                print("shot", p["id"])
            browser.close()
    finally:
        srv.terminate()
    shots_js.write_text("// Written by tools/shoot.py. One current screenshot per project.\nconst SHOTS=" +
                        json.dumps(shots, indent=1) + ";\n", encoding="utf-8")

if __name__ == "__main__":
    main()
